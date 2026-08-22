import type { Metadata } from "next";
import Link from "next/link";
import {
  getDailyHistory,
  getIntradayHistory,
  type DailyGoldPriceRow,
  type GoldPriceRow,
} from "@/lib/gold-price-queries";
import { GoldPriceChartExplorer } from "@/components/GoldPriceChartExplorer";

export const revalidate = 3600;

const TITLE = "กราฟราคาทองย้อนหลัง ดูแนวโน้มราคาทองคำแท่ง 1 เดือนถึง 10 ปี";
const DESCRIPTION =
  "กราฟราคาทองคำแท่งขายออกย้อนหลัง เลือกดูแนวโน้มราคาทองได้ตั้งแต่ 1 เดือน 6 เดือน 1 ปี 5 ปี จนถึงข้อมูลทั้งหมดตั้งแต่ปี 2559 อ้างอิงประกาศสมาคมค้าทองคำ";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/gold-price-chart" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/gold-price-chart",
  },
};

interface ChartPageData {
  intraday: GoldPriceRow[];
  daily: DailyGoldPriceRow[];
}

async function loadChartData(): Promise<ChartPageData> {
  try {
    const [intraday, daily] = await Promise.all([
      getIntradayHistory(183),
      getDailyHistory(3650),
    ]);
    return { intraday, daily };
  } catch (err) {
    console.error(
      "[gold-price-chart] failed to load price data:",
      err instanceof Error ? err.message : err,
    );
    return { intraday: [], daily: [] };
  }
}

export default async function GoldPriceChartPage() {
  const { intraday, daily } = await loadChartData();
  const hasData = intraday.length >= 2 || daily.length >= 2;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 sm:text-3xl">
          กราฟราคาทองย้อนหลัง
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          แนวโน้มราคาทองคำแท่งขายออก อ้างอิงประกาศสมาคมค้าทองคำ ย้อนหลังตั้งแต่ปี 2559
        </p>
      </header>

      {hasData ? (
        <GoldPriceChartExplorer intraday={intraday} daily={daily} />
      ) : (
        <p className="rounded-2xl border border-dashed border-gray-300 p-5 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          ยังไม่มีข้อมูลราคาทองย้อนหลังในระบบ กรุณากลับมาตรวจสอบใหม่อีกครั้ง
        </p>
      )}

      <p className="text-sm text-gray-600 dark:text-gray-400">
        ต้องการดูราคาปิดรายวันในรูปแบบตาราง พร้อมเลือกช่วง 30/90/365 วัน?{" "}
        <Link href="/history" className="font-medium text-amber-600 hover:underline dark:text-amber-400">
          ดูตารางราคาทองย้อนหลัง →
        </Link>
      </p>

      <footer className="mt-4 border-t border-gray-200 pt-4 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <p>
          ข้อมูลราคาทองคำอ้างอิงจากประกาศของสมาคมค้าทองคำ (goldtraders.or.th)
          กราฟแสดงราคาทองคำแท่งขายออก ราคาอาจมีการเปลี่ยนแปลงได้ตลอดเวลาทำการ
        </p>
      </footer>
    </main>
  );
}
