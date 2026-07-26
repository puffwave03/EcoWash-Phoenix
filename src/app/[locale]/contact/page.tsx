import type { Metadata } from "next";
import { use } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContactPage } from "@/components/contact/ContactPage";
import type { SiteLocale } from "@/config/site";
import { buildPageMetadata } from "@/lib/metadata";

type ContactRouteProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: ContactRouteProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact.metadata" });

  return buildPageMetadata({
    title: t("title"),
    description: t("description"),
    locale: locale as SiteLocale,
    pathname: "/contact",
  });
}

export default function ContactRoute({ params }: ContactRouteProps) {
  const { locale } = use(params);
  setRequestLocale(locale);

  return <ContactPage />;
}
