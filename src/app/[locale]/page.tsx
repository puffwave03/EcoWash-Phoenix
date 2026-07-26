import { use } from "react";
import { setRequestLocale } from "next-intl/server";
import { Hero } from "@/components/home/Hero";
import { IndustriesSection } from "@/components/home/IndustriesSection";
import { ServicesSection } from "@/components/home/ServicesSection";
import { SolutionsSection } from "@/components/home/SolutionsSection";

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
    </>
  );
}
