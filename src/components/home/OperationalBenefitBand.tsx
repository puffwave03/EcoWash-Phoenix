import { useTranslations } from "next-intl";
import { Container } from "@/components/Container";

const benefitItems = [
  { key: "operationalClarity", marker: "01" },
  { key: "reducedFragmentation", marker: "02" },
  { key: "qualityControl", marker: "03" },
  { key: "scalableWorkflows", marker: "04" },
] as const;

export function OperationalBenefitBand() {
  const t = useTranslations("home.benefits");

  return (
    <section className="bg-forest-deep py-8 text-white">
      <Container>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {benefitItems.map((item) => (
            <article
              className="rounded-card border border-white/12 bg-white/[0.04] p-5"
              key={item.key}
            >
              <span
                aria-hidden="true"
                className="text-small font-semibold text-gold"
              >
                {item.marker}
              </span>
              <h2 className="mt-3 text-lg font-semibold leading-tight text-white">
                {t(`items.${item.key}.title`)}
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/70">
                {t(`items.${item.key}.description`)}
              </p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
