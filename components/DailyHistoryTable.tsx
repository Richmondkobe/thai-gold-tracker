import { formatThaiDateShort, formatThaiPrice } from "@/lib/thai-date";
import type { DailyGoldPriceRow } from "@/lib/gold-price-queries";

/** Expects rows newest-first. */
export function DailyHistoryTable({ rows }: { rows: DailyGoldPriceRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        ยังไม่มีข้อมูลราคาทองย้อนหลัง
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-800 dark:text-gray-400">
            <th className="py-2 pr-2 font-medium">วันที่</th>
            <th className="py-2 pr-2 text-right font-medium">แท่ง รับซื้อ</th>
            <th className="py-2 pr-2 text-right font-medium">แท่ง ขายออก</th>
            <th className="py-2 pr-2 text-right font-medium">รูปพรรณ รับซื้อ</th>
            <th className="py-2 text-right font-medium">รูปพรรณ ขายออก</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.priceDate}
              className="border-b border-gray-100 tabular-nums last:border-0 dark:border-gray-900"
            >
              <td className="py-2 pr-2 text-gray-700 dark:text-gray-300">
                {formatThaiDateShort(new Date(row.priceDate))}
              </td>
              <td className="py-2 pr-2 text-right">{formatThaiPrice(row.barBuy)}</td>
              <td className="py-2 pr-2 text-right">{formatThaiPrice(row.barSell)}</td>
              <td className="py-2 pr-2 text-right">{formatThaiPrice(row.ornamentBuy)}</td>
              <td className="py-2 text-right">{formatThaiPrice(row.ornamentSell)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
