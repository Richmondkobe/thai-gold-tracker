// Deno edge function - runs on Supabase's infrastructure (not Vercel), scheduled via
// pg_cron. This exists because Vercel's serverless IPs get a Cloudflare JS challenge
// from goldtraders.or.th ("Just a moment..." interstitial) that no header tweaking can
// pass; Supabase Edge Functions run on different infrastructure and aren't challenged.
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically by the Supabase
// Edge Functions runtime - no need to set them manually. CRON_SECRET must be set via
// `supabase secrets set CRON_SECRET=...` or the Dashboard's Edge Functions > Secrets tab.

import { createClient } from "npm:@supabase/supabase-js@2";

const LATEST_URL =
  "https://www.goldtraders.or.th/api/GoldPrices/Latest?readjson=false";

const MIN_SANE_PRICE = 10_000;
const MAX_SANE_PRICE = 100_000;

function isSanePrice(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > MIN_SANE_PRICE &&
    value < MAX_SANE_PRICE
  );
}

// GTA's `asTime` field has no timezone suffix (e.g. "2026-08-04T16:15:00") and is Bangkok local time.
function parseBangkokTime(asTime: unknown): Date | null {
  if (typeof asTime !== "string") return null;
  const date = new Date(`${asTime}+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const response = await fetch(LATEST_URL, {
      headers: { accept: "application/json" },
    });

    if (!response.ok) {
      const bodySnippet = (await response.text().catch(() => "")).slice(0, 300);
      throw new Error(`goldtraders API returned HTTP ${response.status}: ${bodySnippet}`);
    }

    const raw = await response.json();
    const barBuy = raw.bL_BuyPrice;
    const barSell = raw.bL_SellPrice;
    const ornamentBuy = raw.oM965_BuyPrice;
    const ornamentSell = raw.oM965_SellPrice;

    const prices = { barBuy, barSell, ornamentBuy, ornamentSell };
    const invalid = Object.entries(prices).filter(([, v]) => !isSanePrice(v));
    if (invalid.length > 0) {
      throw new Error(
        `parsed prices failed sanity check (expected ${MIN_SANE_PRICE}-${MAX_SANE_PRICE}): ${JSON.stringify(prices)}`,
      );
    }

    const fetchedAt = parseBangkokTime(raw.asTime);
    if (!fetchedAt) {
      throw new Error(`missing/invalid asTime: ${JSON.stringify(raw.asTime)}`);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: latestRow, error: selectError } = await supabase
      .from("gold_prices")
      .select("bar_buy, bar_sell, ornament_buy, ornament_sell")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (selectError) throw new Error(`failed to read latest row: ${selectError.message}`);

    const fetchedAtIso = fetchedAt.toISOString();

    if (
      latestRow &&
      Number(latestRow.bar_buy) === barBuy &&
      Number(latestRow.bar_sell) === barSell &&
      Number(latestRow.ornament_buy) === ornamentBuy &&
      Number(latestRow.ornament_sell) === ornamentSell
    ) {
      return new Response(
        JSON.stringify({ status: "skipped", reason: "unchanged", fetchedAt: fetchedAtIso }),
        { headers: { "content-type": "application/json" } },
      );
    }

    const { error: insertError } = await supabase.from("gold_prices").insert({
      fetched_at: fetchedAtIso,
      bar_buy: barBuy,
      bar_sell: barSell,
      ornament_buy: ornamentBuy,
      ornament_sell: ornamentSell,
      source: "goldtraders",
    });

    if (insertError) throw new Error(`insert failed: ${insertError.message}`);

    return new Response(
      JSON.stringify({ status: "inserted", fetchedAt: fetchedAtIso }),
      { headers: { "content-type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[fetch-prices]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
