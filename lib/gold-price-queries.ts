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

/** Daily closing prices for the last `days` calendar days, oldest first (for charts/tables). */
export async function getDailyHistory(days: number): Promise<DailyGoldPriceRow[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("daily_gold_prices")
    .select("price_date, fetched_at, bar_buy, bar_sell, ornament_buy, ornament_sell")
    .order("price_date", { ascending: false })
    .limit(days);

  if (error) throw new Error(`getDailyHistory failed: ${error.message}`);
  return (data ?? []).map(toDailyRow).reverse();
}
