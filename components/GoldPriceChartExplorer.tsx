"use client";

import { useMemo, useState } from "react";
import { PriceChart } from "@/components/PriceChart";
import type { DailyGoldPriceRow, GoldPriceRow } from "@/lib/gold-price-queries";

const RANGES = [
  { key: "1m", label: "1 เดือน", days: 30, dataset: "intraday" as const },
  { key: "6m", label: "6 เดือน", days: 183, dataset: "intraday" as const },
  { key: "1y", label: "1 ปี", days: 365, dataset: "daily" as const },
  { key: "5y", label: "5 ปี", days: 1825, dataset: "daily" as const },
  { key: "all", label: "ทั้งหมด", days: null, dataset: "daily" as const },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

/**
 * Two datasets are fetched once server-side and passed in as props: recent
 * intraday updates (last 6 months - covers the "1 เดือน"/"6 เดือน" ranges at
 * full granularity) and all-time daily closes (covers "1 ปี"/"5 ปี"/"ทั้งหมด" -
 * ~3,300 rows for the full 10 years, instead of sending all ~16,600 raw
 * intraday rows). Switching ranges only re-filters what's already loaded.
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
    const source = range.dataset === "intraday" ? intraday : daily;
    if (range.days === null) return source;
    const cutoff = now - range.days * 24 * 60 * 60 * 1000;
    return source.filter((row) => row.fetchedAt.getTime() >= cutoff);
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
