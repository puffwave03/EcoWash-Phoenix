import { useTranslations } from "next-intl";
import { Section } from "@/components/Section";
import { SectionTitle } from "@/components/SectionTitle";
import { PhotoSlot } from "@/components/home/PhotoSlot";

const primaryIndustries = [
  { key: "hotels", image: "/images/home/industries/hotel-resort.webp", objectPosition: "52% center" },
  { key: "vacationRentals", image: "/images/home/industries/vacation-rental.webp", objectPosition: "52% center" },
  { key: "professionalLaundries", image: "/images/home/industries/professional-laundry.webp", objectPosition: "48% center" },
] as const;

const secondaryIndustries = ["dryCleaning", "restaurants", "commercialClients", "selfService"] as const;

export function IndustriesSection() {
  const t = useTranslations("home.industries");

  return (
    <Section className="bg-linen" id="industries">
      <div className="grid gap-8 lg:grid-cols-[0.62fr_1.38fr] lg:items-end">
        <SectionTitle eyebrow={t("eyebrow")} title={t("title")} align="left">
          {t("description")}
        </SectionTitle>
        <div className="hidden justify-end lg:flex">
          <div className="h-px w-48 bg-[linear-gradient(90deg,transparent,var(--color-gold))]" aria-hidden="true" />
        </div>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {primaryIndustries.map((item, index) => (
          <article className="group overflow-hidden rounded-[1.7rem] border border-border/80 bg-surface shadow-sm transition-standard hover:-translate-y-0.5 hover:shadow-editorial" key={item.key}>
            <div className="relative aspect-[16/10] overflow-hidden">
              <PhotoSlot
                alt={t(`items.${item.key}.imageAlt`)}
                className="object-cover transition-transform duration-500 group-hover:scale-[1.035]"
                fill
                objectPosition={item.objectPosition}
                sizes="(min-width: 1024px) 31vw, 100vw"
                src={item.image}
              />
              <span className="absolute left-4 top-4 rounded-full border border-white/30 bg-primary-strong/80 px-3 py-1.5 text-[0.65rem] font-bold tracking-[0.14em] text-white backdrop-blur">0{index + 1}</span>
            </div>
            <div className="p-5 sm:p-6">
              <h3 className="text-xl font-semibold leading-tight text-primary-strong">{t(`items.${item.key}.title`)}</h3>
              <p className="mt-3 text-sm leading-6 text-muted sm:text-body">{t(`items.${item.key}.description`)}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {secondaryIndustries.map((item) => (
          <article className="rounded-[1.25rem] border border-primary/10 bg-white/55 p-5 transition-standard hover:border-primary/20 hover:bg-white" key={item}>
            <span className="mb-4 block h-1 w-8 rounded-full bg-gold" aria-hidden="true" />
            <h3 className="text-lg font-semibold leading-tight text-primary-strong">{t(`items.${item}.title`)}</h3>
            <p className="mt-3 text-sm leading-6 text-muted">{t(`items.${item}.description`)}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}
