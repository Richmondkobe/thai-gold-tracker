import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PaperOrder, PaperTrade } from "@/lib/pro/paper";

// Database access for the paper trading account (table paper_trades,
// migration 0012). The table has RLS on and no policies, so only this
// server-side code - through the service-role client - can read or write it.

const TABLE = "paper_trades";
const COLUMNS = "seq, side, baht_weight, price, amount, price_time, created_at";
const PAGE_SIZE = 1000;

/** Postgres: relation does not exist / PostgREST: table not in its schema cache. */
const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]);
/** Postgres unique_violation - here, two trades claiming the same seq. */
const UNIQUE_VIOLATION = "23505";

interface PaperTradeQueryRow {
  seq: number;
  side: "buy" | "sell";
  baht_weight: number | string;
  price: number | string;
  amount: number | string;
  price_time: string;
  created_at: string;
}

function toTrade(row: PaperTradeQueryRow): PaperTrade {
  return {
    seq: row.seq,
    side: row.side,
    bahtWeight: Number(row.baht_weight),
    price: Number(row.price),
    amount: Number(row.amount),
    priceTime: new Date(row.price_time),
    createdAt: new Date(row.created_at),
  };
}

export type PaperTradesResult =
  | { status: "ok"; trades: PaperTrade[] }
  /** The SQL in migration 0012 has not been run yet. */
  | { status: "missing-table" };

/** Every trade, oldest first. Pages through PostgREST's ~1000-row cap. */
export async function listPaperTrades(): Promise<PaperTradesResult> {
  const supabase = createAdminClient();
  const trades: PaperTrade[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(TABLE)
      .select(COLUMNS)
      .order("seq", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      if (MISSING_TABLE_CODES.has(error.code)) return { status: "missing-table" };
      throw new Error(`listPaperTrades failed: ${error.message}`);
    }
    trades.push(...(data as PaperTradeQueryRow[]).map(toTrade));
    if (!data || data.length < PAGE_SIZE) break;
  }

  return { status: "ok", trades };
}

export type InsertPaperTradeResult =
  | { status: "ok" }
  /** Another trade was recorded between reading the account and writing this one. */
  | { status: "conflict" };

/**
 * Records one trade as number `seq`. seq is unique in the table, so if two
 * requests race (a double click, two tabs) only the first is stored and the
 * second gets "conflict" instead of spending the same cash twice.
 */
export async function insertPaperTrade(
  seq: number,
  order: PaperOrder,
  priceTime: Date,
): Promise<InsertPaperTradeResult> {
  const supabase = createAdminClient();
  const { error } = await supabase.from(TABLE).insert({
    seq,
    side: order.side,
    baht_weight: order.bahtWeight,
    price: order.price,
    amount: order.amount,
    price_time: priceTime.toISOString(),
  });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { status: "conflict" };
    throw new Error(`insertPaperTrade failed: ${error.message}`);
  }
  return { status: "ok" };
}

/** Deletes every trade, putting the account back to its starting cash. */
export async function deleteAllPaperTrades(): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from(TABLE).delete().gte("seq", 1);
  if (error) throw new Error(`deleteAllPaperTrades failed: ${error.message}`);
}
