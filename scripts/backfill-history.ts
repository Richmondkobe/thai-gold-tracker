/**
 * One-time historical backfill: fetches every GTA price update from 2016-01-01
 * to today via the same endpoint the "ราคาทองย้อนหลัง" date-range picker on
 * https://www.goldtraders.or.th/updatepricelist calls
 * (/api/GoldPricesDaily/pricechanges?StartDate=...&EndDate=...), and upserts
 * into gold_prices.
 *
 * A single request across the full 10+ year range hangs/times out (tested:
 * 2024-01-01..2026-08-23 returned 0 bytes after 45s), and a full single year
 * already takes ~26s (2026: 3,538 rows). So this chunks by calendar quarter,
 * with a per-request timeout + a delay between requests to avoid hammering
 * their server. Safe to re-run: gold_prices.fetched_at has a unique
 * constraint (see migrations/0004_gold_prices_unique_fetched_at.sql) and
 * this upserts with ignoreDuplicates, so already-inserted rows are skipped
 * rather than erroring or duplicating.
 *
 * Usage: npx tsx scripts/backfill-history.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createAdminClient } from "../lib/supabase/admin";
import { isSanePrice, parseBangkokTime } from "../lib/goldtraders";

const START_DATE = "2016-01-01";
const REQUEST_TIMEOUT_MS = 30_000;
const DELAY_BETWEEN_REQUESTS_MS = 1_500;
const BASE_URL = "https://www.goldtraders.or.th/api/GoldPricesDaily/pricechanges";

const HEADERS = {
  accept: "application/json",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  referer: "https://www.goldtraders.or.th/updatepricelist",
};

interface DateChunk {
  start: string;
  end: string;
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function generateQuarterChunks(startDate: string, endDate: string): DateChunk[] {
  const chunks: DateChunk[] = [];
  const end = new Date(`${endDate}T00:00:00Z`);
  let cursor = new Date(`${startDate}T00:00:00Z`);

  while (cursor <= end) {
    const chunkEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 3, 0));
    const actualEnd = chunkEnd > end ? end : chunkEnd;
    chunks.push({ start: toDateString(cursor), end: toDateString(actualEnd) });
    cursor = new Date(
      Date.UTC(actualEnd.getUTCFullYear(), actualEnd.getUTCMonth(), actualEnd.getUTCDate() + 1),
    );
  }
  return chunks;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface MappedRow {
  fetched_at: string;
  bar_buy: number;
  bar_sell: number;
  ornament_buy: number;
  ornament_sell: number;
  source: string;
}

function mapRow(raw: Record<string, unknown>): MappedRow | null {
  const barBuy = raw.bL_BuyPrice;
  const barSell = raw.bL_SellPrice;
  const ornamentBuy = raw.oM965_BuyPrice;
  const ornamentSell = raw.oM965_SellPrice;

  if (![barBuy, barSell, ornamentBuy, ornamentSell].every(isSanePrice)) return null;

  const fetchedAt = parseBangkokTime(raw.asTime);
  if (!fetchedAt) return null;

  return {
    fetched_at: fetchedAt.toISOString(),
    bar_buy: barBuy as number,
    bar_sell: barSell as number,
    ornament_buy: ornamentBuy as number,
    ornament_sell: ornamentSell as number,
    source: "goldtraders",
  };
}

async function fetchChunk(chunk: DateChunk): Promise<Record<string, unknown>[]> {
  const url = `${BASE_URL}?StartDate=${chunk.start}&EndDate=${chunk.end}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, { headers: HEADERS, signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      throw new Error(`expected array, got ${typeof data}`);
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const today = toDateString(new Date());
  const chunks = generateQuarterChunks(START_DATE, today);
  console.log(`Backfilling ${START_DATE} to ${today} in ${chunks.length} quarterly chunks...`);

  const supabase = createAdminClient();

  let totalFetched = 0;
  let totalInvalid = 0;
  let totalUpserted = 0;
  const failedChunks: DateChunk[] = [];

  for (const [i, chunk] of chunks.entries()) {
    const label = `[${i + 1}/${chunks.length}] ${chunk.start}..${chunk.end}`;
    try {
      const raw = await fetchChunk(chunk);
      totalFetched += raw.length;

      const rows = raw.map(mapRow).filter((r): r is MappedRow => r !== null);
      const invalidCount = raw.length - rows.length;
      totalInvalid += invalidCount;

      if (rows.length > 0) {
        const { error, count } = await supabase
          .from("gold_prices")
          .upsert(rows, { onConflict: "fetched_at", ignoreDuplicates: true, count: "exact" });

        if (error) throw new Error(`upsert failed: ${error.message}`);
        totalUpserted += count ?? 0;
        console.log(
          `${label}: fetched ${raw.length}, invalid ${invalidCount}, upserted ${count ?? "?"}`,
        );
      } else {
        console.log(`${label}: fetched ${raw.length}, invalid ${invalidCount}, nothing to upsert`);
      }
    } catch (err) {
      console.error(`${label}: FAILED - ${err instanceof Error ? err.message : err}`);
      failedChunks.push(chunk);
    }

    await sleep(DELAY_BETWEEN_REQUESTS_MS);
  }

  console.log("\n--- Summary ---");
  console.log(`Total records fetched: ${totalFetched}`);
  console.log(`Skipped (failed sanity check): ${totalInvalid}`);
  console.log(`Newly upserted (excludes already-existing duplicates): ${totalUpserted}`);
  if (failedChunks.length > 0) {
    console.log(`Failed chunks (re-run the script to retry - safe/idempotent):`);
    for (const c of failedChunks) console.log(`  ${c.start}..${c.end}`);
  }
}

main().catch((err) => {
  console.error("backfill-history failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
