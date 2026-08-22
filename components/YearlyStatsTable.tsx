import {
  formatThaiPercent,
  formatThaiPrice,
  formatThaiWholeNumber,
  toBuddhistYear,
} from "@/lib/thai-date";
import type { YearlyGoldPriceStat } from "@/lib/gold-price-queries";

/** Pure server-rendered table - real markup, present in the initial HTML. */
export function YearlyStatsTable({ stats }: { stats: YearlyGoldPriceStat[] }) {
  if (stats.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        ยังไม่มีข้อมูลสถิติราคาทองรายปี
      </p>
    );
  }

  const currentYear = new Date().getFullYear();
  const firstYear = stats[0].year;
  const hasPartialYears = stats.some(
    (s) => s.year === firstYear || s.year === currentYear,
  );

  return (
    <section aria-labelledby="yearly-stats-heading">
      <h2
        id="yearly-stats-heading"
        className="text-xl font-bold text-gray-900 dark:text-gray-50"
      >
        สถิติราคาทองย้อนหลังรายปี
      </h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        ราคาต่ำสุด สูงสุด และเฉลี่ยของทองคำแท่งขายออกในแต่ละปี (บาทละ)
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800 dark:text-gray-400">
              <th className="py-2 pr-2 font-medium">ปี</th>
              <th className="py-2 pr-2 text-right font-medium">ราคาต่ำสุด</th>
              <th className="py-2 pr-2 text-right font-medium">ราคาสูงสุด</th>
              <th className="py-2 pr-2 text-right font-medium">ราคาเฉลี่ย</th>
              <th className="py-2 text-right font-medium">การเปลี่ยนแปลง</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((row, i) => {
              const previous = i > 0 ? stats[i - 1] : null;
              const pctChange = previous
                ? ((row.avgPrice - previous.avgPrice) / previous.avgPrice) * 100
                : null;
              const isPartialYear = row.year === firstYear || row.year === currentYear;

              return (
                <tr
                  key={row.year}
                  className="border-b border-gray-100 tabular-nums last:border-0 dark:border-gray-900"
                >
                  <td className="py-2 pr-2 text-gray-700 dark:text-gray-300">
                    {toBuddhistYear(row.year)}
                    {isPartialYear && <sup className="ml-0.5">*</sup>}
                  </td>
                  <td className="py-2 pr-2 text-right">{formatThaiPrice(row.minPrice)}</td>
                  <td className="py-2 pr-2 text-right">{formatThaiPrice(row.maxPrice)}</td>
                  <td className="py-2 pr-2 text-right">{formatThaiWholeNumber(row.avgPrice)}</td>
                  <td
                    className={`py-2 text-right font-medium ${
                      pctChange === null
                        ? "text-gray-400 dark:text-gray-500"
                        : pctChange > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : pctChange < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {pctChange === null ? "—" : formatThaiPercent(pctChange)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {hasPartialYears && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          * ข้อมูลปี {toBuddhistYear(firstYear)} เริ่มตั้งแต่วันที่ 2 มกราคม และข้อมูลปี{" "}
          {toBuddhistYear(currentYear)} นับถึงข้อมูลล่าสุด ทั้งสองปีนี้จึงไม่ใช่ข้อมูลเต็มปี
        </p>
      )}
    </section>
  );
}
