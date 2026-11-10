import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GoldPriceSnapshot } from "@/lib/goldtraders";

export type InsertResult =
  | { status: "inserted"; fetchedAt: string }
  | {
      status: "skipped";
      reason: "unchanged";
      fetchedAt: string;
      /** True when a newer official announcement time was recorded on the existing row. */
      announcementTimeUpdated: boolean;
    };

/**
 * Inserts a price snapshot unless it's identical (all four prices) to the
 * most recent row already stored, per the standing "no duplicate rows" rule.
 * When it IS identical but comes from a newer GTA announcement, that
 * announcement's time is recorded on the existing row (last_announced_at,
 * migration 0008) so the displayed update time matches the official one.
 * Mirrors supabase/functions/fetch-prices/index.ts - keep the two in step.
 */
export async function insertIfChanged(
  supabase: SupabaseClient,
  snapshot: GoldPriceSnapshot,
): Promise<InsertResult> {
  const { data: latestRow, error: selectError } = await supabase
    .from("gold_prices")
    .select("id, fetched_at, last_announced_at, bar_buy, bar_sell, ornament_buy, ornament_sell")
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
    const lastKnownMs = new Date(latestRow.last_announced_at ?? latestRow.fetched_at).getTime();
    let announcementTimeUpdated = false;
    if (snapshot.fetchedAt.getTime() > lastKnownMs) {
      const { error: stampError } = await supabase
        .from("gold_prices")
        .update({ last_announced_at: fetchedAtIso })
        .eq("id", latestRow.id);
      // Cosmetic only - never fail the run over the display timestamp.
      if (stampError) {
        console.error("[gold-price-store] failed to update last_announced_at:", stampError.message);
      } else {
        announcementTimeUpdated = true;
      }
    }
    return {
      status: "skipped",
      reason: "unchanged",
      fetchedAt: fetchedAtIso,
      announcementTimeUpdated,
    };
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
    return {
      status: "skipped",
      reason: "unchanged",
      fetchedAt: fetchedAtIso,
      announcementTimeUpdated: false,
    };
  }

  return { status: "inserted", fetchedAt: fetchedAtIso };
}
