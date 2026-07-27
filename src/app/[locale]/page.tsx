import type { Metadata } from "next";
import { use } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FinalCtaSection } from "@/components/home/FinalCtaSection";
import { Hero } from "@/components/home/Hero";
import { IndustriesSection } from "@/components/home/IndustriesSection";
import { OperationalBenefitBand } from "@/components/home/OperationalBenefitBand";
import { OperationalValueSection } from "@/components/home/OperationalValueSection";
import { ServicesSection } from "@/components/home/ServicesSection";
import { SolutionsSection } from "@/components/home/SolutionsSection";
import { TrustPrinciplesSection } from "@/components/home/TrustPrinciplesSection";
import type { SiteLocale } from "@/config/site";
import { buildPageMetadata } from "@/lib/metadata";

type HomeProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: HomeProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common.metadata" });

  return buildPageMetadata({
    description: t("description"),
    locale: locale as SiteLocale,
    title: t("title"),
  });
}

export default function Home({ params }: HomeProps) {
  const { locale } = use(params);
  setRequestLocale(locale);

  return (
    <>
      <Hero />
      <OperationalBenefitBand />
      <SolutionsSection />
      <ServicesSection />
      <IndustriesSection />
      <OperationalValueSection />
      <TrustPrinciplesSection />
      <FinalCtaSection />
    </>
  );
}
