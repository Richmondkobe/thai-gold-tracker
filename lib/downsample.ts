import type { DailyGoldPriceRow } from "@/lib/gold-price-queries";

/**
 * Keeps the last row seen per bucket key. Rows must be ascending by date -
 * a Map preserves each key's first-insertion position, so later same-key
 * `set` calls only update the value, leaving the output in ascending order.
 */
function downsampleByBucket(
  rows: DailyGoldPriceRow[],
  bucketKey: (row: DailyGoldPriceRow) => string,
): DailyGoldPriceRow[] {
  const buckets = new Map<string, DailyGoldPriceRow>();
  for (const row of rows) {
    buckets.set(bucketKey(row), row);
  }
  return [...buckets.values()];
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** One point per week (that week's last available close) - for readable multi-year charts. */
export function downsampleWeekly(rows: DailyGoldPriceRow[]): DailyGoldPriceRow[] {
  return downsampleByBucket(rows, (row) => {
    const weekIndex = Math.floor(new Date(`${row.priceDate}T00:00:00Z`).getTime() / WEEK_MS);
    return String(weekIndex);
  });
}

/** One point per calendar month (that month's last available close) - for the full 10-year "ทั้งหมด" view. */
export function downsampleMonthly(rows: DailyGoldPriceRow[]): DailyGoldPriceRow[] {
  return downsampleByBucket(rows, (row) => row.priceDate.slice(0, 7));
}
