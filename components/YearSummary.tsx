import {
  changeWord,
  formatThaiDateCompact,
  formatThaiPercent,
  formatThaiWholeNumber,
} from "@/lib/thai-date";

export interface YearSummaryStats {
  open: number;
  close: number;
  diff: number;
  pct: number;
  high: number;
  highDate: Date;
  low: number;
  lowDate: Date;
}

/** Pure server-rendered sentence - real text in the initial HTML. */
export function YearSummary({
  buddhistYear,
  isCurrentYear,
  firstAvailableDate,
  stats,
}: {
  buddhistYear: number;
  isCurrentYear: boolean;
  /** Set only for the first year in the dataset, to note the partial start. */
  firstAvailableDate: Date | null;
  stats: YearSummaryStats;
}) {
  const closeLabel = isCurrentYear ? "ล่าสุดที่" : "ปิดปีที่";

  return (
    <p className="text-sm text-gray-600 dark:text-gray-400">
      ราคาทองคำแท่งปี {buddhistYear} เปิดปีที่ {formatThaiWholeNumber(stats.open)} บาท{" "}
      {closeLabel} {formatThaiWholeNumber(stats.close)} บาท {changeWord(stats.diff)}{" "}
      {formatThaiWholeNumber(Math.abs(stats.diff))} บาท ({formatThaiPercent(stats.pct)}){" "}
      สูงสุด {formatThaiWholeNumber(stats.high)} บาท ({formatThaiDateCompact(stats.highDate)}){" "}
      ต่ำสุด {formatThaiWholeNumber(stats.low)} บาท ({formatThaiDateCompact(stats.lowDate)})
      {firstAvailableDate && (
        <> (ข้อมูลเริ่มตั้งแต่วันที่ {formatThaiDateCompact(firstAvailableDate)})</>
      )}
    </p>
  );
}
