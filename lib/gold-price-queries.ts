import { createPublicClient } from "@/lib/supabase/public";
import { addDays, startOfBangkokDay, toBangkokDateString } from "@/lib/bangkok";

export interface GoldPriceRow {
  fetchedAt: Date;
  barBuy: number;
  barSell: number;
  ornamentBuy: number;
  ornamentSell: number;
}

export interface DailyGoldPriceRow {
  priceDate: string;
  fetchedAt: Date;
  barBuy: number;
  barSell: number;
  ornamentBuy: number;
  ornamentSell: number;
}

/** What PriceChart actually needs - satisfied structurally by both GoldPriceRow and DailyGoldPriceRow. */
export interface ChartablePriceRow {
  fetchedAt: Date;
  barSell: number;
  ornamentSell: number;
}

interface GoldPriceQueryRow {
  fetched_at: string;
  bar_buy: number | string;
  bar_sell: number | string;
  ornament_buy: number | string;
  ornament_sell: number | string;
}

interface DailyGoldPriceQueryRow extends GoldPriceQueryRow {
  price_date: string;
}

function toRow(row: GoldPriceQueryRow): GoldPriceRow {
  return {
    fetchedAt: new Date(row.fetched_at),
    barBuy: Number(row.bar_buy),
    barSell: Number(row.bar_sell),
    ornamentBuy: Number(row.ornament_buy),
    ornamentSell: Number(row.ornament_sell),
  };
}

function toDailyRow(row: DailyGoldPriceQueryRow): DailyGoldPriceRow {
  return { priceDate: row.price_date, ...toRow(row) };
}

const MAX_PAGE_SIZE = 1000;

/**
 * Supabase's PostgREST API caps each response at ~1000 rows by default,
 * silently, regardless of an explicit .limit() - confirmed live: requesting
 * 3650 rows from daily_gold_prices (3,319 available) returned only 1000.
 * Pages through with .range() until `maxRows` is hit or data runs out.
 */
async function fetchAllRows<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  maxRows: number,
): Promise<T[]> {
  const results: T[] = [];
  let from = 0;
  while (results.length < maxRows) {
    const to = Math.min(from + MAX_PAGE_SIZE, maxRows) - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    results.push(...data);
    if (data.length < to - from + 1) break;
    from += data.length;
  }
  return results;
}

/** Most recent rows first (index 0 = latest). Used for the price card and its "vs previous update" delta. */
export async function getLatestPrices(limit = 2): Promise<GoldPriceRow[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("gold_prices")
    .select("fetched_at, bar_buy, bar_sell, ornament_buy, ornament_sell")
    .order("fetched_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getLatestPrices failed: ${error.message}`);
  return (data ?? []).map(toRow);
}

/** All of today's updates (Asia/Bangkok), oldest first, for the intraday table. */
export async function getTodayIntraday(): Promise<GoldPriceRow[]> {
  const now = new Date();
  const start = startOfBangkokDay(now);
  const end = addDays(start, 1);

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("gold_prices")
    .select("fetched_at, bar_buy, bar_sell, ornament_buy, ornament_sell")
    .gte("fetched_at", start.toISOString())
    .lt("fetched_at", end.toISOString())
    .order("fetched_at", { ascending: true });

  if (error) throw new Error(`getTodayIntraday failed: ${error.message}`);
  return (data ?? []).map(toRow);
}

/** Yesterday's (Asia/Bangkok) closing price, for the "vs. yesterday" delta. */
export async function getYesterdayClose(): Promise<DailyGoldPriceRow | null> {
  const yesterday = toBangkokDateString(addDays(new Date(), -1));

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("daily_gold_prices")
    .select("price_date, fetched_at, bar_buy, bar_sell, ornament_buy, ornament_sell")
    .eq("price_date", yesterday)
    .maybeSingle();

  if (error) throw new Error(`getYesterdayClose failed: ${error.message}`);
  return data ? toDailyRow(data) : null;
}

/** Every intraday update in the last `days` calendar days, oldest first. Only sane for short windows - use getDailyHistory for anything beyond a few months. */
export async function getIntradayHistory(days: number): Promise<GoldPriceRow[]> {
  const since = addDays(new Date(), -days);
  const supabase = createPublicClient();

  // Ascending order + pagination-by-count would skip the *newest* data once
  // capped at 1000, which is the opposite of what callers want - so this
  // caps at a generous safety ceiling well above any realistic row count
  // for the date-bounded ranges this is actually used for (1-6 months).
  const rows = await fetchAllRows<GoldPriceQueryRow>(
    (from, to) =>
      supabase
        .from("gold_prices")
        .select("fetched_at, bar_buy, bar_sell, ornament_buy, ornament_sell")
        .gte("fetched_at", since.toISOString())
        .order("fetched_at", { ascending: true })
        .range(from, to),
    50_000,
  );
  return rows.map(toRow);
}

/** Daily closing prices for the last `days` calendar days, oldest first (for charts/tables). */
export async function getDailyHistory(days: number): Promise<DailyGoldPriceRow[]> {
  const supabase = createPublicClient();
  const rows = await fetchAllRows<DailyGoldPriceQueryRow>(
    (from, to) =>
      supabase
        .from("daily_gold_prices")
        .select("price_date, fetched_at, bar_buy, bar_sell, ornament_buy, ornament_sell")
        .order("price_date", { ascending: false })
        .range(from, to),
    days,
  );
  return rows.map(toDailyRow).reverse();
}

export interface YearlyGoldPriceStat {
  /** Gregorian year - convert with toBuddhistYear() for display. */
  year: number;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
}

/** Per-year min/max/avg of bar_sell, oldest first. Aggregated in Postgres (yearly_gold_price_stats view) - only ~11 rows, no pagination needed. */
export async function getYearlyStats(): Promise<YearlyGoldPriceStat[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("yearly_gold_price_stats")
    .select("year, min_price, max_price, avg_price")
    .order("year", { ascending: true });

  if (error) throw new Error(`getYearlyStats failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    year: row.year,
    minPrice: Number(row.min_price),
    maxPrice: Number(row.max_price),
    avgPrice: Number(row.avg_price),
  }));
}
