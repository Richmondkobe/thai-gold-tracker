import {
  formatThaiDateCompact,
  formatThaiDateTimeCompact,
  formatThaiPercent,
  formatThaiWholeNumber,
} from "@/lib/thai-date";
import type { HistorySummaryStats } from "@/lib/gold-price-queries";

function changeWord(value: number): string {
  if (value > 0) return "เพิ่มขึ้น";
  if (value < 0) return "ลดลง";
  return "ไม่เปลี่ยนแปลง";
}

/** Pure server-rendered sentence - real text in the initial HTML, not fetched client-side. */
export function HistorySummary({ stats }: { stats: HistorySummaryStats | null }) {
  if (!stats) return null;

  return (
    <p className="text-sm text-gray-600 dark:text-gray-400">
      ราคาทองคำแท่งล่าสุด ({formatThaiDateCompact(stats.latestFetchedAt)}) ขายออก{" "}
      {formatThaiWholeNumber(stats.latestPrice)} บาท {changeWord(stats.thirtyDayChange)}{" "}
      {formatThaiWholeNumber(Math.abs(stats.thirtyDayChange))} บาท (
      {formatThaiPercent(stats.thirtyDayChangePercent)}) จาก 30 วันก่อน สูงสุดในรอบ 30 วัน{" "}
      {formatThaiWholeNumber(stats.thirtyDayHigh)} บาท ({formatThaiDateCompact(stats.thirtyDayHighDate)}
      ) ต่ำสุด {formatThaiWholeNumber(stats.thirtyDayLow)} บาท (
      {formatThaiDateCompact(stats.thirtyDayLowDate)}) เมื่อเทียบกับปีที่แล้ว{" "}
      {changeWord(stats.yearChange)} {formatThaiWholeNumber(Math.abs(stats.yearChange))} บาท (
      {formatThaiPercent(stats.yearChangePercent)}) อัปเดตล่าสุด:{" "}
      {formatThaiDateTimeCompact(stats.latestFetchedAt)}
    </p>
  );
}
