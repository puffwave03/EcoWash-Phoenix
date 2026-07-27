import { useTranslations } from "next-intl";
import { Section } from "@/components/Section";
import { PhotoSlot } from "@/components/home/PhotoSlot";

const primaryServices = [
  {
    key: "laundry",
    image: "/images/home/services/industrial-laundry.png",
    objectPosition: "42% center",
  },
  {
    key: "dryCleaning",
    image: "/images/home/services/dry-cleaning.png",
    objectPosition: "35% center",
  },
  {
    key: "ironing",
    image: "/images/home/services/ironing-finishing.png",
    objectPosition: "48% center",
  },
] as const;

const secondaryServices = [
  "pickup",
  "delivery",
  "recurringBusiness",
] as const;

export function ServicesSection() {
  const t = useTranslations("home.services");

  return (
    <Section className="bg-forest-deep text-white" id="services">
      <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-12">
        <div className="max-w-2xl self-center">
          <p className="text-small font-semibold uppercase tracking-[0.14em] text-gold">
            {t("eyebrow")}
          </p>
          <h2 className="mt-5 text-h2 font-semibold leading-tight text-white">
            {t("title")}
          </h2>
          <p className="mt-5 text-body leading-8 text-white/75">
            {t("description")}
          </p>
          <div className="mt-8 h-px w-28 bg-gold" aria-hidden="true" />
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {primaryServices.map((item) => (
            <article
              className="group overflow-hidden rounded-card border border-white/12 bg-white/[0.06] shadow-editorial"
              key={item.key}
            >
              <div className="relative aspect-[3/4] overflow-hidden">
                <PhotoSlot
                  alt={t(`items.${item.key}.imageAlt`)}
                  className="object-cover transition-standard group-hover:scale-[1.03]"
                  fill
                  objectPosition={item.objectPosition}
                  sizes="(min-width: 1024px) 23vw, (min-width: 768px) 30vw, 100vw"
                  src={item.image}
                />
              </div>
              <div className="border-t border-gold/35 bg-primary-strong/92 p-5">
                <span
                  aria-hidden="true"
                  className="block h-0.5 w-10 bg-gold"
                />
                <h3 className="mt-4 text-lg font-semibold leading-tight text-white">
                  {t(`items.${item.key}.title`)}
                </h3>
                <p className="mt-3 text-sm leading-6 text-white/72">
                  {t(`items.${item.key}.description`)}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {secondaryServices.map((item) => (
          <article
            className="rounded-card border border-white/12 bg-white/[0.04] p-5"
            key={item}
          >
            <h3 className="text-lg font-semibold leading-tight text-white">
              {t(`items.${item}.title`)}
            </h3>
            <p className="mt-3 text-sm leading-6 text-white/70">
              {t(`items.${item}.description`)}
            </p>
          </article>
        ))}
      </div>
    </Section>
  );
}
