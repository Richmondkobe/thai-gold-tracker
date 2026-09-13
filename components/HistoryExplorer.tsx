"use client";

import { useMemo, useState } from "react";
import { PriceChart } from "@/components/PriceChart";
import { DailyHistoryTable } from "@/components/DailyHistoryTable";
import { formatThaiDateShort, formatThaiPrice } from "@/lib/thai-date";
import { downsampleMonthly, downsampleWeekly } from "@/lib/downsample";
import type { DailyGoldPriceRow } from "@/lib/gold-price-queries";

const RANGES = [
  { key: "30d", label: "30 วัน", days: 30 },
  { key: "90d", label: "90 วัน", days: 90 },
  { key: "1y", label: "1 ปี", days: 365 },
  { key: "5y", label: "5 ปี", days: 1825 },
  { key: "all", label: "ทั้งหมด", days: null },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

const INITIAL_TABLE_ROWS = 30;
const TABLE_LOAD_MORE_STEP = 30;

/**
 * All data (the full history, oldest first) is server-fetched once and
 * passed in as props, so the default (30-day) view is fully present in the
 * server-rendered HTML. Switching ranges only re-slices what's already
 * loaded - no extra network requests.
 *
 * The chart plots a downsampled series for the two long ranges (one point
 * per week for 5 ปี, per month for ทั้งหมด) so it stays fast and readable,
 * but ต่ำสุด/สูงสุด and the table both use the full, non-downsampled daily
 * rows for the selected range - downsampling only affects what gets drawn
 * as the line, never the reported stats or the table's data.
 */
export function HistoryExplorer({ data }: { data: DailyGoldPriceRow[] }) {
  const [rangeKey, setRangeKey] = useState<RangeKey>("30d");
  const [visibleCount, setVisibleCount] = useState(INITIAL_TABLE_ROWS);
  const range = RANGES.find((r) => r.key === rangeKey)!;

  const sliced = range.days === null ? data : data.slice(-range.days);
  const newestFirst = [...sliced].reverse();

  const chartRows = useMemo(() => {
    if (rangeKey === "5y") return downsampleWeekly(sliced);
    if (rangeKey === "all") return downsampleMonthly(sliced);
    return sliced;
  }, [sliced, rangeKey]);

  const extremes = useMemo(() => {
    if (sliced.length === 0) return null;
    let low = sliced[0];
    let high = sliced[0];
    for (const row of sliced) {
      if (row.barSell < low.barSell) low = row;
      if (row.barSell > high.barSell) high = row;
    }
    return { low, high };
  }, [sliced]);

  function handleRangeChange(key: RangeKey) {
    setRangeKey(key);
    setVisibleCount(INITIAL_TABLE_ROWS);
  }

  const visibleRows = newestFirst.slice(0, visibleCount);
  const hasMore = visibleCount < newestFirst.length;

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="ช่วงเวลาราคาทองย้อนหลัง">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => handleRangeChange(r.key)}
            aria-pressed={rangeKey === r.key}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              rangeKey === r.key
                ? "bg-amber-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <PriceChart
          rows={chartRows}
          metric="barSell"
          title={`ราคาทองคำแท่งขายออกย้อนหลัง ${range.label}`}
          hideCaption
        />
        {extremes && (
          <p className="mt-2 flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>
              ต่ำสุด {formatThaiPrice(extremes.low.barSell)} บาท (
              {formatThaiDateShort(new Date(extremes.low.priceDate))})
            </span>
            <span>
              สูงสุด {formatThaiPrice(extremes.high.barSell)} บาท (
              {formatThaiDateShort(new Date(extremes.high.priceDate))})
            </span>
          </p>
        )}
      </div>

      <div className="mt-6">
        <DailyHistoryTable rows={visibleRows} />
        {hasMore && (
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + TABLE_LOAD_MORE_STEP)}
            className="mt-3 w-full rounded-full border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            โหลดเพิ่ม
          </button>
        )}
      </div>
    </div>
  );
}
