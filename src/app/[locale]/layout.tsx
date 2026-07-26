import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { siteConfig, type SiteLocale } from "@/config/site";
import { SiteLayout } from "@/layouts/SiteLayout";
import { routing } from "@/i18n/routing";
import "@/styles/globals.css";

type LocaleLayoutProps = Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: Pick<LocaleLayoutProps, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common.metadata" });

  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      default: t("title"),
      template: siteConfig.titleTemplate,
    },
    description: t("description"),
    applicationName: siteConfig.name,
    openGraph: {
      description: t("description"),
      locale: siteConfig.openGraphLocales[locale as SiteLocale],
      siteName: siteConfig.name,
      title: t("title"),
      type: "website",
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <html lang={locale} className="h-full antialiased">
      <body className="min-h-full">
        <NextIntlClientProvider>
          <SiteLayout>{children}</SiteLayout>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
