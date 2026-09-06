import { useTranslations } from "next-intl";
import { Section } from "@/components/Section";

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
      <div className="grid gap-10 lg:grid-cols-[0.66fr_1.34fr] lg:gap-14">
        <div className="max-w-2xl lg:sticky lg:top-28 lg:self-start">
          <p className="text-small font-semibold uppercase tracking-[0.16em] text-gold">{t("eyebrow")}</p>
          <h2 className="mt-4 text-h2 font-semibold leading-tight text-primary-strong">{t("title")}</h2>
          <p className="mt-5 text-body leading-8 text-muted">{t("description")}</p>
          <div className="mt-7 h-px w-24 bg-gold" aria-hidden="true" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {valueItems.map((item) => (
            <article className="rounded-[1.5rem] border border-primary/10 bg-white p-5 shadow-sm sm:p-6" key={item.key}>
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-black tracking-[0.16em] text-gold">{item.marker}</span>
                <span className="h-8 w-8 rounded-full border border-primary/10 bg-primary-soft" aria-hidden="true" />
              </div>
              <h3 className="mt-5 text-xl font-semibold leading-tight text-primary-strong">{t(`items.${item.key}.title`)}</h3>
              <p className="mt-3 text-sm leading-7 text-muted">{t(`items.${item.key}.description`)}</p>
            </article>
          ))}
        </div>
      </div>
    </Section>
  );
}
