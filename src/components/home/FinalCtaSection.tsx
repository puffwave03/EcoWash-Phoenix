import { useTranslations } from "next-intl";
import { Section } from "@/components/Section";
import { Link } from "@/i18n/navigation";

export function FinalCtaSection() {
  const t = useTranslations("home.finalCta");

  return (
    <Section className="bg-background" id="contact">
      <div className="rounded-card border border-border bg-surface px-5 py-12 text-center shadow-card sm:px-8 lg:px-16 lg:py-16">
        <p className="text-small font-semibold uppercase tracking-[0.14em] text-secondary">
          {t("eyebrow")}
        </p>
        <h2 className="mx-auto mt-5 max-w-4xl text-h2 font-semibold leading-tight text-text">
          {t("title")}
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-body leading-8 text-muted">
          {t("description")}
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-control bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-luxury transition-standard hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            href="/contact"
          >
            {t("primaryCta")}
          </Link>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-control border border-secondary bg-surface px-5 py-2.5 text-sm font-semibold text-primary transition-standard hover:bg-secondary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
            href="/#solutions"
          >
            {t("secondaryCta")}
          </Link>
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-small leading-6 text-muted">
          {t("supportingNote")}
        </p>
      </div>
    </Section>
  );
}
