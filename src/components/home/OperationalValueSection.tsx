import { useTranslations } from "next-intl";
import { Section } from "@/components/Section";
import { ValuePoint } from "@/components/home/ValuePoint";

const valueItems = [
  { key: "sourceOfTruth", marker: "01" },
  { key: "orderVisibility", marker: "02" },
  { key: "teamWorkflows", marker: "03" },
  { key: "customerService", marker: "04" },
] as const;

export function OperationalValueSection() {
  const t = useTranslations("home.value");

  return (
    <Section className="bg-background" id="value">
      <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-12">
        <div className="max-w-2xl">
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
        <div className="grid gap-4 sm:grid-cols-2">
          {valueItems.map((item) => (
            <ValuePoint
              description={t(`items.${item.key}.description`)}
              key={item.key}
              marker={item.marker}
              title={t(`items.${item.key}.title`)}
            />
          ))}
        </div>
      </div>
    </Section>
  );
}
