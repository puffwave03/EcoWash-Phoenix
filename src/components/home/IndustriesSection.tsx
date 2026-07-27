import { useTranslations } from "next-intl";
import { Section } from "@/components/Section";
import { SectionTitle } from "@/components/SectionTitle";
import { PhotoSlot } from "@/components/home/PhotoSlot";

const primaryIndustries = [
  {
    key: "hotels",
    image: "/images/home/industries/hotel-resort.webp",
    objectPosition: "52% center",
  },
  {
    key: "vacationRentals",
    image: "/images/home/industries/vacation-rental.webp",
    objectPosition: "52% center",
  },
  {
    key: "professionalLaundries",
    image: "/images/home/industries/professional-laundry.webp",
    objectPosition: "48% center",
  },
] as const;

const secondaryIndustries = [
  "dryCleaning",
  "restaurants",
  "commercialClients",
  "selfService",
] as const;

export function IndustriesSection() {
  const t = useTranslations("home.industries");

  return (
    <Section className="bg-linen" id="industries">
      <SectionTitle eyebrow={t("eyebrow")} title={t("title")}>
        {t("description")}
      </SectionTitle>

      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {primaryIndustries.map((item) => (
          <article
            className="overflow-hidden rounded-card border border-border bg-surface shadow-editorial"
            key={item.key}
          >
            <div className="relative aspect-[16/11] overflow-hidden">
              <PhotoSlot
                alt={t(`items.${item.key}.imageAlt`)}
                className="object-cover"
                fill
                objectPosition={item.objectPosition}
                sizes="(min-width: 1024px) 31vw, 100vw"
                src={item.image}
              />
            </div>
            <div className="p-5 sm:p-6">
              <h3 className="text-xl font-semibold leading-tight text-text">
                {t(`items.${item.key}.title`)}
              </h3>
              <p className="mt-3 text-sm leading-6 text-muted sm:text-body">
                {t(`items.${item.key}.description`)}
              </p>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-8 grid gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
        {secondaryIndustries.map((item) => (
          <article className="border-t border-border pt-5" key={item}>
            <h3 className="text-lg font-semibold leading-tight text-text">
              {t(`items.${item}.title`)}
            </h3>
            <p className="mt-3 text-sm leading-6 text-muted">
              {t(`items.${item}.description`)}
            </p>
          </article>
        ))}
      </div>
    </Section>
  );
}
