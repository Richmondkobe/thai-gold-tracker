import type { MetadataRoute } from "next";
import { PROFIT_CALC_PATH, SITE_URL } from "@/lib/site";
import { getDataAsOfDate } from "@/lib/gold-price-queries";
import { WEIGHT_PAGES, weightPagePath } from "@/lib/weight-pages";
import { GUIDE_PAGES, guidePagePath } from "@/lib/guide-pages";
import { TRUST_PAGES } from "@/lib/trust-pages";
import { isCurrentYear, listYearPages, yearPagePath } from "@/lib/year-pages";
import { isCurrentMonth, listMonthPages, monthPagePath } from "@/lib/month-pages";

// Regenerated daily rather than only at deploy time, so each new month's and
// year's page is listed once it has data, without anyone having to ship a build.
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  // Year and month pages are listed up to the newest stored price, so a
  // period with no data yet is skipped and a new one appears by itself.
  const asOf = await getDataAsOfDate();

  const weightPages: MetadataRoute.Sitemap = WEIGHT_PAGES.map((p) => ({
    url: `${SITE_URL}${encodeURI(weightPagePath(p))}`,
    lastModified,
    changeFrequency: "hourly",
    priority: 0.8,
  }));

  const guidePages: MetadataRoute.Sitemap = GUIDE_PAGES.map((p) => ({
    url: `${SITE_URL}${encodeURI(guidePagePath(p))}`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  // The current year's page still updates daily; past years are finalized
  // and effectively never change once the year is over.
  const yearPages: MetadataRoute.Sitemap = listYearPages(asOf).map((p) => {
    const current = isCurrentYear(p.buddhistYear, lastModified);
    return {
      url: `${SITE_URL}${encodeURI(yearPagePath(p.buddhistYear))}`,
      lastModified,
      changeFrequency: current ? "daily" : "yearly",
      priority: current ? 0.6 : 0.4,
    };
  });

  // Listed up to the month of the newest stored price (months with no data
  // are skipped). Same rule as the year pages for the rest: only the month
  // still in progress changes.
  const monthPages: MetadataRoute.Sitemap = listMonthPages(asOf).map((p) => {
    const current = isCurrentMonth(p, lastModified);
    return {
      url: `${SITE_URL}${encodeURI(monthPagePath(p))}`,
      lastModified,
      changeFrequency: current ? "daily" : "yearly",
      priority: current ? 0.6 : 0.3,
    };
  });

  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: "hourly", priority: 1 },
    {
      url: `${SITE_URL}/gold-ornament-price`,
      lastModified,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/history`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/gold-price-chart`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.7,
    },
    ...weightPages,
    ...guidePages,
    ...yearPages,
    ...monthPages,
    {
      url: `${SITE_URL}${encodeURI(PROFIT_CALC_PATH)}`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.7,
    },
    ...TRUST_PAGES.map((p) => ({
      url: `${SITE_URL}${encodeURI(p.pathTh)}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.3,
    })),
  ];
}
