// Parsing and planning for GTA price announcements. Pure TypeScript with no
// imports and no Deno/Node APIs, on purpose: it is shared by the fetch-prices
// Edge Function (Deno) and scripts/backfill-history.ts (Node), so the live
// fetcher and the backfill can never disagree about which announcements
// become rows.
//
// Both GTA endpoints return the same row shape:
//   /api/GoldPrices/Latest                        -> one object
//   /api/GoldPricesDaily/pricechanges?StartDate=  -> an array, every
//                                                    announcement in the range
//
// Two facts about that feed that are easy to get wrong (checked against live
// data on 2026-11-22, 1,967 rows from 2026-08-01):
//   1. `priceSeq` is GTA's official per-day announcement number ("ประกาศครั้งที่").
//      `seq` is only the row number within the requested range - the two are
//      equal for a single day and for /Latest, and differ for any longer range.
//   2. The list includes announcements that repeat the previous prices
//      unchanged (18 of the 1,967, mostly the first one on a Sunday). Those
//      never become rows - see planAnnouncements.

export const MIN_SANE_PRICE = 10_000;
export const MAX_SANE_PRICE = 100_000;

export function isSanePrice(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > MIN_SANE_PRICE &&
    value < MAX_SANE_PRICE
  );
}

/** GTA's `asTime` has no timezone suffix (e.g. "2026-08-04T16:15:00") and is Bangkok local time. */
export function parseBangkokTime(asTime: unknown): Date | null {
  if (typeof asTime !== "string") return null;
  const date = new Date(`${asTime}+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/** The Bangkok calendar day ("YYYY-MM-DD") an instant falls on. */
export function bangkokDay(date: Date): string {
  return new Date(date.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

export interface FourPrices {
  barBuy: number;
  barSell: number;
  ornamentBuy: number;
  ornamentSell: number;
}

/** GTA's official tax-base buy prices per baht-weight, by purity. Any of them
 *  can be missing (GTA's 2016 rows have no 80% price). */
export interface PurityBuyPrices {
  buy9999: number | null;
  buy90: number | null;
  buy80: number | null;
  buy50: number | null;
  buy40: number | null;
}

export interface Announcement extends FourPrices {
  /** GTA's announcement time (their asTime). */
  time: Date;
  /** GTA's official per-day announcement number (their priceSeq), if present. */
  seq: number | null;
  purity: PurityBuyPrices;
}

// The purity prices are extra detail, never worth failing a run over: anything
// that isn't a plausible positive number is stored as null instead. (They sit
// well below MIN_SANE_PRICE for low purities, so isSanePrice doesn't apply.)
function optionalPrice(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value < 2 * MAX_SANE_PRICE
    ? value
    : null;
}

function optionalSeq(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value < 10_000
    ? value
    : null;
}

/** One feed row -> an announcement, or null when the four main prices or the
 *  time fail validation (such a row must never be stored). */
export function parseAnnouncement(raw: unknown): Announcement | null {
  if (typeof raw !== "object" || raw === null) return null;
  const row = raw as Record<string, unknown>;

  const barBuy = row.bL_BuyPrice;
  const barSell = row.bL_SellPrice;
  const ornamentBuy = row.oM965_BuyPrice;
  const ornamentSell = row.oM965_SellPrice;
  if (
    !isSanePrice(barBuy) ||
    !isSanePrice(barSell) ||
    !isSanePrice(ornamentBuy) ||
    !isSanePrice(ornamentSell)
  ) {
    return null;
  }

  const time = parseBangkokTime(row.asTime);
  if (!time) return null;

  return {
    time,
    seq: optionalSeq(row.priceSeq),
    barBuy,
    barSell,
    ornamentBuy,
    ornamentSell,
    purity: {
      buy9999: optionalPrice(row.oM9999_BuyPrice),
      buy90: optionalPrice(row.oM90_BuyPrice),
      buy80: optionalPrice(row.oM80_BuyPrice),
      buy50: optionalPrice(row.oM50_BuyPrice),
      buy40: optionalPrice(row.oM40_BuyPrice),
    },
  };
}

export function samePrices(a: FourPrices, b: FourPrices): boolean {
  return (
    a.barBuy === b.barBuy &&
    a.barSell === b.barSell &&
    a.ornamentBuy === b.ornamentBuy &&
    a.ornamentSell === b.ornamentSell
  );
}

/** A later announcement that repeated a price unchanged. */
export interface Reannouncement {
  at: Date;
  seq: number | null;
}

/** An announcement that changed a price, i.e. one gold_prices row. */
export interface PlannedRow {
  announcement: Announcement;
  /** The last announcement after this one that repeated its prices, if any. */
  reannouncement: Reannouncement | null;
}

export interface AnnouncementPlan {
  /** One per price change, oldest first. */
  rows: PlannedRow[];
  /** Set when the list OPENS with announcements repeating the baseline's
   *  prices: the last of those. It belongs on the baseline row. */
  baselineReannouncement: Reannouncement | null;
}

/**
 * Decides which announcements become rows. `baseline` is the price in force
 * just before the first announcement in the list (the stored row before it),
 * or null on an empty table.
 *
 * An announcement whose four prices equal the one before it is NOT a row (it
 * would be a zero-change line in the intraday table and would zero out
 * "เทียบกับประกาศก่อนหน้า"); its time and number are recorded on the row it
 * repeats instead - gold_prices.last_announced_at / last_announced_seq.
 */
export function planAnnouncements(
  announcements: Announcement[],
  baseline: FourPrices | null,
): AnnouncementPlan {
  const sorted = [...announcements].sort((a, b) => a.time.getTime() - b.time.getTime());

  const rows: PlannedRow[] = [];
  let baselineReannouncement: Reannouncement | null = null;
  let previous: FourPrices | null = baseline;
  let previousTimeMs: number | null = null;

  for (const announcement of sorted) {
    // fetched_at is unique: a second announcement at the same instant could
    // never be stored, so it must not take part in the comparison either.
    if (announcement.time.getTime() === previousTimeMs) continue;
    previousTimeMs = announcement.time.getTime();

    if (previous && samePrices(announcement, previous)) {
      const reannouncement = { at: announcement.time, seq: announcement.seq };
      const current = rows[rows.length - 1];
      if (current) current.reannouncement = reannouncement;
      else baselineReannouncement = reannouncement;
      continue;
    }

    rows.push({ announcement, reannouncement: null });
    previous = announcement;
  }

  return { rows, baselineReannouncement };
}

/** The gold_prices columns an announcement fills, minus the re-announcement
 *  pair (callers decide whether those may be written). */
export function priceColumns(announcement: Announcement) {
  return {
    fetched_at: announcement.time.toISOString(),
    bar_buy: announcement.barBuy,
    bar_sell: announcement.barSell,
    ornament_buy: announcement.ornamentBuy,
    ornament_sell: announcement.ornamentSell,
    source: "goldtraders",
    announcement_seq: announcement.seq,
    ornament_buy_9999: announcement.purity.buy9999,
    ornament_buy_90: announcement.purity.buy90,
    ornament_buy_80: announcement.purity.buy80,
    ornament_buy_50: announcement.purity.buy50,
    ornament_buy_40: announcement.purity.buy40,
  };
}

/** A complete row for a NEW insert, including the re-announcement pair. */
export function insertColumns(row: PlannedRow) {
  return {
    ...priceColumns(row.announcement),
    last_announced_at: row.reannouncement ? row.reannouncement.at.toISOString() : null,
    last_announced_seq: row.reannouncement ? row.reannouncement.seq : null,
  };
}
