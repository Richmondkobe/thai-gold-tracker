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
import { ornamentFaqItems } from "@/lib/faq-content";

export const revalidate = 300;

const TITLE = "ราคาทองรูปพรรณวันนี้ อัปเดตล่าสุด";
const DESCRIPTION =
  "เช็คราคาทองรูปพรรณวันนี้ ทั้งราคารับซื้อ (ฐานภาษี) และราคาขายออก อัปเดตตามประกาศสมาคมค้าทองคำ พร้อมราคาทองคำแท่งเปรียบเทียบ ราคาย้อนหลัง และกราฟราคาทอง 30 วัน";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/gold-ornament-price" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/gold-ornament-price",
  },
};

interface PageData {
  latest: GoldPriceRow[];
  intraday: GoldPriceRow[];
  yesterday: DailyGoldPriceRow | null;
  history: DailyGoldPriceRow[];
}

async function loadData(): Promise<PageData> {
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
      "[gold-ornament-price] failed to load price data:",
      err instanceof Error ? err.message : err,
    );
    return { latest: [], intraday: [], yesterday: null, history: [] };
  }
}

export default async function GoldOrnamentPricePage() {
  const { latest, intraday, yesterday, history } = await loadData();
  const [current, previous] = latest;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 sm:text-3xl">
          ราคาทองรูปพรรณวันนี้
          <span className="mt-1 block text-base font-normal text-gray-500 dark:text-gray-400">
            {formatThaiDateLong(new Date())}
          </span>
        </h1>
      </header>

      {current ? (
        <PriceCard
          latest={current}
          previous={previous ?? null}
          yesterday={yesterday}
          emphasis="ornament"
        />
      ) : (
        <p className="rounded-2xl border border-dashed border-gray-300 p-5 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          ยังไม่มีข้อมูลราคาทองในระบบ กรุณากลับมาตรวจสอบใหม่อีกครั้ง
        </p>
      )}

      <section>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50">
          ราคาทองรูปพรรณระหว่างวันนี้
        </h2>
        <div className="mt-3">
          <IntradayTable rows={intraday} />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50">
          กราฟราคาทองรูปพรรณย้อนหลัง 30 วัน
        </h2>
        <div className="mt-3">
          <PriceChart
            rows={history}
            metric="ornamentSell"
            title="ราคาทองรูปพรรณขายออกย้อนหลัง 30 วัน"
          />
        </div>
        <Link
          href="/history"
          className="mt-2 inline-block text-sm font-medium text-amber-600 hover:underline dark:text-amber-400"
        >
          ดูราคาทองย้อนหลังทั้งหมด →
        </Link>
      </section>

      <FaqSection items={ornamentFaqItems} />

      <footer className="mt-4 border-t border-gray-200 pt-4 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <p>
          ข้อมูลราคาทองคำอ้างอิงจากประกาศของสมาคมค้าทองคำ (goldtraders.or.th)
          ราคาอาจมีการเปลี่ยนแปลงได้ตลอดเวลาทำการ โปรดตรวจสอบราคาล่าสุดก่อนทำธุรกรรม
        </p>
      </footer>
    </main>
  );
}
