import type { Metadata } from "next";
import Link from "next/link";
import { formatThaiDateCompact, formatThaiDateLong } from "@/lib/thai-date";
import {
  getDailyHistory,
  getLatestPrices,
  getTodayIntraday,
  getYesterdayClose,
  type DailyGoldPriceRow,
  type GoldPriceRow,
  type LatestGoldPriceRow,
} from "@/lib/gold-price-queries";
import { PriceCard } from "@/components/PriceCard";
import { GoldCalculator } from "@/components/GoldCalculator";
import { WEIGHT_PAGES, weightPagePath } from "@/lib/weight-pages";
import { PROFIT_CALC_PATH } from "@/lib/site";
import { GUIDE_PAGES, guidePagePath } from "@/lib/guide-pages";
import { listMonthPages, monthPagePath } from "@/lib/month-pages";
import { listYearPages, yearPagePath } from "@/lib/year-pages";
import { IntradayTable } from "@/components/IntradayTable";
import { PriceChart } from "@/components/PriceChart";
import { FaqSection } from "@/components/FaqSection";
import { PriceAlertSignup } from "@/components/PriceAlertSignup";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";
import { homeFaqItems } from "@/lib/faq-content";

// 60s so a new announcement shows up about a minute after the fetcher stores
// it (the fetcher itself polls every 2 minutes - see CLAUDE.md "Cron schedule").
// Only the homepage is this aggressive: every regeneration is an ISR write,
// and the other price pages stay at 300s to keep well inside Vercel's free tier.
export const revalidate = 60;

const DESCRIPTION =
  "เช็กราคาทองวันนี้ล่าสุด ทองคำแท่งและทองรูปพรรณ 96.5% ตามประกาศสมาคมค้าทองคำ อัปเดตทุกครั้งที่ราคาเปลี่ยน พร้อมราคาทอง 1 บาท 1 สลึง กราฟย้อนหลัง และแจ้งเตือนราคาฟรี";

// The title carries today's date in Bangkok time (short Thai month, Buddhist
// year), e.g. "ราคาทองวันนี้ 13 พ.ย. 2569 ล่าสุด ...". It is worked out each time
// the page is regenerated - this is still a static ISR page, not a per-request
// one - so the date rolls over with the first regeneration after midnight:
//   - with any traffic, that is within about a minute (revalidate = 60 above);
//   - regardless of traffic, the 00:01 cron (app/api/cron/indexnow) purges the
//     cached page and re-requests it, then checks the new date is in the title.
export function generateMetadata(): Metadata {
  const title = `ราคาทองวันนี้ ${formatThaiDateCompact(new Date())} ล่าสุด ทองคำแท่ง ทองรูปพรรณ อัปเดตทุกครั้ง`;
  return {
    title,
    description: DESCRIPTION,
    alternates: { canonical: "/" },
    openGraph: {
      title,
      description: DESCRIPTION,
      url: "/",
    },
  };
}

const TEXT_LINK_CLASS = "text-amber-600 hover:underline dark:text-amber-400";

interface HomeData {
  latest: LatestGoldPriceRow[];
  intraday: GoldPriceRow[];
  yesterday: DailyGoldPriceRow | null;
  history: DailyGoldPriceRow[];
}

async function loadHomeData(): Promise<HomeData> {
  try {
    const [latest, intraday, yesterday, history] = await Promise.all([
      getLatestPrices(2),
      getTodayIntraday(),
      getYesterdayClose(),
      getDailyHistory(30),
    ]);
    return { latest, intraday, yesterday, history };
  } catch (err) {
    console.error(
      "[home] failed to load price data:",
      err instanceof Error ? err.message : err,
    );
    return { latest: [], intraday: [], yesterday: null, history: [] };
  }
}

export default async function HomePage() {
  const { latest, intraday, yesterday, history } = await loadHomeData();
  const [current, previous] = latest;

  // Links to the month and year pages currently in progress. "Current" follows
  // the newest stored price (not the clock), so they always point at pages
  // that exist - see lib/month-pages.ts.
  const asOf = history.length > 0 ? history[history.length - 1].fetchedAt : current?.fetchedAt;
  const currentMonth = asOf ? listMonthPages(asOf).at(-1) : undefined;
  const currentYear = asOf ? listYearPages(asOf).at(-1) : undefined;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 sm:text-3xl">
          ราคาทองวันนี้
          <span className="mt-1 block text-base font-normal text-gray-500 dark:text-gray-400">
            {formatThaiDateLong(new Date())}
          </span>
        </h1>
      </header>

      {current ? (
        <>
          <PriceCard latest={current} previous={previous ?? null} yesterday={yesterday} />
          <GoldCalculator latest={current} />
          <nav aria-label="ราคาทองรายน้ำหนัก" className="-mt-4">
            <ul className="flex flex-wrap gap-2">
              {WEIGHT_PAGES.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={weightPagePath(p)}
                    className="inline-block rounded-full border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:border-amber-500 hover:text-amber-600 dark:border-gray-700 dark:text-gray-300"
                  >
                    ราคา{p.nameTh}
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href={PROFIT_CALC_PATH}
              className="mt-2 inline-block text-sm font-medium text-amber-600 hover:underline dark:text-amber-400"
            >
              คำนวณกำไรขาดทุนจากทองที่ถืออยู่ →
            </Link>
          </nav>
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-gray-300 p-5 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          ยังไม่มีข้อมูลราคาทองในระบบ กรุณากลับมาตรวจสอบใหม่อีกครั้ง
        </p>
      )}

      <PushNotificationToggle />

      <PriceAlertSignup />

      <section>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50">
          ราคาทองระหว่างวันนี้
        </h2>
        <div className="mt-3">
          <IntradayTable rows={intraday} latest={current ?? null} />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50">
          กราฟราคาทองย้อนหลัง 30 วัน
        </h2>
        <div className="mt-3">
          <PriceChart rows={history} title="ราคาทองคำแท่งขายออกย้อนหลัง 30 วัน" />
        </div>
        <ul className="mt-2 flex flex-col gap-1 text-sm font-medium">
          <li>
            <Link href="/history" className={TEXT_LINK_CLASS}>
              ดูราคาทองย้อนหลังทั้งหมด →
            </Link>
          </li>
          <li>
            <Link href="/gold-price-chart" className={TEXT_LINK_CLASS}>
              กราฟราคาทองย้อนหลัง 1 เดือนถึง 10 ปี →
            </Link>
          </li>
          {currentMonth && (
            <li>
              <Link href={monthPagePath(currentMonth)} className={TEXT_LINK_CLASS}>
                ราคาทองเดือน{currentMonth.monthName} {currentMonth.buddhistYear} →
              </Link>
            </li>
          )}
          {currentYear && (
            <li>
              <Link href={yearPagePath(currentYear.buddhistYear)} className={TEXT_LINK_CLASS}>
                ราคาทองปี {currentYear.buddhistYear} →
              </Link>
            </li>
          )}
        </ul>
      </section>

      <section aria-labelledby="guides-heading">
        <h2 id="guides-heading" className="text-xl font-bold text-gray-900 dark:text-gray-50">
          ความรู้เรื่องทอง
        </h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm font-medium">
          {GUIDE_PAGES.map((guide) => (
            <li key={guide.slug}>
              <Link href={guidePagePath(guide)} className={TEXT_LINK_CLASS}>
                {guide.title} →
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <FaqSection items={homeFaqItems} />

      <footer className="mt-4 border-t border-gray-200 pt-4 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <p>
          ข้อมูลราคาทองคำอ้างอิงจากประกาศของสมาคมค้าทองคำ (goldtraders.or.th)
          ราคาอาจมีการเปลี่ยนแปลงได้ตลอดเวลาทำการ โปรดตรวจสอบราคาล่าสุดก่อนทำธุรกรรม
        </p>
      </footer>
    </main>
  );
}
