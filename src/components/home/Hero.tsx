import { useTranslations } from "next-intl";
import { Container } from "@/components/Container";
import { DashboardPreview } from "@/components/home/DashboardPreview";
import { PhotoSlot } from "@/components/home/PhotoSlot";
import { Link } from "@/i18n/navigation";

export function Hero() {
  const t = useTranslations("home.hero");

  return (
    <section className="relative isolate overflow-hidden bg-cream py-10 sm:py-14 lg:min-h-[47rem] lg:py-16">
      <PhotoSlot
        alt=""
        className="-z-10 object-cover opacity-62"
        fill
        height={1200}
        objectPosition="center center"
        priority
        sizes="100vw"
        src="/images/home/hero/industrial-laundry-background.png"
        width={1400}
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(246_241_231/_0.98)_0%,rgb(246_241_231/_0.92)_40%,rgb(246_241_231/_0.36)_72%,rgb(6_31_24/_0.18)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-[linear-gradient(0deg,var(--color-forest-deep),transparent)] opacity-20" />
      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:gap-10">
          <div className="relative mx-auto max-w-3xl rounded-card bg-linen/72 py-6 text-center backdrop-blur-[2px] lg:mx-0 lg:bg-linen/58 lg:px-0 lg:text-left">
            <PhotoSlot
              alt=""
              className="pointer-events-none absolute -bottom-28 -left-20 -z-10 hidden aspect-[7/5] w-64 rounded-card object-contain opacity-80 mix-blend-screen lg:block"
              height={360}
              objectPosition="center bottom"
              sizes="16rem"
              src="/images/home/hero/folded-white-linen.png"
              width={420}
            />
            <p className="text-small font-semibold uppercase tracking-[0.14em] text-gold">
              {t("eyebrow")}
            </p>
            <h1 className="mt-5 text-h1 font-semibold leading-[1.02] text-primary-strong">
              {t("title")}
            </h1>
            <p className="mt-6 border-l-0 border-gold text-body leading-8 text-muted sm:text-lg lg:border-l-2 lg:pl-5">
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
                className="inline-flex min-h-11 w-full items-center justify-center rounded-control border border-gold bg-linen px-5 py-2.5 text-sm font-semibold text-primary transition-standard hover:bg-gold-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 sm:w-auto"
                href="/#solutions"
              >
                {t("secondaryCta")}
              </Link>
            </div>
            <p className="mt-6 text-small leading-6 text-muted">
              {t("trustStatement")}
            </p>
          </div>

          <div className="relative">
            <PhotoSlot
              alt=""
              className="absolute -right-16 bottom-1 hidden aspect-[4/5] w-36 rounded-card object-cover opacity-95 shadow-editorial xl:block"
              height={560}
              objectPosition="65% center"
              sizes="9rem"
              src="/images/home/hero/folded-green-textiles.png"
              width={448}
            />
            <DashboardPreview />
          </div>
        </div>
      </Container>
    </section>
  );
}
