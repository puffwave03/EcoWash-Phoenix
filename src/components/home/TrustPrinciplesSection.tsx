import { useTranslations } from "next-intl";
import { Section } from "@/components/Section";

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
    <Section className="relative overflow-hidden bg-cream text-text" id="principles">
      <div className="pointer-events-none absolute -left-28 top-16 h-72 w-72 rounded-full bg-primary/5 blur-3xl" aria-hidden="true" />
      <div className="relative mx-auto max-w-3xl text-center">
        <p className="text-small font-semibold uppercase tracking-[0.16em] text-gold">{t("eyebrow")}</p>
        <h2 className="mt-4 text-h2 font-semibold leading-tight text-primary-strong">{t("title")}</h2>
        <p className="mt-5 text-body leading-8 text-muted">{t("description")}</p>
      </div>
      <div className="relative mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {principleItems.map((item, index) => (
          <article className="rounded-[1.35rem] border border-primary/10 bg-white/70 p-5 backdrop-blur transition-standard hover:border-primary/20 hover:bg-white sm:p-6" key={item}>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-black text-primary">{String(index + 1).padStart(2, "0")}</span>
              <h3 className="text-lg font-semibold leading-tight text-primary-strong">{t(`items.${item}.title`)}</h3>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted">{t(`items.${item}.description`)}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}
