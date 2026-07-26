import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { absoluteUrl, localizedPath } from "@/lib/metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  return siteConfig.locales.flatMap((locale) => [
    {
      url: absoluteUrl(localizedPath(locale)),
      changeFrequency: "weekly" as const,
    },
    {
      url: absoluteUrl(localizedPath(locale, "/contact")),
      changeFrequency: "monthly" as const,
    },
  ]);
}
