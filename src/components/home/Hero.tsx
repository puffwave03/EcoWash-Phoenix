import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { Container } from "@/components/Container";
import { DashboardPreview } from "@/components/home/DashboardPreview";

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
              <Button className="w-full sm:w-auto">{t("primaryCta")}</Button>
              <Button className="w-full sm:w-auto" variant="secondary">
                {t("secondaryCta")}
              </Button>
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
