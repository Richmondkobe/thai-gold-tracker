import { toBangkokDateString } from "@/lib/bangkok";
import { formatThaiMonthName, toBuddhistYear } from "@/lib/thai-date";

// Config for the /ราคาทองเดือน/[month-name]-[buddhist-year] pages, e.g.
// /ราคาทองเดือน/ตุลาคม-2569 - one per calendar month from the start of the
// data (January 2016 = มกราคม 2559) to the current month. Same URL pattern as
// the per-year pages (lib/year-pages.ts): ASCII route folder
// (app/gold-price-month/[monthSlug]) with the Thai public path rewritten onto
// it in next.config.ts; use encodeURI() when emitting the path in URLs.
//
// This is NOT a build-time constant. The range ends at the month containing
// `asOf`, and callers pass the date of the newest stored price
// (getDataAsOfDate() in lib/gold-price-queries.ts, or the last row they already
// loaded) - NOT the clock. So a month only gets a page, links and a sitemap
// entry once it has at least one price, and then it appears by itself with no
// deploy. On the 1st, before GTA's first announcement, the new month simply
// isn't listed yet. Always call these at render / request time, never at
// module scope. (isCurrentMonth is the one clock-based check: "is this month
// still in progress" is a question about today, not about the data.)

const FIRST_GREGORIAN_YEAR = 2016;
const FIRST_MONTH = 1;

export interface MonthPageConfig {
  gregorianYear: number;
  buddhistYear: number;
  /** 1-12 */
  month: number;
  /** e.g. "ตุลาคม" */
  monthName: string;
  /** Decoded path segment, e.g. "ตุลาคม-2569". */
  slug: string;
}

function buildConfig(gregorianYear: number, month: number): MonthPageConfig {
  const buddhistYear = toBuddhistYear(gregorianYear);
  const monthName = formatThaiMonthName(month);
  return { gregorianYear, buddhistYear, month, monthName, slug: `${monthName}-${buddhistYear}` };
}

/** Months since year 0 - makes "is this month in range" and prev/next simple arithmetic. */
function monthIndex(gregorianYear: number, month: number): number {
  return gregorianYear * 12 + (month - 1);
}

function fromMonthIndex(index: number): MonthPageConfig {
  return buildConfig(Math.floor(index / 12), (index % 12) + 1);
}

const FIRST_INDEX = monthIndex(FIRST_GREGORIAN_YEAR, FIRST_MONTH);

/** Index of the Bangkok calendar month containing `date`. */
function monthIndexOf(date: Date): number {
  const [year, month] = toBangkokDateString(date).split("-").map(Number);
  return monthIndex(year, month);
}

/** Whether `config` is the calendar month in progress right now (Bangkok time). */
export function isCurrentMonth(config: MonthPageConfig, now: Date = new Date()): boolean {
  return monthIndex(config.gregorianYear, config.month) === monthIndexOf(now);
}

/** Every month page up to the month containing `asOf`, oldest first (มกราคม 2559 ...). */
export function listMonthPages(asOf: Date): MonthPageConfig[] {
  const last = monthIndexOf(asOf);
  const pages: MonthPageConfig[] = [];
  for (let i = FIRST_INDEX; i <= last; i++) pages.push(fromMonthIndex(i));
  return pages;
}

/** The most recent `count` months, newest first. */
export function listRecentMonthPages(count: number, asOf: Date): MonthPageConfig[] {
  return listMonthPages(asOf).slice(-count).reverse();
}

/** That Buddhist year's month pages, oldest first (fewer than 12 for a year still in progress). */
export function listMonthPagesForYear(
  buddhistYear: number,
  asOf: Date,
): MonthPageConfig[] {
  return listMonthPages(asOf).filter((p) => p.buddhistYear === buddhistYear);
}

/** Parses a decoded slug like "ตุลาคม-2569". Null for anything malformed, before the data starts, or after `asOf`. */
export function getMonthPageBySlug(slug: string, asOf: Date): MonthPageConfig | null {
  const match = /^(.+)-(\d{4})$/.exec(slug);
  if (!match) return null;
  const buddhistYear = Number(match[2]);
  for (let month = 1; month <= 12; month++) {
    if (formatThaiMonthName(month) !== match[1]) continue;
    const config = buildConfig(buddhistYear - 543, month);
    const index = monthIndex(config.gregorianYear, month);
    return index >= FIRST_INDEX && index <= monthIndexOf(asOf) ? config : null;
  }
  return null;
}

/** The neighbouring month pages; null at either end of the range. */
export function getAdjacentMonthPages(
  config: MonthPageConfig,
  asOf: Date,
): { previous: MonthPageConfig | null; next: MonthPageConfig | null } {
  const index = monthIndex(config.gregorianYear, config.month);
  return {
    previous: index > FIRST_INDEX ? fromMonthIndex(index - 1) : null,
    next: index < monthIndexOf(asOf) ? fromMonthIndex(index + 1) : null,
  };
}

/** Decoded app path, e.g. "/ราคาทองเดือน/ตุลาคม-2569". Wrap in encodeURI() for URLs. */
export function monthPagePath(config: MonthPageConfig): string {
  return `/ราคาทองเดือน/${config.slug}`;
}
