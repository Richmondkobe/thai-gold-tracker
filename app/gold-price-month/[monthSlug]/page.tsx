import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatThaiDateShort, formatThaiPrice, formatThaiWholeNumber } from "@/lib/thai-date";
import { subtractDaysFromDateString } from "@/lib/bangkok";
import {
  getAnnouncementCountForMonth,
  getDailyCloseOnOrBefore,
  getDataAsOfDate,
  getDailyHistoryForMonth,
  type DailyGoldPriceRow,
} from "@/lib/gold-price-queries";
import {
  getAdjacentMonthPages,
  getMonthPageBySlug,
  isCurrentMonth,
  listRecentMonthPages,
  monthPagePath,
  type MonthPageConfig,
} from "@/lib/month-pages";
import { getYearPageConfig, yearPagePath } from "@/lib/year-pages";
import { PriceChart } from "@/components/PriceChart";
import { MonthSummary, type MonthSummaryStats } from "@/components/MonthSummary";
import { MonthDailyTable } from "@/components/MonthDailyTable";
import { JsonLd } from "@/components/JsonLd";
import { SITE_URL } from "@/lib/site";

// One route serves every month, so they share one interval. 10 minutes keeps
// the CURRENT month's page close to live as new prices arrive; for a finished
// month a regeneration just reproduces the same page, and only happens when
// someone actually visits it.
export const revalidate = 600;

// Only the last 12 months (the ones /history links to) are built ahead of
// time. The other ~120 are generated the first time they are requested and
// then cached like any ISR page - no point running several hundred database
// queries on every deploy for pages that never change.
// dynamicParams stays at its default (true) for the reason given in
// app/gold-weight/[weightSlug]/page.tsx: Thai slugs arrive percent-encoded.
export async function generateStaticParams() {
  return listRecentMonthPages(12, await getDataAsOfDate()).map((p) => ({ monthSlug: p.slug }));
}

interface Props {
  params: Promise<{ monthSlug: string }>;
}

// The segment arrives percent-encoded; decode before the lookup. Months
// before the data starts, or after the newest stored price (which includes a
// brand-new month that has no announcement yet), 404.
async function resolveConfig(params: Props["params"]): Promise<MonthPageConfig> {
  const { monthSlug } = await params;
  let decoded: string;
  try {
    decoded = decodeURIComponent(monthSlug);
  } catch {
    notFound();
  }
  const config = getMonthPageBySlug(decoded, await getDataAsOfDate());
  if (!config) notFound();
  return config;
}

interface MonthPageData {
  rows: DailyGoldPriceRow[];
  /** ทองคำแท่ง ขายออก at the last close before this month; null at the start of the data. */
  previousClose: number | null;
  stats: MonthSummaryStats | null;
}

// cache(): generateMetadata (the description quotes the month's high/low) and
// the page itself share one set of queries per render.
// Two different "nothing" results, deliberately: `stats: null` means the month
// genuinely has no prices (the page 404s - a month with no data is skipped),
// while a return of `null` means the lookup FAILED, in which case the page
// stays up with a "no data right now" note rather than 404ing a real month.
const loadMonthData = cache(
  async (gregorianYear: number, month: number): Promise<MonthPageData | null> => {
    try {
      const firstDay = `${gregorianYear}-${String(month).padStart(2, "0")}-01`;
      const [rows, announcements, previous] = await Promise.all([
        getDailyHistoryForMonth(gregorianYear, month),
        // The count and the previous close only decorate the page - if either
        // query fails, still show the month rather than an empty state.
        getAnnouncementCountForMonth(gregorianYear, month).catch((err) => {
          console.error("[gold-price-month] announcement count failed:", err);
          return null;
        }),
        getDailyCloseOnOrBefore(subtractDaysFromDateString(firstDay, 1)).catch((err) => {
          console.error("[gold-price-month] previous close failed:", err);
          return null;
        }),
      ]);
      if (rows.length === 0) return { rows: [], previousClose: null, stats: null };

      const first = rows[0];
      const last = rows[rows.length - 1];
      let high = first;
      let low = first;
      for (const row of rows) {
        if (row.barSell > high.barSell) high = row;
        if (row.barSell < low.barSell) low = row;
      }
      const diff = last.barSell - first.barSell;

      return {
        rows,
        previousClose: previous ? previous.barSell : null,
        stats: {
          first: first.barSell,
          firstDate: new Date(first.priceDate),
          last: last.barSell,
          lastDate: new Date(last.priceDate),
          diff,
          pct: first.barSell !== 0 ? (diff / first.barSell) * 100 : 0,
          high: high.barSell,
          highDate: new Date(high.priceDate),
          low: low.barSell,
          lowDate: new Date(low.priceDate),
          announcements,
        },
      };
    } catch (err) {
      console.error(
        `[gold-price-month] failed to load ${gregorianYear}-${month}:`,
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  },
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const config = await resolveConfig(params);
  const data = await loadMonthData(config.gregorianYear, config.month);
  if (data && !data.stats) notFound();
  const stats = data?.stats ?? null;
  const label = `${config.monthName} ${config.buddhistYear}`;
  const encodedPath = encodeURI(monthPagePath(config));

  const title = `ราคาทองย้อนหลัง ${label} – ตารางรายวันและกราฟ`;
  const description = stats
    ? `ราคาทองคำแท่งขายออกเดือน${label} สูงสุด ${formatThaiWholeNumber(stats.high)} บาท ต่ำสุด ${formatThaiWholeNumber(stats.low)} บาท (ราคาปิดรายวัน) ดูตารางราคาทองรายวันของทองคำแท่งและทองรูปพรรณ พร้อมกราฟราคาทองตลอดเดือน อ้างอิงประกาศสมาคมค้าทองคำ`
    : `ราคาทองย้อนหลังเดือน${label} ตารางราคาทองรายวันของทองคำแท่งและทองรูปพรรณ พร้อมกราฟราคาทองตลอดเดือน อ้างอิงประกาศสมาคมค้าทองคำ`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: encodedPath },
    openGraph: { title, description, url: encodedPath },
  };
}

const LINK_CLASS = "text-sm font-medium text-amber-600 hover:underline dark:text-amber-400";

export default async function MonthPage({ params }: Props) {
  const config = await resolveConfig(params);
  const data = await loadMonthData(config.gregorianYear, config.month);
  if (data && !data.stats) notFound();
  const rows = data?.rows ?? [];
  const previousClose = data?.previousClose ?? null;
  const stats = data?.stats ?? null;

  const label = `${config.monthName} ${config.buddhistYear}`;
  const path = monthPagePath(config);
  const { previous, next } = getAdjacentMonthPages(config, await getDataAsOfDate());
  const hasYearPage = getYearPageConfig(String(config.buddhistYear)) !== null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "ราคาทองวันนี้", item: `${SITE_URL}/` },
            {
              "@type": "ListItem",
              position: 2,
              name: "ราคาทองย้อนหลัง",
              item: `${SITE_URL}/history`,
            },
            ...(hasYearPage
              ? [
                  {
                    "@type": "ListItem",
                    position: 3,
                    name: `ราคาทองปี ${config.buddhistYear}`,
                    item: `${SITE_URL}${encodeURI(yearPagePath(config.buddhistYear))}`,
                  },
                ]
              : []),
            {
              "@type": "ListItem",
              position: hasYearPage ? 4 : 3,
              name: `ราคาทองเดือน${label}`,
              item: `${SITE_URL}${encodeURI(path)}`,
            },
          ],
        }}
      />

      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 sm:text-3xl">
          ราคาทองคำ เดือน{label}
        </h1>
      </header>

      {stats ? (
        <>
          <MonthSummary
            monthName={config.monthName}
            buddhistYear={config.buddhistYear}
            isCurrentMonth={isCurrentMonth(config)}
            isFirstMonthOfData={previous === null}
            stats={stats}
          />

          <div>
            <PriceChart
              rows={rows}
              metric="barSell"
              title={`ราคาทองคำแท่งขายออกรายวัน เดือน${label}`}
              hideCaption
            />
            {rows.length >= 2 && (
              <p className="mt-2 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>
                  ต่ำสุด {formatThaiPrice(stats.low)} บาท ({formatThaiDateShort(stats.lowDate)})
                </span>
                <span>
                  สูงสุด {formatThaiPrice(stats.high)} บาท ({formatThaiDateShort(stats.highDate)})
                </span>
              </p>
            )}
          </div>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50">
              ตารางราคาทองรายวัน เดือน{label}
            </h2>
            <div className="mt-3">
              <MonthDailyTable rows={rows} previousClose={previousClose} />
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              ราคาบาทละ (บาท) เป็นราคาปิดของแต่ละวัน ช่องเปลี่ยนแปลงคือราคาทองคำแท่งขายออกเทียบกับราคาปิดของวันทำการก่อนหน้า
            </p>
          </section>
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-gray-300 p-5 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          ไม่สามารถแสดงข้อมูลราคาทองของเดือนนี้ได้ในขณะนี้ กรุณาลองใหม่อีกครั้งภายหลัง
        </p>
      )}

      <nav
        aria-label="ราคาทองเดือนอื่น"
        className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4 dark:border-gray-800"
      >
        {previous ? (
          <Link href={monthPagePath(previous)} className={LINK_CLASS}>
            ← {previous.monthName} {previous.buddhistYear}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={monthPagePath(next)} className={LINK_CLASS}>
            {next.monthName} {next.buddhistYear} →
          </Link>
        )}
      </nav>

      <div className="flex flex-col gap-2">
        {hasYearPage && (
          <Link href={yearPagePath(config.buddhistYear)} className={LINK_CLASS}>
            ดูราคาทองทั้งปี {config.buddhistYear} →
          </Link>
        )}
        <Link href="/history" className={LINK_CLASS}>
          ← ดูราคาทองย้อนหลังทั้งหมด
        </Link>
      </div>

      <footer className="mt-4 border-t border-gray-200 pt-4 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <p>
          ข้อมูลราคาทองคำอ้างอิงจากประกาศของสมาคมค้าทองคำ (goldtraders.or.th)
          ราคาปิดรายวันคือราคาประกาศครั้งสุดท้ายของแต่ละวัน
        </p>
      </footer>
    </main>
  );
}
