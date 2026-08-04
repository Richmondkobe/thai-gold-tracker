/**
 * Runs the exact same fetch -> validate -> dedup -> insert path as the cron
 * route, without deploying or waiting for Vercel Cron. Requires .env.local
 * with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set.
 *
 * Usage: npx tsx scripts/backfill-test.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { fetchLatestGoldPrice } from "../lib/goldtraders";
import { insertIfChanged } from "../lib/gold-price-store";
import { createAdminClient } from "../lib/supabase/admin";

async function main() {
  console.log("Fetching latest price from goldtraders.or.th...");
  const snapshot = await fetchLatestGoldPrice();
  console.log("Parsed snapshot:", {
    ...snapshot,
    fetchedAt: snapshot.fetchedAt.toISOString(),
  });

  const supabase = createAdminClient();
  const result = await insertIfChanged(supabase, snapshot);
  console.log("Store result:", result);
}

main().catch((err) => {
  console.error("backfill-test failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
