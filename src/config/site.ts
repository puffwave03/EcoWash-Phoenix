import { routing } from "@/i18n/routing";

function normalizeSiteUrl(value: string | undefined) {
  const fallback =
    process.env.NODE_ENV === "development" ? "http://localhost:3000" : undefined;
  const url = value?.trim() || fallback;

  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL is required for production builds and must be an absolute HTTP or HTTPS URL.",
    );
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL must be an absolute HTTP or HTTPS URL.",
    );
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL must use the HTTP or HTTPS protocol.",
    );
  }

  return url.replace(/\/$/, "");
}

export const siteConfig = {
  defaultDescription:
    "A multilingual operations platform for professional laundry businesses, hotels and service teams.",
  defaultLocale: routing.defaultLocale,
  defaultTitle: "EcoWash Phoenix | Laundry Operations Platform",
  name: "EcoWash Phoenix",
  titleTemplate: "%s | EcoWash Phoenix",
  url: normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL),
  locales: routing.locales,
  openGraphLocales: {
    en: "en_US",
    it: "it_IT",
    es: "es_ES",
    fr: "fr_FR",
    de: "de_DE",
  },
  socialImage: {
    alt: "EcoWash Phoenix professional laundry operations",
    height: 630,
    path: "/social/ecowash-og.png",
    type: "image/png",
    width: 1200,
  },
} as const;

export type SiteLocale = (typeof siteConfig.locales)[number];
