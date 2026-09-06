import { useTranslations } from "next-intl";
import { Section } from "@/components/Section";
import { PhotoSlot } from "@/components/home/PhotoSlot";

const primaryServices = [
  { key: "laundry", image: "/images/home/services/industrial-laundry.webp", objectPosition: "42% center" },
  { key: "dryCleaning", image: "/images/home/services/dry-cleaning.webp", objectPosition: "35% center" },
  { key: "ironing", image: "/images/home/services/ironing-finishing.webp", objectPosition: "48% center" },
] as const;

const secondaryServices = ["pickup", "delivery", "recurringBusiness"] as const;

export function ServicesSection() {
  const t = useTranslations("home.services");

  return (
    <Section className="relative overflow-hidden bg-forest-deep text-white" id="services">
      <div className="pointer-events-none absolute -right-32 top-0 h-80 w-80 rounded-full bg-gold/10 blur-3xl" aria-hidden="true" />
      <div className="relative grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-14">
        <div className="max-w-2xl self-start lg:sticky lg:top-28">
          <p className="text-small font-semibold uppercase tracking-[0.16em] text-gold">{t("eyebrow")}</p>
          <h2 className="mt-4 text-h2 font-semibold leading-tight text-white">{t("title")}</h2>
          <p className="mt-5 text-body leading-8 text-white/72">{t("description")}</p>
          <div className="mt-7 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
            <span className="h-px w-12 bg-gold" aria-hidden="true" />
            <span>Phoenix</span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {primaryServices.map((item) => (
            <article className="group overflow-hidden rounded-[1.6rem] border border-white/12 bg-white/[0.06] shadow-editorial" key={item.key}>
              <div className="relative aspect-[4/3] overflow-hidden md:aspect-[3/4]">
                <PhotoSlot
                  alt={t(`items.${item.key}.imageAlt`)}
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  fill
                  objectPosition={item.objectPosition}
                  sizes="(min-width: 1024px) 23vw, (min-width: 768px) 30vw, 100vw"
                  src={item.image}
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_48%,rgb(6_31_24/_0.78)_100%)]" aria-hidden="true" />
              </div>
              <div className="border-t border-gold/25 bg-primary-strong/90 p-5">
                <span className="block h-0.5 w-10 bg-gold" aria-hidden="true" />
                <h3 className="mt-4 text-lg font-semibold leading-tight text-white">{t(`items.${item.key}.title`)}</h3>
                <p className="mt-3 text-sm leading-6 text-white/70">{t(`items.${item.key}.description`)}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="relative mt-7 grid gap-3 md:grid-cols-3">
        {secondaryServices.map((item) => (
          <article className="rounded-[1.35rem] border border-white/12 bg-white/[0.045] p-5 transition-standard hover:border-gold/35 hover:bg-white/[0.07]" key={item}>
            <div className="flex items-start gap-3">
              <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold" aria-hidden="true">✓</span>
              <div>
                <h3 className="text-lg font-semibold leading-tight text-white">{t(`items.${item}.title`)}</h3>
                <p className="mt-2 text-sm leading-6 text-white/68">{t(`items.${item}.description`)}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}
