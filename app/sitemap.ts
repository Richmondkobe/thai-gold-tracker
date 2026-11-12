import type { MetadataRoute } from "next";
import { PROFIT_CALC_PATH, SITE_URL } from "@/lib/site";
import {
  getDailyHistory,
  getDataAsOfDate,
  type DailyGoldPriceRow,
} from "@/lib/gold-price-queries";
import { WEIGHT_PAGES, weightPagePath } from "@/lib/weight-pages";
import { GUIDE_PAGES, guidePagePath } from "@/lib/guide-pages";
import { TRUST_PAGES } from "@/lib/trust-pages";
import { isCurrentYear, listYearPages, yearPagePath } from "@/lib/year-pages";
import { isCurrentMonth, listMonthPages, monthPagePath } from "@/lib/month-pages";

// Regenerated hourly rather than only at deploy time, so a new month's or
// year's page is listed once it has data, and the lastmod of the pages that
// follow the price stays close to the latest announcement.
export const revalidate = 3600;

// <lastmod> is REAL here, never "now": search engines stop trusting the field
// (and Bing in particular schedules recrawls from it) when every URL claims to
// have changed today.
//   - pages that follow the live price ........ time of the newest stored price
//   - a finished month or year ................ time of its last price
//   - articles and trust pages ................ their hand-maintained updatedAt
// If the price history can't be read, the price-driven entries are emitted
// with NO lastmod rather than a made-up one.

/** All daily closes, oldest first; null when the database can't be read. */
async function loadDailyHistory(): Promise<DailyGoldPriceRow[] | null> {
  try {
    const rows = await getDailyHistory(36_500);
    return rows.length > 0 ? rows : null;
  } catch (err) {
    console.error(
      "[sitemap] could not load price history, omitting price-driven lastmod:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const daily = await loadDailyHistory();

  // Last price timestamp per Bangkok calendar month ("YYYY-MM") and year
  // ("YYYY"). Rows are oldest-first, so later rows overwrite earlier ones.
  const lastPriceByMonth = new Map<string, Date>();
  const lastPriceByYear = new Map<string, Date>();
  for (const row of daily ?? []) {
    lastPriceByMonth.set(row.priceDate.slice(0, 7), row.fetchedAt);
    lastPriceByYear.set(row.priceDate.slice(0, 4), row.fetchedAt);
  }
  /** When the newest stored price took effect; undefined if unknown. */
  const latestPrice = daily?.[daily.length - 1].fetchedAt;

  // Year and month pages are listed up to the newest stored price, so a
  // period with no data yet is skipped and a new one appears by itself.
  const asOf = latestPrice ?? (await getDataAsOfDate());

  const weightPages: MetadataRoute.Sitemap = WEIGHT_PAGES.map((p) => ({
    url: `${SITE_URL}${encodeURI(weightPagePath(p))}`,
    lastModified: latestPrice,
    changeFrequency: "hourly",
    priority: 0.8,
  }));

  const guidePages: MetadataRoute.Sitemap = GUIDE_PAGES.map((p) => ({
    url: `${SITE_URL}${encodeURI(guidePagePath(p))}`,
    lastModified: p.updatedAt,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  // Only the year still in progress changes; a finished year is dated by its
  // last price and effectively never changes again.
  const yearPages: MetadataRoute.Sitemap = listYearPages(asOf).map((p) => {
    const current = isCurrentYear(p.buddhistYear, now);
    return {
      url: `${SITE_URL}${encodeURI(yearPagePath(p.buddhistYear))}`,
      lastModified: lastPriceByYear.get(String(p.gregorianYear)),
      changeFrequency: current ? "daily" : "yearly",
      priority: current ? 0.6 : 0.4,
    };
  });

  // Same rule for months. (Months with no data are not listed at all.)
  const monthPages: MetadataRoute.Sitemap = listMonthPages(asOf).map((p) => {
    const current = isCurrentMonth(p, now);
    return {
      url: `${SITE_URL}${encodeURI(monthPagePath(p))}`,
      lastModified: lastPriceByMonth.get(
        `${p.gregorianYear}-${String(p.month).padStart(2, "0")}`,
      ),
      changeFrequency: current ? "daily" : "yearly",
      priority: current ? 0.6 : 0.3,
    };
  });

  return [
    { url: `${SITE_URL}/`, lastModified: latestPrice, changeFrequency: "hourly", priority: 1 },
    {
      url: `${SITE_URL}/gold-ornament-price`,
      lastModified: latestPrice,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/history`,
      lastModified: latestPrice,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/gold-price-chart`,
      lastModified: latestPrice,
      changeFrequency: "daily",
      priority: 0.7,
    },
    ...weightPages,
    ...guidePages,
    ...yearPages,
    ...monthPages,
    {
      url: `${SITE_URL}${encodeURI(PROFIT_CALC_PATH)}`,
      lastModified: latestPrice,
      changeFrequency: "daily",
      priority: 0.7,
    },
    ...TRUST_PAGES.map((p) => ({
      url: `${SITE_URL}${encodeURI(p.pathTh)}`,
      lastModified: p.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.3,
    })),
  ];
}
