import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatThaiDateShort, formatThaiPrice } from "@/lib/thai-date";
import { getDailyHistoryForYear, type DailyGoldPriceRow } from "@/lib/gold-price-queries";
import { computeMonthlyStats, type MonthlyStat } from "@/lib/monthly-stats";
import {
  FIRST_YEAR_BE,
  CURRENT_YEAR_BE,
  YEAR_PAGES,
  getYearPageConfig,
  yearPagePath,
  type YearPageConfig,
} from "@/lib/year-pages";
import { PriceChart } from "@/components/PriceChart";
import { YearSummary, type YearSummaryStats } from "@/components/YearSummary";
import { MonthlyStatsTable } from "@/components/MonthlyStatsTable";
import { JsonLd } from "@/components/JsonLd";
import { SITE_URL } from "@/lib/site";

// 2569 (the current year) is regenerated on every ISR revalidation like any
// other page here, so it stays current - past years just happen to return
// identical data on every regen, which is harmless.
export const revalidate = 3600;

export function generateStaticParams() {
  return YEAR_PAGES.map((p) => ({ year: String(p.buddhistYear) }));
}

interface Props {
  params: Promise<{ year: string }>;
}

async function resolveConfig(params: Props["params"]): Promise<YearPageConfig> {
  const { year } = await params;
  const config = getYearPageConfig(year);
  if (!config) notFound();
  return config;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const config = await resolveConfig(params);
  const path = yearPagePath(config.buddhistYear);
  const title = `ราคาทองปี ${config.buddhistYear} ย้อนหลังทั้งปี กราฟและตารางรายเดือน | ThaiGoldTracker`;
  const description = `เช็คราคาทองคำแท่งปี ${config.buddhistYear} ย้อนหลังทั้งปี เปิดปีเท่าไหร่ ปิดปีเท่าไหร่ ราคาสูงสุด-ต่ำสุดเมื่อไหร่ พร้อมกราฟราคารายวันและตารางสรุปราคารายเดือน อ้างอิงประกาศสมาคมค้าทองคำ`;
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

  const isCurrentYear = config.buddhistYear === CURRENT_YEAR_BE;
  const isFirstYear = config.buddhistYear === FIRST_YEAR_BE;
  const firstAvailableDate =
    isFirstYear && yearRows.length > 0 ? new Date(yearRows[0].priceDate) : null;

  const currentIndex = YEAR_PAGES.findIndex((p) => p.buddhistYear === config.buddhistYear);
  const prevPage = currentIndex > 0 ? YEAR_PAGES[currentIndex - 1] : null;
  const nextPage = currentIndex < YEAR_PAGES.length - 1 ? YEAR_PAGES[currentIndex + 1] : null;

  const path = yearPagePath(config.buddhistYear);

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
