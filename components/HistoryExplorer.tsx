"use client";

import { useState } from "react";
import { PriceChart } from "@/components/PriceChart";
import { DailyHistoryTable } from "@/components/DailyHistoryTable";
import type { DailyGoldPriceRow } from "@/lib/gold-price-queries";

const RANGES = [
  { days: 30, label: "30 วัน" },
  { days: 90, label: "90 วัน" },
  { days: 365, label: "1 ปี" },
] as const;

type RangeDays = (typeof RANGES)[number]["days"];

/**
 * All data (up to 365 days) is server-fetched once and passed in as props,
 * so the default (30-day) view is fully present in the server-rendered HTML.
 * Switching ranges only re-slices the already-loaded array client-side —
 * no extra network requests, no re-render of the page shell.
 */
export function HistoryExplorer({ data }: { data: DailyGoldPriceRow[] }) {
  const [range, setRange] = useState<RangeDays>(30);
  const sliced = data.slice(-range);
  const newestFirst = [...sliced].reverse();

  return (
    <div>
      <div className="flex gap-2" role="group" aria-label="ช่วงเวลาราคาทองย้อนหลัง">
        {RANGES.map((r) => (
          <button
            key={r.days}
            type="button"
            onClick={() => setRange(r.days)}
            aria-pressed={range === r.days}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              range === r.days
                ? "bg-amber-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <PriceChart rows={sliced} metric="barSell" title={`ราคาทองคำแท่งขายออกย้อนหลัง ${range} วัน`} />
      </div>

      <div className="mt-6">
        <DailyHistoryTable rows={newestFirst} />
      </div>
    </div>
  );
}
