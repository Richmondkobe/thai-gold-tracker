import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { toBangkokDateString } from "@/lib/bangkok";
import {
  formatThaiAmount,
  formatThaiDateCompact,
  formatThaiDateLong,
  formatThaiTime,
} from "@/lib/thai-date";
import type { OfficialPurityBuy } from "@/lib/gold-price-queries";
import {
  getReportPageByDate,
  isReportDate,
  reportDateAsInstant,
  type ReportPageConfig,
} from "@/lib/report-pages";

// Everything the daily report page (/รายงานราคาทอง/...) shows, worked out from
// gold_prices alone. Three layers, kept apart so the arithmetic and the Thai
// wording can be tested without a database:
//   loadDailyReport  - the queries
//   buildDailyReport - pure: rows -> the day's figures
//   buildReport*     - pure: figures -> Thai text (summary, share text, meta)
//
// What a "day" is: a Bangkok calendar day with at least one gold_prices row,
// i.e. at least one announcement that CHANGED a price - the same days the
// daily_gold_prices view (and so the month tables) list. A day on which GTA
// only repeated the previous prices has no row and therefore no report.
//
// Repeats inside a day: an announcement that repeats the previous prices never
// has a row; its time and number sit on the row it repeats
// (last_announced_at / last_announced_seq, see CLAUDE.md "Official announcement
// time"). Only the LAST repeat of a row is kept, so the report lists the
// repeats it knows about and never claims the list is every announcement -
// the count it states is the number of price changes, which is exact.

export interface ReportPrices {
  barBuy: number;
  barSell: number;
  ornamentBuy: number;
  ornamentSell: number;
}

/** One gold_prices row, with the announcement columns from migrations 0008 and 0011. */
export interface StoredAnnouncementRow extends ReportPrices {
  fetchedAt: Date;
  announcementSeq: number | null;
  lastAnnouncedAt: Date | null;
  lastAnnouncedSeq: number | null;
  purity: OfficialPurityBuy | null;
}

/** One line of the report's announcement table. */
export interface ReportAnnouncement extends ReportPrices {
  /** GTA's official number for the day ("ประกาศครั้งที่"); null when not recorded. */
  seq: number | null;
  time: Date;
  /** ทองคำแท่ง ขายออก against the announcement before it; null when there is none. */
  change: number | null;
  /** True when GTA repeated the previous prices (no price row of its own). */
  unchanged: boolean;
}

export interface DailyReport {
  /** Bangkok calendar day, "YYYY-MM-DD". */
  date: string;
  /** Oldest first: every price change, plus the unchanged repeats that are known. */
  announcements: ReportAnnouncement[];
  /** Announcements that changed a price (= rows stored for the day). Exact. */
  priceChanges: number;
  /** Official numbers of the first and last price change; null when not recorded. */
  firstSeq: number | null;
  lastSeq: number | null;
  /** The day's first announcement. */
  open: ReportPrices & { time: Date };
  /** The last price of the day, and when it was set. */
  close: ReportPrices & { time: Date };
  /** ทองคำแท่ง ขายออก extremes among the day's announcements (first occurrence). */
  high: { price: number; time: Date };
  low: { price: number; time: Date };
  /** The last price before this day began = the previous trading day's close. */
  previousClose: (ReportPrices & { date: string }) | null;
  /** close minus previousClose for each price; null without a previous close. */
  changes: ReportPrices | null;
  /** ทองคำแท่ง ขายออก change against the previous close, in percent. */
  changePercent: number | null;
  /** GTA's official purity buy prices at the close; null when not stored. */
  purity: OfficialPurityBuy | null;
  firstAnnouncedAt: Date;
  lastAnnouncedAt: Date;
}

function pricesOf(row: ReportPrices): ReportPrices {
  return {
    barBuy: row.barBuy,
    barSell: row.barSell,
    ornamentBuy: row.ornamentBuy,
    ornamentSell: row.ornamentSell,
  };
}

/** [start, end) of a Bangkok calendar day as instants. */
function dayBounds(date: string): { start: Date; end: Date } {
  const start = new Date(`${date}T00:00:00+07:00`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

/**
 * The day's figures from its stored rows (oldest first) and `carried`, the
 * last row stored before the day began. Null when the day has no rows.
 */
export function buildDailyReport(
  date: string,
  storedRows: StoredAnnouncementRow[],
  carried: StoredAnnouncementRow | null,
): DailyReport | null {
  if (storedRows.length === 0) return null;

  // Every announcement in GTA's own record has an official number. A row
  // without one, on a day whose other rows have theirs, is a price GTA later
  // withdrew (it was live when the fetcher saw it, and is gone from GTA's
  // list - e.g. 2026-11-18 09:30). A report is the official record of the
  // day, so such a row is left out: counted, it would give "25 changes between
  // announcements 1 and 24" and could even be the day's high. If NO row has a
  // number (data from before the numbers were stored), everything is kept.
  const numbered = storedRows.filter((row) => row.announcementSeq !== null);
  const rows = numbered.length > 0 ? numbered : storedRows;
  const { start, end } = dayBounds(date);
  const inDay = (time: Date) => time >= start && time < end;

  const announcements: ReportAnnouncement[] = [];

  // The day can open with an announcement that repeats the previous close. It
  // has no row; it is recorded on the carried row.
  if (carried?.lastAnnouncedAt && inDay(carried.lastAnnouncedAt) && carried.lastAnnouncedAt < rows[0].fetchedAt) {
    announcements.push({
      ...pricesOf(carried),
      seq: carried.lastAnnouncedSeq,
      time: carried.lastAnnouncedAt,
      change: 0,
      unchanged: true,
    });
  }

  let previousSell = carried ? carried.barSell : null;
  rows.forEach((row, i) => {
    announcements.push({
      ...pricesOf(row),
      seq: row.announcementSeq,
      time: row.fetchedAt,
      change: previousSell === null ? null : row.barSell - previousSell,
      unchanged: false,
    });
    previousSell = row.barSell;

    // A later announcement that repeated this row's prices - only if it falls
    // on this day and before the next price change.
    const next = rows[i + 1];
    const repeatedAt = row.lastAnnouncedAt;
    if (
      repeatedAt &&
      repeatedAt > row.fetchedAt &&
      inDay(repeatedAt) &&
      (!next || repeatedAt < next.fetchedAt)
    ) {
      announcements.push({
        ...pricesOf(row),
        seq: row.lastAnnouncedSeq,
        time: repeatedAt,
        change: 0,
        unchanged: true,
      });
    }
  });

  const first = announcements[0];
  const lastRow = rows[rows.length - 1];
  let high = first;
  let low = first;
  for (const a of announcements) {
    if (a.barSell > high.barSell) high = a;
    if (a.barSell < low.barSell) low = a;
  }

  const changes = carried
    ? {
        barBuy: lastRow.barBuy - carried.barBuy,
        barSell: lastRow.barSell - carried.barSell,
        ornamentBuy: lastRow.ornamentBuy - carried.ornamentBuy,
        ornamentSell: lastRow.ornamentSell - carried.ornamentSell,
      }
    : null;

  return {
    date,
    announcements,
    priceChanges: rows.length,
    firstSeq: rows[0].announcementSeq,
    lastSeq: lastRow.announcementSeq,
    open: { ...pricesOf(first), time: first.time },
    close: { ...pricesOf(lastRow), time: lastRow.fetchedAt },
    high: { price: high.barSell, time: high.time },
    low: { price: low.barSell, time: low.time },
    previousClose: carried
      ? { ...pricesOf(carried), date: toBangkokDateString(carried.fetchedAt) }
      : null,
    changes,
    changePercent:
      changes && carried && carried.barSell !== 0 ? (changes.barSell / carried.barSell) * 100 : null,
    purity: lastRow.purity,
    firstAnnouncedAt: first.time,
    lastAnnouncedAt: announcements[announcements.length - 1].time,
  };
}

// ---------------------------------------------------------------------------
// Queries

interface AnnouncementQueryRow {
  fetched_at: string;
  last_announced_at: string | null;
  announcement_seq: number | null;
  last_announced_seq: number | null;
  bar_buy: number | string;
  bar_sell: number | string;
  ornament_buy: number | string;
  ornament_sell: number | string;
  ornament_buy_9999: number | string | null;
  ornament_buy_90: number | string | null;
  ornament_buy_80: number | string | null;
  ornament_buy_50: number | string | null;
  ornament_buy_40: number | string | null;
}

const ANNOUNCEMENT_COLUMNS =
  "fetched_at, last_announced_at, announcement_seq, last_announced_seq, " +
  "bar_buy, bar_sell, ornament_buy, ornament_sell, " +
  "ornament_buy_9999, ornament_buy_90, ornament_buy_80, ornament_buy_50, ornament_buy_40";

function toNullableNumber(value: number | string | null): number | null {
  return value === null ? null : Number(value);
}

function toStoredRow(row: AnnouncementQueryRow): StoredAnnouncementRow {
  const purity: OfficialPurityBuy = {
    buy9999: toNullableNumber(row.ornament_buy_9999),
    buy90: toNullableNumber(row.ornament_buy_90),
    buy80: toNullableNumber(row.ornament_buy_80),
    buy50: toNullableNumber(row.ornament_buy_50),
    buy40: toNullableNumber(row.ornament_buy_40),
  };
  return {
    fetchedAt: new Date(row.fetched_at),
    announcementSeq: row.announcement_seq,
    lastAnnouncedAt: row.last_announced_at ? new Date(row.last_announced_at) : null,
    lastAnnouncedSeq: row.last_announced_seq,
    barBuy: Number(row.bar_buy),
    barSell: Number(row.bar_sell),
    ornamentBuy: Number(row.ornament_buy),
    ornamentSell: Number(row.ornament_sell),
    purity: Object.values(purity).some((value) => value !== null) ? purity : null,
  };
}

export interface LoadedDailyReport {
  /** Null when the day has no price rows (no report exists for it). */
  report: DailyReport | null;
  /** The neighbouring days that have a report; null at either end. */
  previous: ReportPageConfig | null;
  next: ReportPageConfig | null;
}

/**
 * Loads one day's report. THROWS when the database can't be read - callers
 * must tell "no report for this day" (report: null -> 404) apart from "lookup
 * failed" (keep the page up). cache() shares one set of queries between
 * generateMetadata and the page within a render.
 */
export const loadDailyReport = cache(async (date: string): Promise<LoadedDailyReport> => {
  const { start, end } = dayBounds(date);
  const supabase = createPublicClient();

  // A day has at most a few hundred announcements (the busiest so far: 90),
  // well under PostgREST's ~1000-row response cap.
  const [dayResult, carriedResult, nextResult] = await Promise.all([
    supabase
      .from("gold_prices")
      .select(ANNOUNCEMENT_COLUMNS)
      .gte("fetched_at", start.toISOString())
      .lt("fetched_at", end.toISOString())
      .order("fetched_at", { ascending: true }),
    supabase
      .from("gold_prices")
      .select(ANNOUNCEMENT_COLUMNS)
      .lt("fetched_at", start.toISOString())
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("gold_prices")
      .select("fetched_at")
      .gte("fetched_at", end.toISOString())
      .order("fetched_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (dayResult.error) throw new Error(`loadDailyReport failed: ${dayResult.error.message}`);
  if (carriedResult.error) throw new Error(`loadDailyReport failed: ${carriedResult.error.message}`);
  if (nextResult.error) throw new Error(`loadDailyReport failed: ${nextResult.error.message}`);

  const rows = ((dayResult.data ?? []) as unknown as AnnouncementQueryRow[]).map(toStoredRow);
  const carried = carriedResult.data
    ? toStoredRow(carriedResult.data as unknown as AnnouncementQueryRow)
    : null;
  const report = buildDailyReport(date, rows, carried);

  const previousDate = carried ? toBangkokDateString(carried.fetchedAt) : null;
  const nextDate = nextResult.data
    ? toBangkokDateString(new Date((nextResult.data as { fetched_at: string }).fetched_at))
    : null;

  return {
    report,
    previous: previousDate && isReportDate(previousDate) ? getReportPageByDate(previousDate) : null,
    next: nextDate ? getReportPageByDate(nextDate) : null,
  };
});

// ---------------------------------------------------------------------------
// Thai text. Templates filled from the figures above and nothing else: no
// reasons, no outlook, no adjectives about the market. If a sentence cannot be
// backed by a number in DailyReport, it does not belong here.

/** "0.78" - an unsigned percentage with two decimals. */
function formatPercentMagnitude(value: number): string {
  return Math.abs(value).toFixed(2);
}

function dateOfDay(date: string): Date {
  return new Date(`${date}T12:00:00+07:00`);
}

/** Whether the report's day is still in progress (today, Bangkok time). */
export function isReportInProgress(report: DailyReport, now: Date = new Date()): boolean {
  return report.date === toBangkokDateString(now);
}

/** "เพิ่มขึ้น 450 บาท (ร้อยละ 0.78)" / "ลดลง ..." / null when flat or unknown. */
function movementPhrase(report: DailyReport): string | null {
  const change = report.changes?.barSell ?? null;
  if (change === null || change === 0) return null;
  const word = change > 0 ? "เพิ่มขึ้น" : "ลดลง";
  const percent =
    report.changePercent !== null ? ` (ร้อยละ ${formatPercentMagnitude(report.changePercent)})` : "";
  return `${word} ${formatThaiAmount(Math.abs(change))} บาท${percent}`;
}

/**
 * The summary paragraph at the top of the report. `inProgress` switches the
 * wording from a finished day ("ปิดที่") to one still running ("ราคาล่าสุด").
 */
export function buildReportSummary(report: DailyReport, inProgress: boolean): string {
  const day = formatThaiDateLong(dateOfDay(report.date));
  const sentences: string[] = [];

  const count = report.priceChanges;
  let numbers = "";
  if (report.firstSeq !== null && report.lastSeq !== null) {
    numbers =
      count === 1
        ? ` (ประกาศครั้งที่ ${report.lastSeq})`
        : ` ระหว่างประกาศครั้งที่ ${report.firstSeq} ถึงครั้งที่ ${report.lastSeq}`;
  }
  sentences.push(
    inProgress
      ? `${day} จนถึงเวลา ${formatThaiTime(report.lastAnnouncedAt)} สมาคมค้าทองคำประกาศปรับราคาทองแล้ว ${count} ครั้ง${numbers}`
      : `${day} สมาคมค้าทองคำประกาศปรับราคาทอง ${count} ครั้ง${numbers}`,
  );

  const flat = report.high.price === report.low.price;
  const close = formatThaiAmount(report.close.barSell);
  let priceSentence = flat
    ? `ทองคำแท่งขายออกอยู่ที่ ${close} บาท${inProgress ? "ตลอดช่วงที่ผ่านมาของวัน" : "ตลอดทั้งวัน"}`
    : `ทองคำแท่งขายออกเปิดที่ ${formatThaiAmount(report.open.barSell)} บาท ${inProgress ? "และราคาล่าสุดอยู่ที่" : "และปิดที่"} ${close} บาท`;

  if (report.previousClose && report.changes) {
    const previousDay = formatThaiDateCompact(dateOfDay(report.previousClose.date));
    const movement = movementPhrase(report);
    priceSentence += movement
      ? ` ${movement} จากราคาปิดของวันทำการก่อนหน้า (${previousDay}) ซึ่งอยู่ที่ ${formatThaiAmount(report.previousClose.barSell)} บาท`
      : ` เท่ากับราคาปิดของวันทำการก่อนหน้า (${previousDay})`;
  }
  sentences.push(priceSentence);

  if (!flat) {
    sentences.push(
      `ราคาสูงสุดของวันคือ ${formatThaiAmount(report.high.price)} บาท เมื่อเวลา ${formatThaiTime(report.high.time)} และต่ำสุดคือ ${formatThaiAmount(report.low.price)} บาท เมื่อเวลา ${formatThaiTime(report.low.time)}`,
    );
  }

  sentences.push(
    `${inProgress ? "ราคาล่าสุด" : "ราคาปิด"}ของทองคำแท่งรับซื้ออยู่ที่ ${formatThaiAmount(report.close.barBuy)} บาท ทองรูปพรรณรับซื้อ (ฐานภาษี) ${formatThaiAmount(report.close.ornamentBuy)} บาท และทองรูปพรรณขายออก ${formatThaiAmount(report.close.ornamentSell)} บาท ทุกราคาเป็นราคาต่อน้ำหนักทอง 1 บาท`,
  );

  return sentences.join(" ");
}

/**
 * The ready-to-copy text in the share box: a few short lines for LINE or a
 * blog post, ending with the page link. `url` is the absolute link to print.
 */
export function buildReportShareText(report: DailyReport, inProgress: boolean, url: string): string {
  const day = formatThaiDateCompact(dateOfDay(report.date));
  const lines = [
    inProgress
      ? `ราคาทองวันที่ ${day} ล่าสุดเวลา ${formatThaiTime(report.lastAnnouncedAt)} (ประกาศสมาคมค้าทองคำ)`
      : `ราคาทองวันที่ ${day} (ประกาศสมาคมค้าทองคำ)`,
    `ทองคำแท่ง รับซื้อ ${formatThaiAmount(report.close.barBuy)} ขายออก ${formatThaiAmount(report.close.barSell)} บาท`,
    `ทองรูปพรรณ รับซื้อ ${formatThaiAmount(report.close.ornamentBuy)} ขายออก ${formatThaiAmount(report.close.ornamentSell)} บาท`,
  ];

  if (report.changes) {
    const movement = movementPhrase(report);
    lines.push(
      movement
        ? `ทองคำแท่งขายออก${movement} จากวันทำการก่อนหน้า`
        : "ทองคำแท่งขายออกเท่ากับราคาปิดของวันทำการก่อนหน้า",
    );
  }

  lines.push(
    `สูงสุด ${formatThaiAmount(report.high.price)} ต่ำสุด ${formatThaiAmount(report.low.price)} ปรับราคา ${report.priceChanges} ครั้ง`,
    `รายงานฉบับเต็ม: ${url}`,
  );
  return lines.join("\n");
}

/** Page <title>. */
export function buildReportTitle(config: ReportPageConfig): string {
  return `ราคาทองวันที่ ${config.day} ${config.monthName} ${config.buddhistYear} – รายงานราคาทองประจำวัน`;
}

/** Meta description, at most 160 characters (checked in the tests). */
export function buildReportDescription(
  config: ReportPageConfig,
  report: DailyReport | null,
  inProgress: boolean,
): string {
  const day = formatThaiDateCompact(reportDateAsInstant(config));
  if (!report) {
    return `รายงานราคาทองวันที่ ${day} ราคาทุกประกาศของสมาคมค้าทองคำ ราคาเปิด ราคาปิด สูงสุดและต่ำสุดของวัน`;
  }
  const change = report.changes?.barSell ?? null;
  const movement =
    change === null
      ? ""
      : change === 0
        ? " ไม่เปลี่ยนแปลง"
        : ` ${change > 0 ? "ขึ้น" : "ลง"} ${formatThaiAmount(Math.abs(change))} บาท`;
  return (
    `ราคาทองวันที่ ${day} ทองคำแท่งขายออก${inProgress ? "ล่าสุด" : "ปิด"} ${formatThaiAmount(report.close.barSell)} บาท${movement} ` +
    `สูงสุด ${formatThaiAmount(report.high.price)} ต่ำสุด ${formatThaiAmount(report.low.price)} พร้อมราคาทุกประกาศของสมาคมค้าทองคำ`
  );
}
