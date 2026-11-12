import { toBangkokDateString } from "@/lib/bangkok";
import { toBuddhistYear } from "@/lib/thai-date";

// Config for the /ราคาทองปี/[year] pages, one per Buddhist year the site has
// data for. Same URL pattern as the other generated pages: ASCII route folder
// (app/gold-price-year/[year]) with the Thai public path rewritten onto it in
// next.config.ts; use encodeURI() when emitting the path in URLs.
//
// Data starts 2016-01-02 (พ.ศ. 2559). The list is NOT a hard-coded range: it
// runs from 2559 to the year containing `asOf`, and callers pass the date of
// the newest stored price (getDataAsOfDate() in lib/gold-price-queries.ts, or
// the last row they already loaded) - not the clock. So /ราคาทองปี/2570 gets
// its page, links and sitemap entry by itself as soon as the first price of
// 2570 is stored, with no code change or deploy, and a year with no data yet
// is never listed. Same idea as lib/month-pages.ts. Always call these at
// render / request time, never at module scope.
//
// Both ends keep their own wording on the page: 2559's partial first year, and
// whichever year is still in progress (isCurrentYear - the one clock-based
// check, because "still in progress" is a question about today).

export const FIRST_YEAR_BE = 2559;

export interface YearPageConfig {
  buddhistYear: number;
  gregorianYear: number;
}

function buddhistYearOf(date: Date): number {
  return toBuddhistYear(Number(toBangkokDateString(date).slice(0, 4)));
}

/** Every year page from 2559 up to the year containing `asOf`, oldest first. */
export function listYearPages(asOf: Date): YearPageConfig[] {
  const last = buddhistYearOf(asOf);
  const pages: YearPageConfig[] = [];
  for (let buddhistYear = FIRST_YEAR_BE; buddhistYear <= last; buddhistYear++) {
    pages.push({ buddhistYear, gregorianYear: buddhistYear - 543 });
  }
  return pages;
}

/** Null for anything that isn't a 4-digit year between 2559 and the year containing `asOf`. */
export function getYearPageConfig(yearParam: string, asOf: Date): YearPageConfig | null {
  if (!/^\d{4}$/.test(yearParam)) return null;
  const n = Number(yearParam);
  return listYearPages(asOf).find((p) => p.buddhistYear === n) ?? null;
}

/** Whether `buddhistYear` is the calendar year in progress right now (Bangkok time). */
export function isCurrentYear(buddhistYear: number, now: Date = new Date()): boolean {
  return buddhistYear === buddhistYearOf(now);
}

/** Decoded app path, e.g. "/ราคาทองปี/2569". Wrap in encodeURI() for URLs. */
export function yearPagePath(buddhistYear: number): string {
  return `/ราคาทองปี/${buddhistYear}`;
}
