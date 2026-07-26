import { useTranslations } from "next-intl";
import { Section } from "@/components/Section";
import { SectionTitle } from "@/components/SectionTitle";
import { SolutionCard } from "@/components/home/SolutionCard";

const solutionItems = [
  { key: "orderManagement", marker: "01" },
  { key: "productionControl", marker: "02" },
  { key: "pickupDelivery", marker: "03" },
  { key: "customerManagement", marker: "04" },
  { key: "billingPayments", marker: "05" },
  { key: "operationalInsights", marker: "06" },
] as const;

export function SolutionsSection() {
  const t = useTranslations("home.solutions");

  return (
    <Section className="bg-background pt-0">
      <SectionTitle eyebrow={t("eyebrow")} title={t("title")}>
        {t("description")}
      </SectionTitle>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {solutionItems.map((item) => (
          <SolutionCard
            description={t(`items.${item.key}.description`)}
            key={item.key}
            marker={item.marker}
            title={t(`items.${item.key}.title`)}
          />
        ))}
      </div>
    </Section>
  );
}
