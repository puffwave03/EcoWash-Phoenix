import type { Metadata } from "next";
import { siteConfig, type SiteLocale } from "@/config/site";

type MetadataInput = {
  description: string;
  locale: SiteLocale;
  pathname?: string;
  title: string;
};

function pathFor(locale: SiteLocale, pathname = "") {
  return `/${locale}${pathname}`;
}

export function absoluteUrl(pathname: string) {
  return `${siteConfig.url}${pathname}`;
}

export function localizedPath(locale: SiteLocale, pathname = "") {
  return pathFor(locale, pathname);
}

export function localizedLanguages(pathname = "") {
  return {
    ...Object.fromEntries(
      siteConfig.locales.map((locale) => [
        locale,
        absoluteUrl(pathFor(locale, pathname)),
      ]),
    ),
    "x-default": absoluteUrl(pathFor(siteConfig.defaultLocale, pathname)),
  };
}

export function buildPageMetadata({
  description,
  locale,
  pathname = "",
  title,
}: MetadataInput): Metadata {
  const localizedUrl = absoluteUrl(pathFor(locale, pathname));

  return {
    title,
    description,
    alternates: {
      canonical: localizedUrl,
      languages: localizedLanguages(pathname),
    },
    openGraph: {
      title,
      description,
      locale: siteConfig.openGraphLocales[locale],
      siteName: siteConfig.name,
      type: "website",
      url: localizedUrl,
    },
  };
}
