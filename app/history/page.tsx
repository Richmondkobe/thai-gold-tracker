import type { Metadata } from "next";
import Link from "next/link";
import {
  getDailyHistory,
  getHistorySummaryStats,
  type HistorySummaryStats,
} from "@/lib/gold-price-queries";
import { HistoryExplorer } from "@/components/HistoryExplorer";
import { HistorySummary } from "@/components/HistorySummary";

export const revalidate = 3600;

const TITLE = "ราคาทองย้อนหลัง ดูราคาทองคำแท่งและทองรูปพรรณย้อนหลัง 30 วันถึง 10 ปี";
const DESCRIPTION =
  "ราคาทองย้อนหลังรายวัน ทั้งทองคำแท่งและทองรูปพรรณ พร้อมกราฟราคาทอง เลือกดูย้อนหลังได้ 30 วัน 90 วัน 1 ปี 5 ปี หรือทั้งหมด อ้างอิงประกาศสมาคมค้าทองคำ";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/history" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/history",
  },
};

// Fetches the full history (currently ~3,300 rows, growing by ~365/year) so
// the client-side range toggle can offer 5 ปี / ทั้งหมด, not just 30/90/365
// days. getDailyHistory paginates past PostgREST's ~1000-row response cap.
async function loadHistory() {
  try {
    return await getDailyHistory(36_500);
  } catch (err) {
    console.error(
      "[history] failed to load price data:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

async function loadSummary(): Promise<HistorySummaryStats | null> {
  try {
    return await getHistorySummaryStats();
  } catch (err) {
    console.error(
      "[history] failed to load summary stats:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export default async function HistoryPage() {
  const [history, summary] = await Promise.all([loadHistory(), loadSummary()]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 sm:text-3xl">
          ราคาทองย้อนหลัง
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          ราคาปิดรายวันของทองคำแท่งและทองรูปพรรณ อ้างอิงประกาศสมาคมค้าทองคำ
        </p>
      </header>

      <HistorySummary stats={summary} />

      {history.length > 0 ? (
        <HistoryExplorer data={history} />
      ) : (
        <p className="rounded-2xl border border-dashed border-gray-300 p-5 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          ยังไม่มีข้อมูลราคาทองย้อนหลังในระบบ กรุณากลับมาตรวจสอบใหม่อีกครั้ง
        </p>
      )}

      <p className="text-sm text-gray-600 dark:text-gray-400">
        ต้องการดูกราฟแนวโน้มราคาทองระยะยาว ตั้งแต่ 1 เดือนถึง 10 ปี?{" "}
        <Link
          href="/gold-price-chart"
          className="font-medium text-amber-600 hover:underline dark:text-amber-400"
        >
          ดูกราฟราคาทองย้อนหลัง →
        </Link>
      </p>

      <footer className="mt-4 border-t border-gray-200 pt-4 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <p>
          ข้อมูลราคาทองคำอ้างอิงจากประกาศของสมาคมค้าทองคำ (goldtraders.or.th)
          ราคาปิดรายวันคือราคาประกาศครั้งสุดท้ายของแต่ละวัน
        </p>
      </footer>
    </main>
  );
}
