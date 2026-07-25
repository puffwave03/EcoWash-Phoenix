import { use } from "react";
import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Section } from "@/components/Section";
import { SectionTitle } from "@/components/SectionTitle";

type HomeProps = {
  params: Promise<{ locale: string }>;
};

export default function Home({ params }: HomeProps) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("home");

  return (
    <Section className="bg-background">
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_0.72fr]">
        <SectionTitle
          eyebrow={t("hero.eyebrow")}
          title={t("hero.title")}
        >
          {t("hero.subtitle")}
        </SectionTitle>

        <Card className="mx-auto w-full max-w-sm space-y-5">
          <div
            aria-label={t("foundationCard.logoLabel")}
            className="flex size-16 items-center justify-center rounded-logo border border-secondary/40 bg-primary text-lg font-semibold text-white"
          >
            {t("foundationCard.logoPlaceholder")}
          </div>
          <div className="space-y-2">
            <h1 className="text-h3 font-semibold text-text">
              {t("foundationCard.title")}
            </h1>
            <p className="text-body text-muted">
              {t("foundationCard.description")}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button>{t("hero.demoButton")}</Button>
            <Button variant="secondary">{t("hero.learnMore")}</Button>
          </div>
        </Card>
      </div>
    </Section>
  );
}
