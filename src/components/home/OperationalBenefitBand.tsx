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
    <section className="bg-forest-deep py-7 text-white sm:py-8">
      <Container>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {benefitItems.map((item) => (
            <article className="rounded-[1.25rem] border border-white/12 bg-white/[0.045] p-5 backdrop-blur-sm" key={item.key}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-small font-semibold tracking-[0.15em] text-gold">{item.marker}</span>
                <span className="h-px w-10 bg-gold/55" aria-hidden="true" />
              </div>
              <h2 className="mt-3 text-lg font-semibold leading-tight text-white">{t(`items.${item.key}.title`)}</h2>
              <p className="mt-3 text-sm leading-6 text-white/68">{t(`items.${item.key}.description`)}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
