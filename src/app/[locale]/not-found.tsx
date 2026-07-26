import { useTranslations } from "next-intl";
import { Container } from "@/components/Container";
import { Link } from "@/i18n/navigation";

export default function LocaleNotFound() {
  const t = useTranslations("common.notFound");

  return (
    <section className="bg-background py-section">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-small font-semibold uppercase tracking-[0.14em] text-secondary">
            {t("eyebrow")}
          </p>
          <h1 className="mt-5 text-h1 font-semibold leading-tight text-text">
            {t("title")}
          </h1>
          <p className="mt-5 text-body leading-8 text-muted">
            {t("description")}
          </p>
          <div className="mt-8">
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-control bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-luxury transition-standard hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              href="/"
            >
              {t("homeLink")}
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
