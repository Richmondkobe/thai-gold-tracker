import {
  changeWord,
  formatThaiDateCompact,
  formatThaiPercent,
  formatThaiWholeNumber,
} from "@/lib/thai-date";

/** All figures are ทองคำแท่ง ขายออก daily closes - the same rows the chart and table show. */
export interface MonthSummaryStats {
  first: number;
  firstDate: Date;
  last: number;
  lastDate: Date;
  diff: number;
  pct: number;
  high: number;
  highDate: Date;
  low: number;
  lowDate: Date;
  /** Number of GTA price announcements in the month; null if it couldn't be counted. */
  announcements: number | null;
}

/** Pure server-rendered paragraph - real text in the initial HTML. */
export function MonthSummary({
  monthName,
  buddhistYear,
  isCurrentMonth,
  isFirstMonthOfData,
  stats,
}: {
  monthName: string;
  buddhistYear: number;
  isCurrentMonth: boolean;
  /** The dataset's first month starts part-way in - say so rather than imply a full month. */
  isFirstMonthOfData: boolean;
  stats: MonthSummaryStats;
}) {
  return (
    <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
      ราคาทองคำแท่งขายออกเดือน{monthName} {buddhistYear} เริ่มต้นเดือนที่{" "}
      {formatThaiWholeNumber(stats.first)} บาท ({formatThaiDateCompact(stats.firstDate)}){" "}
      {isCurrentMonth ? "ล่าสุดอยู่ที่" : "ปิดเดือนที่"} {formatThaiWholeNumber(stats.last)} บาท (
      {formatThaiDateCompact(stats.lastDate)}){" "}
      {stats.diff === 0 ? (
        <>ไม่เปลี่ยนแปลงจากต้นเดือน</>
      ) : (
        <>
          {changeWord(stats.diff)} {formatThaiWholeNumber(Math.abs(stats.diff))} บาท (
          {formatThaiPercent(stats.pct)})
        </>
      )}{" "}
      ราคาปิดรายวันสูงสุด {formatThaiWholeNumber(stats.high)} บาท (
      {formatThaiDateCompact(stats.highDate)}) ต่ำสุด {formatThaiWholeNumber(stats.low)} บาท (
      {formatThaiDateCompact(stats.lowDate)})
      {stats.announcements !== null && stats.announcements > 0 && (
        <>
          {" "}
          {isCurrentMonth
            ? "ตั้งแต่ต้นเดือนสมาคมค้าทองคำประกาศราคาทองแล้ว"
            : "ตลอดทั้งเดือนสมาคมค้าทองคำประกาศราคาทองรวม"}{" "}
          {formatThaiWholeNumber(stats.announcements)} ครั้ง
        </>
      )}
      {isFirstMonthOfData && (
        <> (ข้อมูลเริ่มตั้งแต่วันที่ {formatThaiDateCompact(stats.firstDate)})</>
      )}
    </p>
  );
}
