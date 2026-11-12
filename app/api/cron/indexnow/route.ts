import { NextResponse } from "next/server";
import sitemap from "@/app/sitemap";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDataAsOfDate } from "@/lib/gold-price-queries";
import { selectUrlsToSubmit, submitToIndexNow } from "@/lib/indexnow";
import { listMonthPages, monthPagePath } from "@/lib/month-pages";
import { listYearPages, yearPagePath } from "@/lib/year-pages";
import { SITE_URL } from "@/lib/site";

// Daily IndexNow submission, run by Vercel Cron (vercel.json) once a day after
// the Thai market has closed. Vercel calls it with
// `Authorization: Bearer <CRON_SECRET>`.
//
// Submits:
//   1. the pages whose content changes every trading day - the homepage,
//      /history, /gold-price-chart, the current month page and the current
//      year page; and
//   2. every sitemap URL that has never been submitted before (a new month or
//      year page, or a page added by a deploy), tracked in the indexnow_urls
//      table (migration 0010).
// It is deliberately NOT called on each price change: IndexNow asks sites not
// to resubmit the same URL many times a day, and every submission spends
// crawl quota.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;

/** Every URL recorded as submitted. Throws if the table can't be read. */
async function loadKnownUrls(): Promise<Set<string>> {
  const supabase = createAdminClient();
  const known = new Set<string>();
  // PostgREST caps a response at ~1000 rows, so page through.
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("indexnow_urls")
      .select("url")
      .order("url", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) known.add(row.url);
    if (!data || data.length < PAGE_SIZE) break;
  }
  return known;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Never announce a local or preview build's URLs to search engines.
  const host = new URL(SITE_URL).hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return NextResponse.json({ status: "skipped", reason: `SITE_URL is ${host}` });
  }

  const asOf = await getDataAsOfDate();
  const currentMonth = listMonthPages(asOf).at(-1);
  const currentYear = listYearPages(asOf).at(-1);
  const dailyUrls = [
    `${SITE_URL}/`,
    `${SITE_URL}/history`,
    `${SITE_URL}/gold-price-chart`,
    ...(currentMonth ? [`${SITE_URL}${encodeURI(monthPagePath(currentMonth))}`] : []),
    ...(currentYear ? [`${SITE_URL}${encodeURI(yearPagePath(currentYear.buddhistYear))}`] : []),
  ];

  const sitemapUrls = (await sitemap()).map((entry) => entry.url);

  // If the bookkeeping table can't be read, still send the daily pages (the
  // main point of the job) and skip new-URL detection rather than resubmit
  // the whole sitemap every day.
  let known: Set<string> | null = null;
  let warning: string | undefined;
  try {
    known = await loadKnownUrls();
  } catch (err) {
    warning = `could not read indexnow_urls: ${err instanceof Error ? err.message : err}`;
    console.error("[indexnow]", warning);
  }

  const { urls, newUrls } = known
    ? selectUrlsToSubmit({ sitemapUrls, dailyUrls, knownUrls: known })
    : { urls: dailyUrls, newUrls: [] };

  const result = await submitToIndexNow(SITE_URL, urls);
  console.log(
    `[indexnow] submitted ${result.submitted} URL(s) (${newUrls.length} new) -> HTTP ${result.status} ${result.detail}`,
  );

  // Record new URLs only once IndexNow has accepted them, so a failed run
  // retries them tomorrow.
  if (result.ok && newUrls.length > 0) {
    const { error } = await createAdminClient()
      .from("indexnow_urls")
      .upsert(
        newUrls.map((url) => ({ url })),
        { onConflict: "url", ignoreDuplicates: true },
      );
    if (error) {
      warning = `submitted, but could not record new URLs: ${error.message}`;
      console.error("[indexnow]", warning);
    }
  }

  return NextResponse.json(
    {
      status: result.ok ? "submitted" : "failed",
      indexNowStatus: result.status,
      detail: result.detail || undefined,
      submitted: result.submitted,
      dailyUrls: dailyUrls.length,
      newUrls,
      warning,
    },
    { status: result.ok ? 200 : 502 },
  );
}
