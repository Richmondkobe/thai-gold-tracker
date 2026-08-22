import type { Metadata } from "next";
import Link from "next/link";
import { formatThaiDateLong } from "@/lib/thai-date";
import {
  getDailyHistory,
  getLatestPrices,
  getTodayIntraday,
  getYesterdayClose,
  type DailyGoldPriceRow,
  type GoldPriceRow,
} from "@/lib/gold-price-queries";
import { PriceCard } from "@/components/PriceCard";
import { IntradayTable } from "@/components/IntradayTable";
import { PriceChart } from "@/components/PriceChart";
import { FaqSection } from "@/components/FaqSection";
import { PriceAlertSignup } from "@/components/PriceAlertSignup";
import { homeFaqItems } from "@/lib/faq-content";

export const revalidate = 300;

const TITLE = "ราคาทองวันนี้ อัปเดตราคาทองคำแท่ง ทองรูปพรรณ ล่าสุด";
const DESCRIPTION =
  "เช็คราคาทองคำแท่งและทองรูปพรรณวันนี้ อัปเดตตามประกาศสมาคมค้าทองคำ พร้อมราคาย้อนหลัง กราฟราคาทอง 30 วัน และตารางราคาระหว่างวัน";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
  },
};

interface HomeData {
  latest: GoldPriceRow[];
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
        <PriceCard latest={current} previous={previous ?? null} yesterday={yesterday} />
      ) : (
        <p className="rounded-2xl border border-dashed border-gray-300 p-5 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          ยังไม่มีข้อมูลราคาทองในระบบ กรุณากลับมาตรวจสอบใหม่อีกครั้ง
        </p>
      )}

      <PriceAlertSignup />

      <section>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50">
          ราคาทองระหว่างวันนี้
        </h2>
        <div className="mt-3">
          <IntradayTable rows={intraday} />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50">
          กราฟราคาทองย้อนหลัง 30 วัน
        </h2>
        <div className="mt-3">
          <PriceChart rows={history} title="ราคาทองคำแท่งขายออกย้อนหลัง 30 วัน" />
        </div>
        <Link
          href="/history"
          className="mt-2 inline-block text-sm font-medium text-amber-600 hover:underline dark:text-amber-400"
        >
          ดูราคาทองย้อนหลังทั้งหมด →
        </Link>
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
