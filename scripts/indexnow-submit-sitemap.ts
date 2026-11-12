/**
 * One-off IndexNow tooling for the LIVE site (the daily job is
 * app/api/cron/indexnow/route.ts, run by Vercel Cron).
 *
 *   --submit  POST every URL in the live sitemap.xml to IndexNow in one batch.
 *             Per the IndexNow FAQ this is for one-time events (first setup, a
 *             large batch of new pages, a migration) - not something to run
 *             routinely.
 *   --seed    Record every URL in the live sitemap in the indexnow_urls table
 *             WITHOUT submitting, so the daily job treats them as already
 *             known and only submits genuinely new pages from then on.
 *
 * Requires .env.local with INDEXNOW_KEY (and, for --seed, the Supabase
 * service-role variables). The key file must already be live on the site.
 *
 * Usage: npx tsx --conditions=react-server scripts/indexnow-submit-sitemap.ts --submit
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { getIndexNowKey, submitToIndexNow } from "../lib/indexnow";
import { createAdminClient } from "../lib/supabase/admin";

const LIVE_SITE = "https://thaigoldtracker.com";

async function loadLiveSitemapUrls(): Promise<string[]> {
  const response = await fetch(`${LIVE_SITE}/sitemap.xml`);
  if (!response.ok) throw new Error(`sitemap.xml returned HTTP ${response.status}`);
  const xml = await response.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
    m[1].replace(/&amp;/g, "&").trim(),
  );
  const foreign = urls.filter((url) => new URL(url).origin !== LIVE_SITE);
  if (foreign.length > 0) throw new Error(`sitemap lists URLs on another host: ${foreign[0]}`);
  return [...new Set(urls)];
}

async function main() {
  const submit = process.argv.includes("--submit");
  const seed = process.argv.includes("--seed");
  if (!submit && !seed) throw new Error("pass --submit and/or --seed");

  const urls = await loadLiveSitemapUrls();
  console.log(`live sitemap: ${urls.length} URLs`);

  if (submit) {
    const key = getIndexNowKey();
    if (!key) throw new Error("INDEXNOW_KEY is missing from .env.local");
    const keyFile = await fetch(`${LIVE_SITE}/${key}.txt`);
    const body = (await keyFile.text()).trim();
    if (!keyFile.ok || body !== key) {
      throw new Error(`key file is not live yet (HTTP ${keyFile.status}); deploy first`);
    }
    console.log("key file is live and contains the key");

    const result = await submitToIndexNow(LIVE_SITE, urls);
    console.log(
      `IndexNow response: HTTP ${result.status}${result.detail ? ` - ${result.detail}` : ""} ` +
        `(${result.submitted} URLs submitted, ${result.ok ? "accepted" : "NOT accepted"})`,
    );
    if (!result.ok) process.exitCode = 1;
  }

  if (seed) {
    const { error, count } = await createAdminClient()
      .from("indexnow_urls")
      .upsert(
        urls.map((url) => ({ url })),
        { onConflict: "url", ignoreDuplicates: true, count: "exact" },
      );
    if (error) throw new Error(`could not record URLs: ${error.message}`);
    console.log(`recorded ${count ?? 0} new URL(s) in indexnow_urls (of ${urls.length})`);
  }
}

main().catch((err) => {
  console.error("indexnow-submit-sitemap failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
