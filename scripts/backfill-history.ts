/**
 * Historical backfill and repair: fetches every GTA announcement in a date
 * range via the same endpoint the "ราคาทองย้อนหลัง" date-range picker on
 * https://www.goldtraders.or.th/updatepricelist calls
 * (/api/GoldPricesDaily/pricechanges?StartDate=...&EndDate=...), and writes
 * them to gold_prices:
 *
 *   - price changes that are not stored yet are inserted (the live fetcher
 *     misses announcements that come closer together than its polling gap);
 *   - rows that are already stored get GTA's announcement number and official
 *     purity prices filled in (migration 0011), and their four prices are
 *     brought in line with GTA's record;
 *   - announcements that repeat the previous prices unchanged never become
 *     rows; their time and number are recorded on the row they repeat
 *     (last_announced_at / last_announced_seq), exactly as the live fetcher
 *     does - both use supabase/functions/_shared/announcements.ts;
 *   - on every row except the newest one in the table, that pair is set to
 *     what GTA's list says, which also clears wrong values: before the fetcher
 *     read the full list, a price that moved and came back between two polls
 *     (57,150 -> 57,200 -> 57,150) looked like an unchanged repeat and was
 *     recorded as one. The newest row is only ever moved forward, because it
 *     is the one whose announcement time the site displays.
 *
 * It never deletes. Rows that exist here but not in GTA's list (GTA
 * occasionally withdraws an announcement) and the zero-change rows the very
 * first backfill stored before repeats were skipped are left alone.
 *
 * A single request across the full 10+ year range hangs/times out (tested:
 * 2024-01-01..2026-08-23 returned 0 bytes after 45s), and a full single year
 * already takes ~26s (2026: 3,538 rows). So this chunks by three months, with
 * a per-request timeout + a delay between requests to avoid hammering their
 * server. Safe to re-run: everything is keyed on gold_prices.fetched_at
 * (unique, migrations/0004_gold_prices_unique_fetched_at.sql).
 *
 * Usage (needs .env.local with the Supabase URL and service-role key):
 *   npm run backfill-history -- --from=2026-08-01 --dry-run   report only
 *   npm run backfill-history -- --from=2026-08-01             repair since a date
 *   npm run backfill-history                                  everything since 2016
 * Optional: --to=YYYY-MM-DD (default: today, Bangkok time).
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "../lib/supabase/admin";
import {
  type Announcement,
  type FourPrices,
  type Reannouncement,
  bangkokDay,
  insertColumns,
  parseAnnouncement,
  planAnnouncements,
  priceColumns,
  samePrices,
} from "../supabase/functions/_shared/announcements";

const DEFAULT_START_DATE = "2016-01-01";
const REQUEST_TIMEOUT_MS = 30_000;
const DELAY_BETWEEN_REQUESTS_MS = 1_500;
const BASE_URL = "https://www.goldtraders.or.th/api/GoldPricesDaily/pricechanges";
const PAGE_SIZE = 1000;
const UPSERT_BATCH_SIZE = 500;

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

function readDateArg(name: string): string | null {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return null;
  const value = arg.slice(name.length + 3);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())) {
    throw new Error(`--${name} must be a date like 2026-08-01, got "${value}"`);
  }
  return value;
}

async function fetchChunk(chunk: DateChunk): Promise<unknown[]> {
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

interface StoredRow {
  fetched_at: string;
  bar_buy: number | string;
  bar_sell: number | string;
  ornament_buy: number | string;
  ornament_sell: number | string;
}

const STORED_COLUMNS = "fetched_at, bar_buy, bar_sell, ornament_buy, ornament_sell";

function storedPrices(row: StoredRow): FourPrices {
  return {
    barBuy: Number(row.bar_buy),
    barSell: Number(row.bar_sell),
    ornamentBuy: Number(row.ornament_buy),
    ornamentSell: Number(row.ornament_sell),
  };
}

/** The stored row just before `time`: the price the first announcement of a
 *  chunk is compared against. */
async function readBaseline(supabase: SupabaseClient, time: Date): Promise<StoredRow | null> {
  const { data, error } = await supabase
    .from("gold_prices")
    .select(STORED_COLUMNS)
    .lt("fetched_at", time.toISOString())
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`failed to read baseline row: ${error.message}`);
  return data as StoredRow | null;
}

/** Stored rows between two instants (inclusive), keyed by time in ms. */
async function readStored(
  supabase: SupabaseClient,
  from: Date,
  to: Date,
): Promise<Map<number, StoredRow>> {
  const stored = new Map<number, StoredRow>();
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("gold_prices")
      .select(STORED_COLUMNS)
      .gte("fetched_at", from.toISOString())
      .lte("fetched_at", to.toISOString())
      .order("fetched_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`failed to read stored rows: ${error.message}`);
    for (const row of (data ?? []) as StoredRow[]) {
      stored.set(new Date(row.fetched_at).getTime(), row);
    }
    if (!data || data.length < PAGE_SIZE) break;
  }
  return stored;
}

/** Records an unchanged re-announcement on the row it repeats. Only ever moves
 *  the time forward (or adds a missing number to the same announcement).
 *  Returns true when the row was updated. */
async function stampReannouncement(
  supabase: SupabaseClient,
  fetchedAtIso: string,
  reannouncement: Reannouncement,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("gold_prices")
    .select("id, last_announced_at, last_announced_seq")
    .eq("fetched_at", fetchedAtIso)
    .maybeSingle();
  if (error) throw new Error(`failed to read row ${fetchedAtIso}: ${error.message}`);
  if (!data) return false;

  const storedMs = data.last_announced_at ? new Date(data.last_announced_at).getTime() : -Infinity;
  const newMs = reannouncement.at.getTime();
  const fillsSeq =
    newMs === storedMs && data.last_announced_seq === null && reannouncement.seq !== null;
  if (newMs <= storedMs && !fillsSeq) return false;

  const { error: updateError } = await supabase
    .from("gold_prices")
    .update({
      last_announced_at: reannouncement.at.toISOString(),
      last_announced_seq: reannouncement.seq,
    })
    .eq("id", data.id);
  if (updateError) throw new Error(`failed to update row ${fetchedAtIso}: ${updateError.message}`);
  return true;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const startDate = readDateArg("from") ?? DEFAULT_START_DATE;
  const endDate = readDateArg("to") ?? bangkokDay(new Date());
  const chunks = generateQuarterChunks(startDate, endDate);
  console.log(
    `${dryRun ? "DRY RUN (nothing will be written) - " : ""}Backfilling ${startDate} to ${endDate} in ${chunks.length} chunk(s)...`,
  );

  const supabase = createAdminClient();

  // The newest stored row is the one whose announcement time the site shows
  // and the live fetcher keeps current, so its re-announcement pair is never
  // overwritten from here - only moved forward (stampReannouncement).
  const { data: newestStored, error: newestError } = await supabase
    .from("gold_prices")
    .select("fetched_at")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (newestError) throw new Error(`failed to read the newest row: ${newestError.message}`);
  const newestStoredMs = newestStored ? new Date(newestStored.fetched_at).getTime() : null;

  const totals = {
    fetched: 0,
    invalid: 0,
    repeats: 0,
    inserted: 0,
    updated: 0,
    corrected: 0,
    stamped: 0,
  };
  const failedChunks: DateChunk[] = [];

  for (const [i, chunk] of chunks.entries()) {
    const label = `[${i + 1}/${chunks.length}] ${chunk.start}..${chunk.end}`;
    try {
      const raw = await fetchChunk(chunk);
      const announcements = raw
        .map(parseAnnouncement)
        .filter((a): a is Announcement => a !== null);
      const invalid = raw.length - announcements.length;
      totals.fetched += raw.length;
      totals.invalid += invalid;

      if (announcements.length === 0) {
        console.log(`${label}: fetched ${raw.length}, invalid ${invalid}, nothing to store`);
        await sleep(DELAY_BETWEEN_REQUESTS_MS);
        continue;
      }

      const times = announcements.map((a) => a.time.getTime());
      const first = new Date(Math.min(...times));
      const last = new Date(Math.max(...times));

      const baseline = await readBaseline(supabase, first);
      const plan = planAnnouncements(announcements, baseline ? storedPrices(baseline) : null);
      const stored = await readStored(supabase, first, last);

      const missing = plan.rows.filter((r) => !stored.has(r.announcement.time.getTime()));
      const existing = plan.rows.length - missing.length;
      // Stored rows whose four prices differ from GTA's record for that time.
      const corrected = plan.rows.filter((r) => {
        const row = stored.get(r.announcement.time.getTime());
        return row !== undefined && !samePrices(storedPrices(row), r.announcement);
      });
      const repeats = announcements.length - plan.rows.length;

      const isNewestStored = (r: { announcement: Announcement }) =>
        r.announcement.time.getTime() === newestStoredMs;
      const stamps: { fetchedAtIso: string; reannouncement: Reannouncement }[] = plan.rows
        .filter((r) => isNewestStored(r) && r.reannouncement !== null)
        .map((r) => ({
          fetchedAtIso: r.announcement.time.toISOString(),
          reannouncement: r.reannouncement!,
        }));
      if (plan.baselineReannouncement && baseline) {
        stamps.push({
          fetchedAtIso: new Date(baseline.fetched_at).toISOString(),
          reannouncement: plan.baselineReannouncement,
        });
      }

      let stamped = 0;
      if (!dryRun) {
        // Merge-upsert: inserts the missing price changes and fills the
        // announcement number + purity prices on the ones already stored.
        // Two payload shapes, so two calls (PostgREST needs identical keys
        // within one): everything but the newest stored row also gets its
        // re-announcement pair set from GTA's list; the newest stored row's
        // pair is left out of the payload and only moved forward below.
        const payloads = [
          plan.rows.filter((r) => !isNewestStored(r)).map(insertColumns),
          plan.rows.filter(isNewestStored).map((r) => priceColumns(r.announcement)),
        ];
        for (const payload of payloads) {
          for (let start = 0; start < payload.length; start += UPSERT_BATCH_SIZE) {
            const { error } = await supabase
              .from("gold_prices")
              .upsert(payload.slice(start, start + UPSERT_BATCH_SIZE), { onConflict: "fetched_at" });
            if (error) throw new Error(`upsert failed: ${error.message}`);
          }
        }

        for (const stamp of stamps) {
          if (await stampReannouncement(supabase, stamp.fetchedAtIso, stamp.reannouncement)) {
            stamped++;
          }
        }
      }

      totals.repeats += repeats;
      totals.inserted += missing.length;
      totals.updated += existing;
      totals.corrected += corrected.length;
      totals.stamped += dryRun ? stamps.length : stamped;

      console.log(
        `${label}: fetched ${raw.length}, invalid ${invalid}, unchanged repeats ${repeats}, ` +
          `price changes ${plan.rows.length} (${missing.length} new, ${existing} already stored` +
          `${corrected.length > 0 ? `, ${corrected.length} with different stored prices` : ""}), ` +
          `re-announcements on the newest/baseline row ${dryRun ? `${stamps.length} to check` : `${stamped} recorded`}`,
      );
      for (const r of corrected.slice(0, 10)) {
        const row = stored.get(r.announcement.time.getTime())!;
        console.log(
          `    price differs at ${r.announcement.time.toISOString()}: stored bar sell ${row.bar_sell}, GTA ${r.announcement.barSell}`,
        );
      }
    } catch (err) {
      console.error(`${label}: FAILED - ${err instanceof Error ? err.message : err}`);
      failedChunks.push(chunk);
    }

    await sleep(DELAY_BETWEEN_REQUESTS_MS);
  }

  const verb = dryRun ? "would be" : "were";
  console.log("\n--- Summary ---");
  console.log(`Announcements fetched: ${totals.fetched}`);
  console.log(`Skipped (failed sanity check): ${totals.invalid}`);
  console.log(`Unchanged repeats (never stored as rows): ${totals.repeats}`);
  console.log(`Missing price changes that ${verb} inserted: ${totals.inserted}`);
  console.log(`Existing rows that ${verb} updated (number + purity prices): ${totals.updated}`);
  console.log(`  of which had different prices stored: ${totals.corrected}`);
  console.log(
    `Re-announcements on the newest/baseline row ${dryRun ? "to check" : "recorded"}: ${totals.stamped}`,
  );
  if (failedChunks.length > 0) {
    console.log(`Failed chunks (re-run the script to retry - safe/idempotent):`);
    for (const c of failedChunks) console.log(`  ${c.start}..${c.end}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("backfill-history failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
