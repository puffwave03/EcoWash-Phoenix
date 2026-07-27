import { useTranslations } from "next-intl";
import { Section } from "@/components/Section";
import { PrincipleItem } from "@/components/home/PrincipleItem";

const principleItems = [
  "workflowFirst",
  "modularDesign",
  "internationalReady",
  "secureFoundations",
  "clearResponsibilities",
  "scalableOperations",
] as const;

export function TrustPrinciplesSection() {
  const t = useTranslations("home.trust");

  return (
    <Section className="bg-cream text-text" id="principles">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-small font-semibold uppercase tracking-[0.14em] text-gold">
          {t("eyebrow")}
        </p>
        <h2 className="mt-5 text-h2 font-semibold leading-tight text-primary-strong">
          {t("title")}
        </h2>
        <p className="mt-5 text-body leading-8 text-muted">
          {t("description")}
        </p>
      </div>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {principleItems.map((item) => (
          <PrincipleItem
            description={t(`items.${item}.description`)}
            key={item}
            title={t(`items.${item}.title`)}
          />
        ))}
      </div>
    </Section>
  );
}
