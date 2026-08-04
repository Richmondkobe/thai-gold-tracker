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

  const { error: insertError } = await supabase.from("gold_prices").insert({
    fetched_at: fetchedAtIso,
    bar_buy: snapshot.barBuy,
    bar_sell: snapshot.barSell,
    ornament_buy: snapshot.ornamentBuy,
    ornament_sell: snapshot.ornamentSell,
    source: "goldtraders",
  });

  if (insertError) {
    throw new Error(`insert failed: ${insertError.message}`);
  }

  return { status: "inserted", fetchedAt: fetchedAtIso };
}
