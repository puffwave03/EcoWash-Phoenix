import { useTranslations } from "next-intl";
import { Section } from "@/components/Section";
import { SectionTitle } from "@/components/SectionTitle";

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
    <Section className="bg-cream" id="solutions">
      <div className="grid gap-10 lg:grid-cols-[0.58fr_1.42fr] lg:gap-14">
        <div className="max-w-xl lg:sticky lg:top-28 lg:self-start">
          <SectionTitle eyebrow={t("eyebrow")} title={t("title")} align="left">
            {t("description")}
          </SectionTitle>
          <div className="mt-7 hidden h-px w-24 bg-gold lg:block" aria-hidden="true" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:gap-5">
          {solutionItems.map((item) => (
            <article
              className="group relative overflow-hidden rounded-[1.6rem] border border-primary/10 bg-white p-5 shadow-sm transition-standard hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-card sm:p-6"
              key={item.key}
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--color-gold),transparent)] opacity-70" aria-hidden="true" />
              <div className="flex items-start justify-between gap-4">
                <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-full bg-primary-soft px-3 text-xs font-black tracking-[0.12em] text-primary">
                  {item.marker}
                </span>
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-gold/80 transition-transform group-hover:scale-125" aria-hidden="true" />
              </div>
              <h3 className="mt-5 text-xl font-semibold leading-tight text-primary-strong">
                {t(`items.${item.key}.title`)}
              </h3>
              <p className="mt-3 text-sm leading-6 text-muted sm:text-[0.95rem] sm:leading-7">
                {t(`items.${item.key}.description`)}
              </p>
            </article>
          ))}
        </div>
      </div>
    </Section>
  );
}
