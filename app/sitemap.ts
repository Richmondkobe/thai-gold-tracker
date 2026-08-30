import type { MetadataRoute } from "next";
import { PROFIT_CALC_PATH, SITE_URL } from "@/lib/site";
import { WEIGHT_PAGES, weightPagePath } from "@/lib/weight-pages";
import { GUIDE_PAGES, guidePagePath } from "@/lib/guide-pages";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

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
    {
      url: `${SITE_URL}${encodeURI(PROFIT_CALC_PATH)}`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.7,
    },
  ];
}
