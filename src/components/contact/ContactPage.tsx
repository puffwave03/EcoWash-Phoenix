import { useTranslations } from "next-intl";
import { Container } from "@/components/Container";
import { ContactInfoPanel } from "@/components/contact/ContactInfoPanel";
import { DemoRequestForm } from "@/components/contact/DemoRequestForm";

export function ContactPage() {
  const t = useTranslations("contact.hero");

  return (
    <>
      <section className="relative overflow-hidden bg-cream py-10 sm:py-14 lg:py-16">
        <div className="pointer-events-none absolute -right-24 -top-16 h-72 w-72 rounded-full bg-primary/7 blur-3xl" aria-hidden="true" />
        <Container>
          <div className="relative mx-auto max-w-4xl rounded-[2rem] border border-white/60 bg-white/55 px-5 py-8 text-center shadow-sm backdrop-blur-sm sm:px-8 sm:py-10 lg:px-12">
            <p className="text-small font-semibold uppercase tracking-[0.16em] text-gold">{t("eyebrow")}</p>
            <h1 className="mt-4 text-[clamp(2.5rem,8vw,4.5rem)] font-semibold leading-[1] tracking-[-0.035em] text-primary-strong">{t("title")}</h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg sm:leading-8">{t("description")}</p>
          </div>
        </Container>
      </section>

      <section className="bg-secondary-soft py-10 sm:py-14 lg:py-16">
        <Container>
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-8">
            <div className="min-w-0 rounded-[1.6rem] border border-primary/10 bg-white p-4 shadow-sm sm:p-6">
              <DemoRequestForm />
            </div>
            <div className="min-w-0 lg:sticky lg:top-28">
              <ContactInfoPanel />
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
