import { useTranslations } from "next-intl";
import { Container } from "@/components/Container";
import { ContactInfoPanel } from "@/components/contact/ContactInfoPanel";
import { DemoRequestForm } from "@/components/contact/DemoRequestForm";

export function ContactPage() {
  const t = useTranslations("contact.hero");

  return (
    <>
      <section className="bg-background py-section">
        <Container>
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-small font-semibold uppercase tracking-[0.14em] text-secondary">
              {t("eyebrow")}
            </p>
            <h1 className="mt-5 text-h1 font-semibold leading-[1.05] text-text">
              {t("title")}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-body leading-8 text-muted sm:text-lg">
              {t("description")}
            </p>
          </div>
        </Container>
      </section>
      <section className="bg-secondary-soft py-section">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
            <DemoRequestForm />
            <ContactInfoPanel />
          </div>
        </Container>
      </section>
    </>
  );
}
