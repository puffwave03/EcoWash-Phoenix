import type { Metadata } from "next";
import { use } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContactPage } from "@/components/contact/ContactPage";

type ContactRouteProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: ContactRouteProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact.metadata" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default function ContactRoute({ params }: ContactRouteProps) {
  const { locale } = use(params);
  setRequestLocale(locale);

  return <ContactPage />;
}
