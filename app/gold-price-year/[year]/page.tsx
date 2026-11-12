import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatThaiDateShort, formatThaiPrice } from "@/lib/thai-date";
import {
  getDailyHistoryForYear,
  getDataAsOfDate,
  type DailyGoldPriceRow,
} from "@/lib/gold-price-queries";
import { computeMonthlyStats, type MonthlyStat } from "@/lib/monthly-stats";
import {
  FIRST_YEAR_BE,
  getYearPageConfig,
  isCurrentYear as isYearInProgress,
  listYearPages,
  yearPagePath,
  type YearPageConfig,
} from "@/lib/year-pages";
import { listMonthPagesForYear, monthPagePath } from "@/lib/month-pages";
import { PriceChart } from "@/components/PriceChart";
import { YearSummary, type YearSummaryStats } from "@/components/YearSummary";
import { MonthlyStatsTable } from "@/components/MonthlyStatsTable";
import { JsonLd } from "@/components/JsonLd";
import { SITE_URL } from "@/lib/site";

// The year in progress is regenerated on every ISR revalidation like any
// other page here, so it stays current - past years just happen to return
// identical data on every regen, which is harmless.
export const revalidate = 3600;

// Years that exist when the site is built. A year that starts later (2570 in
// January) is not in this list, but dynamicParams is on by default, so its
// page is generated the first time it is requested - see lib/year-pages.ts.
export async function generateStaticParams() {
  return listYearPages(await getDataAsOfDate()).map((p) => ({ year: String(p.buddhistYear) }));
}

interface Props {
  params: Promise<{ year: string }>;
}

async function resolveConfig(params: Props["params"]): Promise<YearPageConfig> {
  const { year } = await params;
  const config = getYearPageConfig(year, await getDataAsOfDate());
  if (!config) notFound();
  return config;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const config = await resolveConfig(params);
  const path = yearPagePath(config.buddhistYear);
  const title = `ราคาทองปี ${config.buddhistYear} ย้อนหลังทั้งปี กราฟและตารางรายเดือน | ThaiGoldTracker`;
  const description = `เช็คราคาทองคำแท่งปี ${config.buddhistYear} ย้อนหลังทั้งปี เปิดปี ปิดปี ราคาสูงสุด-ต่ำสุดเมื่อไหร่ พร้อมกราฟรายวันและตารางสรุปราคารายเดือน อ้างอิงประกาศสมาคมค้าทองคำ`;
  const encodedPath = encodeURI(path);

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: encodedPath },
    openGraph: { title, description, url: encodedPath },
  };
}

interface YearPageData {
  yearRows: DailyGoldPriceRow[];
  monthlyStats: MonthlyStat[];
  summaryStats: YearSummaryStats | null;
}

async function loadYearData(config: YearPageConfig): Promise<YearPageData> {
  try {
    const yearRows = await getDailyHistoryForYear(config.gregorianYear);
    if (yearRows.length === 0) {
      return { yearRows: [], monthlyStats: [], summaryStats: null };
    }

    const open = yearRows[0].barSell;
    const latest = yearRows[yearRows.length - 1];
    const close = latest.barSell;

    let high = yearRows[0];
    let low = yearRows[0];
    for (const row of yearRows) {
      if (row.barSell > high.barSell) high = row;
      if (row.barSell < low.barSell) low = row;
    }

    const summaryStats: YearSummaryStats = {
      open,
      close,
      diff: close - open,
      pct: open !== 0 ? ((close - open) / open) * 100 : 0,
      high: high.barSell,
      highDate: new Date(high.priceDate),
      low: low.barSell,
      lowDate: new Date(low.priceDate),
    };

    return { yearRows, monthlyStats: computeMonthlyStats(yearRows), summaryStats };
  } catch (err) {
    console.error(
      `[gold-price-year] failed to load ${config.buddhistYear}:`,
      err instanceof Error ? err.message : err,
    );
    return { yearRows: [], monthlyStats: [], summaryStats: null };
  }
}

export default async function YearPage({ params }: Props) {
  const config = await resolveConfig(params);
  const { yearRows, monthlyStats, summaryStats } = await loadYearData(config);

  const isCurrentYear = isYearInProgress(config.buddhistYear);
  const isFirstYear = config.buddhistYear === FIRST_YEAR_BE;
  const firstAvailableDate =
    isFirstYear && yearRows.length > 0 ? new Date(yearRows[0].priceDate) : null;

  const yearPages = listYearPages(await getDataAsOfDate());
  const currentIndex = yearPages.findIndex((p) => p.buddhistYear === config.buddhistYear);
  const prevPage = currentIndex > 0 ? yearPages[currentIndex - 1] : null;
  const nextPage = currentIndex < yearPages.length - 1 ? yearPages[currentIndex + 1] : null;

  const path = yearPagePath(config.buddhistYear);
  // Up to the month of this year's newest row, so a month with no data is
  // never linked; the current year gains one as soon as its first price lands.
  const monthPages =
    yearRows.length > 0
      ? listMonthPagesForYear(config.buddhistYear, yearRows[yearRows.length - 1].fetchedAt)
      : [];

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
            {
              "@type": "ListItem",
              position: 3,
              name: `ราคาทองปี ${config.buddhistYear}`,
              item: `${SITE_URL}${encodeURI(path)}`,
            },
          ],
        }}
      />

      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 sm:text-3xl">
          ราคาทองปี {config.buddhistYear}
        </h1>
      </header>

      {summaryStats ? (
        <>
          <YearSummary
            buddhistYear={config.buddhistYear}
            isCurrentYear={isCurrentYear}
            firstAvailableDate={firstAvailableDate}
            stats={summaryStats}
          />

          <div>
            <PriceChart
              rows={yearRows}
              metric="barSell"
              title={`ราคาทองคำแท่งขายออกรายวัน ปี ${config.buddhistYear}`}
              hideCaption
            />
            <p className="mt-2 flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>
                ต่ำสุด {formatThaiPrice(summaryStats.low)} บาท (
                {formatThaiDateShort(summaryStats.lowDate)})
              </span>
              <span>
                สูงสุด {formatThaiPrice(summaryStats.high)} บาท (
                {formatThaiDateShort(summaryStats.highDate)})
              </span>
            </p>
          </div>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50">
              สรุปราคาทองรายเดือน ปี {config.buddhistYear}
            </h2>
            <div className="mt-3">
              <MonthlyStatsTable stats={monthlyStats} />
            </div>
          </section>
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-gray-300 p-5 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          ยังไม่มีข้อมูลราคาทองสำหรับปีนี้ในระบบ
        </p>
      )}

      {monthPages.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50">ราคาทองรายเดือน</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {monthPages.map((p) => (
              <li key={p.slug}>
                <Link
                  href={monthPagePath(p)}
                  className="inline-block rounded-full border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:border-amber-500 hover:text-amber-600 dark:border-gray-700 dark:text-gray-300"
                >
                  {p.monthName} {p.buddhistYear}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4 dark:border-gray-800">
        {prevPage ? (
          <Link
            href={yearPagePath(prevPage.buddhistYear)}
            className="text-sm font-medium text-amber-600 hover:underline dark:text-amber-400"
          >
            ← ราคาทองปี {prevPage.buddhistYear}
          </Link>
        ) : (
          <span />
        )}
        {nextPage && (
          <Link
            href={yearPagePath(nextPage.buddhistYear)}
            className="text-sm font-medium text-amber-600 hover:underline dark:text-amber-400"
          >
            ราคาทองปี {nextPage.buddhistYear} →
          </Link>
        )}
      </div>

      <Link
        href="/history"
        className="text-sm font-medium text-amber-600 hover:underline dark:text-amber-400"
      >
        ← ดูราคาทองย้อนหลังทั้งหมด
      </Link>

      <footer className="mt-4 border-t border-gray-200 pt-4 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <p>
          ข้อมูลราคาทองคำอ้างอิงจากประกาศของสมาคมค้าทองคำ (goldtraders.or.th)
          ราคาปิดรายวันคือราคาประกาศครั้งสุดท้ายของแต่ละวัน
        </p>
      </footer>
    </main>
  );
}
