import { use } from "react";
import { setRequestLocale } from "next-intl/server";
import { FinalCtaSection } from "@/components/home/FinalCtaSection";
import { Hero } from "@/components/home/Hero";
import { IndustriesSection } from "@/components/home/IndustriesSection";
import { OperationalValueSection } from "@/components/home/OperationalValueSection";
import { ServicesSection } from "@/components/home/ServicesSection";
import { SolutionsSection } from "@/components/home/SolutionsSection";
import { TrustPrinciplesSection } from "@/components/home/TrustPrinciplesSection";

type HomeProps = {
  params: Promise<{ locale: string }>;
};

export default function Home({ params }: HomeProps) {
  const { locale } = use(params);
  setRequestLocale(locale);

  return (
    <>
      <Hero />
      <SolutionsSection />
      <ServicesSection />
      <IndustriesSection />
      <OperationalValueSection />
      <TrustPrinciplesSection />
      <FinalCtaSection />
    </>
  );
}
