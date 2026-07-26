import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { absoluteUrl } from "@/lib/metadata";

const shouldIndex = process.env.NEXT_PUBLIC_SITE_INDEXING !== "false";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: shouldIndex ? "/" : undefined,
      disallow: shouldIndex ? undefined : "/",
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: siteConfig.url,
  };
}
