import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { addDays, startOfBangkokDay, toBangkokDateString } from "@/lib/bangkok";

export interface GoldPriceRow {
  fetchedAt: Date;
  barBuy: number;
  barSell: number;
  ornamentBuy: number;
  ornamentSell: number;
}

/** The current price, as returned by getLatestPrices. */
export interface LatestGoldPriceRow extends GoldPriceRow {
  /**
   * Time of the most recent official GTA announcement carrying this price -
   * the "อัปเดตล่าสุด" time to show users. Equals fetchedAt unless GTA has since
   * re-announced the same prices (gold_prices.last_announced_at, migration
   * 0008). Use fetchedAt, not this, for anything about when the price CHANGED
   * (intraday table, charts, change calculations).
   */
  announcedAt: Date;
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

function toLatestRow(
  row: GoldPriceQueryRow & { last_announced_at: string | null },
): LatestGoldPriceRow {
  const base = toRow(row);
  const reannouncedAt = row.last_announced_at ? new Date(row.last_announced_at) : null;
  return {
    ...base,
    // Never earlier than the price's own timestamp, whatever the column holds.
    announcedAt: reannouncedAt && reannouncedAt > base.fetchedAt ? reannouncedAt : base.fetchedAt,
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
export async function getLatestPrices(limit = 2): Promise<LatestGoldPriceRow[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("gold_prices")
    .select("fetched_at, last_announced_at, bar_buy, bar_sell, ornament_buy, ornament_sell")
    .order("fetched_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getLatestPrices failed: ${error.message}`);
  return (data ?? []).map(toLatestRow);
}

/**
 * When the newest stored price took effect - the "as of" date for the month
 * page lists (lib/month-pages.ts), so a month with no price yet is never
 * listed or served. Fails open to the clock: a database hiccup must not make
 * existing pages 404. cache() shares one lookup across a render.
 */
export const getDataAsOfDate = cache(async (): Promise<Date> => {
  try {
    const [latest] = await getLatestPrices(1);
    return latest?.fetchedAt ?? new Date();
  } catch (err) {
    console.error(
      "[gold-price-queries] getDataAsOfDate failed, using the clock:",
      err instanceof Error ? err.message : err,
    );
    return new Date();
  }
});

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

/** The daily close on the given Bangkok date (YYYY-MM-DD), or the most recent
 *  close before it when the market was closed that day. Null when the date
 *  predates the data (history starts 2016-01-02). */
export async function getDailyCloseOnOrBefore(
  date: string,
): Promise<DailyGoldPriceRow | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("daily_gold_prices")
    .select("price_date, fetched_at, bar_buy, bar_sell, ornament_buy, ornament_sell")
    .lte("price_date", date)
    .order("price_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`getDailyCloseOnOrBefore failed: ${error.message}`);
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

/** Daily closing prices for one Gregorian calendar year, oldest first. At most ~366 rows - no pagination ceiling needed. */
export async function getDailyHistoryForYear(gregorianYear: number): Promise<DailyGoldPriceRow[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("daily_gold_prices")
    .select("price_date, fetched_at, bar_buy, bar_sell, ornament_buy, ornament_sell")
    .gte("price_date", `${gregorianYear}-01-01`)
    .lte("price_date", `${gregorianYear}-12-31`)
    .order("price_date", { ascending: true });

  if (error) throw new Error(`getDailyHistoryForYear failed: ${error.message}`);
  return (data ?? []).map(toDailyRow);
}

/** First and last calendar day ("YYYY-MM-DD") of a Gregorian month (1-12). */
function monthDateBounds(gregorianYear: number, month: number): { first: string; last: string } {
  const mm = String(month).padStart(2, "0");
  // Day 0 of the following month is the last day of this one.
  const lastDay = new Date(Date.UTC(gregorianYear, month, 0)).getUTCDate();
  return {
    first: `${gregorianYear}-${mm}-01`,
    last: `${gregorianYear}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

/** Daily closing prices for one Gregorian calendar month (1-12), oldest first. At most 31 rows. */
export async function getDailyHistoryForMonth(
  gregorianYear: number,
  month: number,
): Promise<DailyGoldPriceRow[]> {
  const { first, last } = monthDateBounds(gregorianYear, month);
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("daily_gold_prices")
    .select("price_date, fetched_at, bar_buy, bar_sell, ornament_buy, ornament_sell")
    .gte("price_date", first)
    .lte("price_date", last)
    .order("price_date", { ascending: true });

  if (error) throw new Error(`getDailyHistoryForMonth failed: ${error.message}`);
  return (data ?? []).map(toDailyRow);
}

/**
 * How many price announcements GTA made in one Bangkok calendar month - one
 * gold_prices row per announcement that changed a price. Counted in Postgres
 * (head request), so no rows cross the wire and the ~1000-row cap is moot.
 */
export async function getAnnouncementCountForMonth(
  gregorianYear: number,
  month: number,
): Promise<number> {
  const { first } = monthDateBounds(gregorianYear, month);
  const next = monthDateBounds(month === 12 ? gregorianYear + 1 : gregorianYear, (month % 12) + 1);
  const supabase = createPublicClient();
  const { count, error } = await supabase
    .from("gold_prices")
    .select("fetched_at", { count: "exact", head: true })
    .gte("fetched_at", `${first}T00:00:00+07:00`)
    .lt("fetched_at", `${next.first}T00:00:00+07:00`);

  if (error) throw new Error(`getAnnouncementCountForMonth failed: ${error.message}`);
  return count ?? 0;
}

export interface HistorySummaryStats {
  latestPrice: number;
  /** Latest official announcement time for latestPrice (see LatestGoldPriceRow.announcedAt). */
  latestAnnouncedAt: Date;
  thirtyDayChange: number;
  thirtyDayChangePercent: number;
  thirtyDayHigh: number;
  thirtyDayHighDate: Date;
  thirtyDayLow: number;
  thirtyDayLowDate: Date;
  yearChange: number;
  yearChangePercent: number;
}

/**
 * Powers the live summary paragraph on /history. High/low use the same 30
 * daily closes as HistoryExplorer's default view (getDailyHistory(30)), so
 * the summary and the chart/table always show identical ต่ำสุด/สูงสุด figures.
 * Latest price/timestamp still come from the live intraday feed (a "close"
 * doesn't exist yet for today, so today's own price can't come from there).
 * The 30-day and 1-year baselines both use getDailyCloseOnOrBefore, which
 * already falls back to the nearest earlier trading day when the exact date
 * has no row (weekends/holidays).
 */
export async function getHistorySummaryStats(): Promise<HistorySummaryStats | null> {
  const [latestRows, daily] = await Promise.all([getLatestPrices(1), getDailyHistory(30)]);
  const latest = latestRows[0];
  if (!latest || daily.length === 0) return null;

  let high = daily[0];
  let low = daily[0];
  for (const row of daily) {
    if (row.barSell > high.barSell) high = row;
    if (row.barSell < low.barSell) low = row;
  }
  const highDate = new Date(high.priceDate);
  const lowDate = new Date(low.priceDate);

  const todayStr = toBangkokDateString(latest.announcedAt);
  const [y, m, d] = todayStr.split("-");
  const thirtyDaysAgoStr = toBangkokDateString(addDays(latest.announcedAt, -30));
  const yearAgoStr = `${Number(y) - 1}-${m}-${d}`;

  const [thirtyDayBaseline, yearBaseline] = await Promise.all([
    getDailyCloseOnOrBefore(thirtyDaysAgoStr),
    getDailyCloseOnOrBefore(yearAgoStr),
  ]);

  const thirtyDayChange = thirtyDayBaseline ? latest.barSell - thirtyDayBaseline.barSell : 0;
  const thirtyDayChangePercent = thirtyDayBaseline
    ? (thirtyDayChange / thirtyDayBaseline.barSell) * 100
    : 0;
  const yearChange = yearBaseline ? latest.barSell - yearBaseline.barSell : 0;
  const yearChangePercent = yearBaseline ? (yearChange / yearBaseline.barSell) * 100 : 0;

  return {
    latestPrice: latest.barSell,
    latestAnnouncedAt: latest.announcedAt,
    thirtyDayChange,
    thirtyDayChangePercent,
    thirtyDayHigh: high.barSell,
    thirtyDayHighDate: highDate,
    thirtyDayLow: low.barSell,
    thirtyDayLowDate: lowDate,
    yearChange,
    yearChangePercent,
  };
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
