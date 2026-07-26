import { useTranslations } from "next-intl";
import { Section } from "@/components/Section";
import { SectionTitle } from "@/components/SectionTitle";
import { IndustryCard } from "@/components/home/IndustryCard";

const industryItems = [
  "professionalLaundries",
  "dryCleaning",
  "hotels",
  "vacationRentals",
  "restaurants",
  "commercialClients",
  "selfService",
] as const;

export function IndustriesSection() {
  const t = useTranslations("home.industries");

  return (
    <Section className="bg-secondary-soft">
      <SectionTitle eyebrow={t("eyebrow")} title={t("title")}>
        {t("description")}
      </SectionTitle>
      <div className="mt-12 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {industryItems.map((item) => (
          <IndustryCard
            description={t(`items.${item}.description`)}
            key={item}
            title={t(`items.${item}.title`)}
          />
        ))}
      </div>
    </Section>
  );
}
