import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { WEIGHT_PAGES, weightPagePath } from "@/lib/weight-pages";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const weightPages: MetadataRoute.Sitemap = WEIGHT_PAGES.map((p) => ({
    url: `${SITE_URL}${encodeURI(weightPagePath(p))}`,
    lastModified,
    changeFrequency: "hourly",
    priority: 0.8,
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
  ];
}
