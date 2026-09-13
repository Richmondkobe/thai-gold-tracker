import {
  changeWord,
  formatThaiChange,
  formatThaiMonthName,
  formatThaiPercent,
  formatThaiPrice,
} from "@/lib/thai-date";
import type { MonthlyStat } from "@/lib/monthly-stats";

/** Pure server-rendered table. */
export function MonthlyStatsTable({ stats }: { stats: MonthlyStat[] }) {
  if (stats.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        ยังไม่มีข้อมูลราคาทองรายเดือนสำหรับปีนี้
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800 dark:text-gray-400">
            <th className="py-2 pr-2 font-medium">เดือน</th>
            <th className="py-2 pr-2 text-right font-medium">เปิด</th>
            <th className="py-2 pr-2 text-right font-medium">ปิด</th>
            <th className="py-2 pr-2 text-right font-medium">สูงสุด</th>
            <th className="py-2 pr-2 text-right font-medium">ต่ำสุด</th>
            <th className="py-2 text-right font-medium">เปลี่ยนแปลง</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => {
            const word = changeWord(s.changeBaht);
            const colorClass =
              s.changeBaht > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : s.changeBaht < 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-gray-500 dark:text-gray-400";
            return (
              <tr
                key={s.month}
                className="border-b border-gray-100 tabular-nums last:border-0 dark:border-gray-900"
              >
                <td className="py-2 pr-2 text-gray-700 dark:text-gray-300">
                  {formatThaiMonthName(s.month)}
                </td>
                <td className="py-2 pr-2 text-right">{formatThaiPrice(s.open)}</td>
                <td className="py-2 pr-2 text-right">{formatThaiPrice(s.close)}</td>
                <td className="py-2 pr-2 text-right">{formatThaiPrice(s.high)}</td>
                <td className="py-2 pr-2 text-right">{formatThaiPrice(s.low)}</td>
                <td className={`py-2 text-right font-medium ${colorClass}`}>
                  <span className="sr-only">{word} </span>
                  {formatThaiChange(s.changeBaht)} ({formatThaiPercent(s.changePercent)})
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
