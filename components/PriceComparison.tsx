import { changeWord, formatThaiChange, formatThaiDateCompact, formatThaiPrice } from "@/lib/thai-date";
import type { DailyGoldPriceRow } from "@/lib/gold-price-queries";

export interface PriceComparisonItem {
  /** Full label, e.g. "เทียบกับเมื่อวาน", "เทียบกับ 7 วันก่อน". */
  label: string;
  /** The daily close being compared against; null when there is no data that far back. */
  reference: DailyGoldPriceRow | null;
}

const percentFormatter = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Pure server-rendered box: today's ทองคำแท่ง ขายออก against earlier daily
 * closes, with the change in baht and percent (green up / red down, the same
 * colours as the rest of the site).
 */
export function PriceComparison({
  currentBarSell,
  items,
}: {
  currentBarSell: number;
  items: PriceComparisonItem[];
}) {
  return (
    <section aria-labelledby="comparison-heading">
      <h2 id="comparison-heading" className="text-xl font-bold text-gray-900 dark:text-gray-50">
        เปรียบเทียบราคาทองวันนี้กับที่ผ่านมา
      </h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        ทองคำแท่งขายออกล่าสุด {formatThaiPrice(currentBarSell)} บาท เทียบกับราคาปิดของวันก่อนหน้า
      </p>
      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map(({ label, reference }) => {
          const diff = reference ? currentBarSell - reference.barSell : null;
          const pct = reference && reference.barSell !== 0 ? (diff! / reference.barSell) * 100 : null;
          const colorClass =
            diff === null || diff === 0
              ? "text-gray-600 dark:text-gray-300"
              : diff > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400";
          const arrow = diff === null || diff === 0 ? "–" : diff > 0 ? "▲" : "▼";
          return (
            <div
              key={label}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <dt className="text-sm text-gray-500 dark:text-gray-400">{label}</dt>
              <dd className="mt-1">
                {diff === null || pct === null ? (
                  <span className="text-sm text-gray-500 dark:text-gray-400">ยังไม่มีข้อมูล</span>
                ) : (
                  <>
                    <span className={`block text-lg font-bold tabular-nums ${colorClass}`}>
                      <span aria-hidden="true">{arrow} </span>
                      <span className="sr-only">{changeWord(diff)} </span>
                      {formatThaiChange(diff)} บาท
                    </span>
                    <span className={`block text-sm font-semibold tabular-nums ${colorClass}`}>
                      {diff > 0 ? "+" : diff < 0 ? "-" : ""}
                      {percentFormatter.format(Math.abs(pct))}%
                    </span>
                    <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                      จาก {formatThaiPrice(reference!.barSell)} บาท (
                      {formatThaiDateCompact(new Date(reference!.priceDate))})
                    </span>
                  </>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
