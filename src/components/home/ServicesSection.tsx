import { useTranslations } from "next-intl";
import { Section } from "@/components/Section";
import { ServiceItem } from "@/components/home/ServiceItem";

const serviceItems = [
  "laundry",
  "dryCleaning",
  "ironing",
  "pickup",
  "delivery",
  "recurringBusiness",
] as const;

export function ServicesSection() {
  const t = useTranslations("home.services");

  return (
    <Section className="bg-primary text-white" id="services">
      <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <div className="max-w-2xl">
          <p className="text-small font-semibold uppercase tracking-[0.14em] text-accent">
            {t("eyebrow")}
          </p>
          <h2 className="mt-5 text-h2 font-semibold leading-tight text-white">
            {t("title")}
          </h2>
          <p className="mt-5 text-body leading-8 text-white/75">
            {t("description")}
          </p>
        </div>
        <div className="rounded-card border border-white/15 bg-white/[0.04] px-5 sm:px-7">
          {serviceItems.map((item) => (
            <ServiceItem
              description={t(`items.${item}.description`)}
              key={item}
              title={t(`items.${item}.title`)}
            />
          ))}
        </div>
      </div>
    </Section>
  );
}
