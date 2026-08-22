import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GoldPriceSnapshot } from "@/lib/goldtraders";

export type InsertResult =
  | { status: "inserted"; fetchedAt: string }
  | { status: "skipped"; reason: "unchanged"; fetchedAt: string };

/**
 * Inserts a price snapshot unless it's identical (all four prices) to the
 * most recent row already stored, per the standing "no duplicate rows" rule.
 */
export async function insertIfChanged(
  supabase: SupabaseClient,
  snapshot: GoldPriceSnapshot,
): Promise<InsertResult> {
  const { data: latestRow, error: selectError } = await supabase
    .from("gold_prices")
    .select("bar_buy, bar_sell, ornament_buy, ornament_sell")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selectError) {
    throw new Error(`failed to read latest row: ${selectError.message}`);
  }

  const fetchedAtIso = snapshot.fetchedAt.toISOString();

  if (
    latestRow &&
    Number(latestRow.bar_buy) === snapshot.barBuy &&
    Number(latestRow.bar_sell) === snapshot.barSell &&
    Number(latestRow.ornament_buy) === snapshot.ornamentBuy &&
    Number(latestRow.ornament_sell) === snapshot.ornamentSell
  ) {
    return { status: "skipped", reason: "unchanged", fetchedAt: fetchedAtIso };
  }

  // Upsert, not plain insert: gold_prices.fetched_at has a unique constraint
  // (migrations/0004_gold_prices_unique_fetched_at.sql), shared with the
  // fetch-prices Edge Function and scripts/backfill-history.ts.
  const { error: upsertError, count } = await supabase
    .from("gold_prices")
    .upsert(
      {
        fetched_at: fetchedAtIso,
        bar_buy: snapshot.barBuy,
        bar_sell: snapshot.barSell,
        ornament_buy: snapshot.ornamentBuy,
        ornament_sell: snapshot.ornamentSell,
        source: "goldtraders",
      },
      { onConflict: "fetched_at", ignoreDuplicates: true, count: "exact" },
    );

  if (upsertError) {
    throw new Error(`upsert failed: ${upsertError.message}`);
  }

  if (!count || count === 0) {
    return { status: "skipped", reason: "unchanged", fetchedAt: fetchedAtIso };
  }

  return { status: "inserted", fetchedAt: fetchedAtIso };
}
