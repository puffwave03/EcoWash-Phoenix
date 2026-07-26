import { routing } from "@/i18n/routing";

function normalizeSiteUrl(value: string | undefined) {
  const fallback = "http://localhost:3000";
  const url = value?.trim() || fallback;

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
} as const;

export type SiteLocale = (typeof siteConfig.locales)[number];
