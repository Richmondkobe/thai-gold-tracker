import { formatThaiMonthName, toBuddhistYear } from "@/lib/thai-date";

// Config for the daily report pages, /รายงานราคาทอง/[day]-[month-name]-[buddhist-year],
// e.g. /รายงานราคาทอง/23-พฤศจิกายน-2569 - one per Bangkok calendar day on which
// the price changed, from REPORT_START_DATE onwards. Same URL pattern as the
// month and year pages: ASCII route folder (app/gold-report/[reportSlug]) with
// the Thai public path rewritten onto it in next.config.ts; use encodeURI()
// when emitting the path in URLs.
//
// This file only knows about dates and URLs. Whether a given day actually HAS
// a report is a question about the data (did gold_prices get a row that day),
// answered by lib/daily-report.ts and by the daily_gold_prices view - a day
// with no price row has no page, no link and no sitemap entry, and a new
// trading day gets all three by itself with no deploy.

/** First day that has a report page. Older days are deliberately not built. */
export const REPORT_START_DATE = "2026-11-01";

export interface ReportPageConfig {
  /** Bangkok calendar day, "YYYY-MM-DD". */
  date: string;
  day: number;
  /** 1-12 */
  month: number;
  gregorianYear: number;
  buddhistYear: number;
  /** e.g. "พฤศจิกายน" */
  monthName: string;
  /** Decoded path segment, e.g. "23-พฤศจิกายน-2569" (no leading zero on the day). */
  slug: string;
}

function build(gregorianYear: number, month: number, day: number): ReportPageConfig | null {
  // Rejects impossible dates (31 กุมภาพันธ์) by round-tripping through Date.
  const utc = new Date(Date.UTC(gregorianYear, month - 1, day));
  if (
    utc.getUTCFullYear() !== gregorianYear ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  const date = utc.toISOString().slice(0, 10);
  if (date < REPORT_START_DATE) return null;

  const buddhistYear = toBuddhistYear(gregorianYear);
  const monthName = formatThaiMonthName(month);
  return {
    date,
    day,
    month,
    gregorianYear,
    buddhistYear,
    monthName,
    slug: `${day}-${monthName}-${buddhistYear}`,
  };
}

/** Whether a "YYYY-MM-DD" day is in the range that has report pages. */
export function isReportDate(date: string): boolean {
  return date >= REPORT_START_DATE;
}

/** Config for a "YYYY-MM-DD" day; null when malformed or before REPORT_START_DATE. */
export function getReportPageByDate(date: string): ReportPageConfig | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  return build(Number(match[1]), Number(match[2]), Number(match[3]));
}

/**
 * Parses a decoded slug like "23-พฤศจิกายน-2569". Null for anything malformed,
 * impossible, before REPORT_START_DATE, or not in canonical form (so
 * "03-พฤศจิกายน-2569" does not become a second URL for the same day).
 */
export function getReportPageBySlug(slug: string): ReportPageConfig | null {
  const match = /^(\d{1,2})-(.+)-(\d{4})$/.exec(slug);
  if (!match) return null;
  for (let month = 1; month <= 12; month++) {
    if (formatThaiMonthName(month) !== match[2]) continue;
    const config = build(Number(match[3]) - 543, month, Number(match[1]));
    return config && config.slug === slug ? config : null;
  }
  return null;
}

/** Decoded app path, e.g. "/รายงานราคาทอง/23-พฤศจิกายน-2569". Wrap in encodeURI() for URLs. */
export function reportPagePath(config: ReportPageConfig): string {
  return `/รายงานราคาทอง/${config.slug}`;
}

/**
 * Short ASCII link for sharing, e.g. "/r/23-11-2569" (day-month-Buddhist year).
 * It only redirects to reportPagePath (next.config.ts): a Thai URL pasted into
 * LINE or a blog is either cut off at the first Thai character or turns into a
 * 200-character percent-encoded string. Never use it as a canonical URL or in
 * the sitemap.
 */
export function reportShortPath(config: ReportPageConfig): string {
  return `/r/${config.day}-${config.month}-${config.buddhistYear}`;
}

/** Noon Bangkok time on the report's day - a safe instant to hand to the Thai date formatters. */
export function reportDateAsInstant(config: ReportPageConfig): Date {
  return new Date(`${config.date}T12:00:00+07:00`);
}
