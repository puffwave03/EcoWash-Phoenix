import { useTranslations } from "next-intl";
import { Container } from "@/components/Container";
import { DashboardPreview } from "@/components/home/DashboardPreview";
import { Link } from "@/i18n/navigation";

export function Hero() {
  const t = useTranslations("home.hero");

  return (
    <section className="bg-background py-section">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div className="mx-auto max-w-3xl text-center lg:mx-0 lg:text-left">
            <p className="text-small font-semibold uppercase tracking-[0.14em] text-secondary">
              {t("eyebrow")}
            </p>
            <h1 className="mt-5 text-h1 font-semibold leading-[1.05] text-text">
              {t("title")}
            </h1>
            <p className="mt-6 text-body leading-8 text-muted sm:text-lg">
              {t("description")}
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <Link
                className="inline-flex min-h-11 w-full items-center justify-center rounded-control bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-luxury transition-standard hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:w-auto"
                href="/contact"
              >
                {t("primaryCta")}
              </Link>
              <Link
                className="inline-flex min-h-11 w-full items-center justify-center rounded-control border border-secondary bg-surface px-5 py-2.5 text-sm font-semibold text-primary transition-standard hover:bg-secondary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 sm:w-auto"
                href="/#solutions"
              >
                {t("secondaryCta")}
              </Link>
            </div>
            <p className="mt-6 text-small leading-6 text-muted">
              {t("trustStatement")}
            </p>
          </div>

          <DashboardPreview />
        </div>
      </Container>
    </section>
  );
}
