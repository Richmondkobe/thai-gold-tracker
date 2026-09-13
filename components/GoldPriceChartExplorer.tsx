"use client";

import { useMemo, useState } from "react";
import { PriceChart } from "@/components/PriceChart";
import { subtractYearsFromDateString } from "@/lib/bangkok";
import type { DailyGoldPriceRow, GoldPriceRow } from "@/lib/gold-price-queries";

const RANGES = [
  { key: "1m", label: "1 เดือน", dataset: "intraday" as const, unit: "days" as const, amount: 30 },
  { key: "6m", label: "6 เดือน", dataset: "intraday" as const, unit: "days" as const, amount: 183 },
  { key: "1y", label: "1 ปี", dataset: "daily" as const, unit: "years" as const, amount: 1 },
  { key: "5y", label: "5 ปี", dataset: "daily" as const, unit: "years" as const, amount: 5 },
  { key: "all", label: "ทั้งหมด", dataset: "daily" as const, unit: "all" as const, amount: 0 },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

/**
 * Two datasets are fetched once server-side and passed in as props: recent
 * intraday updates (last 6 months - covers the "1 เดือน"/"6 เดือน" ranges at
 * full granularity) and all-time daily closes (covers "1 ปี"/"5 ปี"/"ทั้งหมด" -
 * ~3,300 rows for the full 10 years, instead of sending all ~16,600 raw
 * intraday rows). Switching ranges only re-filters what's already loaded.
 *
 * "1 ปี"/"5 ปี" filter the daily dataset by exact calendar date (same
 * month/day, N years before the latest row) rather than a fixed N*365-day
 * offset, which would drift by 1-2 days per leap year crossed. "1 เดือน"/
 * "6 เดือน" stay on the finer-grained intraday millisecond cutoff, where a
 * plain day-count is already exact (no year-length ambiguity).
 */
export function GoldPriceChartExplorer({
  intraday,
  daily,
}: {
  intraday: GoldPriceRow[];
  daily: DailyGoldPriceRow[];
}) {
  const [rangeKey, setRangeKey] = useState<RangeKey>("1y");
  const [now] = useState(() => Date.now());
  const range = RANGES.find((r) => r.key === rangeKey)!;

  const rows = useMemo(() => {
    if (range.unit === "all") return daily;

    if (range.dataset === "intraday") {
      const cutoff = now - range.amount * 24 * 60 * 60 * 1000;
      return intraday.filter((row) => row.fetchedAt.getTime() >= cutoff);
    }

    // Only "years" reaches here - "all" returned above, and "days" is only
    // ever paired with the intraday dataset in RANGES.
    const latestDateStr = daily.length > 0 ? daily[daily.length - 1].priceDate : null;
    if (!latestDateStr) return daily;
    const cutoffStr = subtractYearsFromDateString(latestDateStr, range.amount);
    return daily.filter((row) => row.priceDate >= cutoffStr);
  }, [range, intraday, daily, now]);

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="ช่วงเวลากราฟราคาทอง">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setRangeKey(r.key)}
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
          rows={rows}
          metric="barSell"
          title={`ราคาทองคำแท่งขายออกย้อนหลัง ${range.label}`}
        />
      </div>
    </div>
  );
}
