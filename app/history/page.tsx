import type { Metadata } from "next";
import { getDailyHistory } from "@/lib/gold-price-queries";
import { HistoryExplorer } from "@/components/HistoryExplorer";

export const revalidate = 3600;

const TITLE = "ราคาทองย้อนหลัง ดูราคาทองคำแท่งและทองรูปพรรณย้อนหลัง 30/90/365 วัน";
const DESCRIPTION =
  "ราคาทองย้อนหลังรายวัน ทั้งทองคำแท่งและทองรูปพรรณ พร้อมกราฟราคาทอง เลือกดูย้อนหลังได้ 30 วัน 90 วัน หรือ 1 ปี อ้างอิงประกาศสมาคมค้าทองคำ";

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

async function loadHistory() {
  try {
    return await getDailyHistory(365);
  } catch (err) {
    console.error(
      "[history] failed to load price data:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

export default async function HistoryPage() {
  const history = await loadHistory();

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

      {history.length > 0 ? (
        <HistoryExplorer data={history} />
      ) : (
        <p className="rounded-2xl border border-dashed border-gray-300 p-5 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          ยังไม่มีข้อมูลราคาทองย้อนหลังในระบบ กรุณากลับมาตรวจสอบใหม่อีกครั้ง
        </p>
      )}

      <footer className="mt-4 border-t border-gray-200 pt-4 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <p>
          ข้อมูลราคาทองคำอ้างอิงจากประกาศของสมาคมค้าทองคำ (goldtraders.or.th)
          ราคาปิดรายวันคือราคาประกาศครั้งสุดท้ายของแต่ละวัน
        </p>
      </footer>
    </main>
  );
}
