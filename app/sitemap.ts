import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

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
  ];
}
