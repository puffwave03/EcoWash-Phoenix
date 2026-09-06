import { useTranslations } from "next-intl";
import { Container } from "@/components/Container";
import { DashboardPreview } from "@/components/home/DashboardPreview";
import { PhotoSlot } from "@/components/home/PhotoSlot";
import { Link } from "@/i18n/navigation";

export function Hero() {
  const t = useTranslations("home.hero");

  return (
    <section className="relative isolate overflow-hidden bg-cream py-8 sm:py-12 lg:min-h-[45rem] lg:py-16">
      <PhotoSlot
        alt=""
        className="-z-10 object-cover opacity-62"
        fill
        height={1200}
        objectPosition="center center"
        priority
        sizes="100vw"
        src="/images/home/hero/industrial-laundry-background.webp"
        width={1400}
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(246_241_231/_0.985)_0%,rgb(246_241_231/_0.93)_43%,rgb(246_241_231/_0.45)_72%,rgb(6_31_24/_0.16)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-[linear-gradient(0deg,var(--color-forest-deep),transparent)] opacity-15" />

      <Container>
        <div className="grid items-center gap-8 lg:grid-cols-[0.84fr_1.16fr] lg:gap-12">
          <div className="relative mx-auto w-full max-w-3xl rounded-[2rem] border border-white/55 bg-linen/82 px-5 py-7 text-center shadow-editorial backdrop-blur-[4px] sm:px-7 sm:py-9 lg:mx-0 lg:border-white/35 lg:bg-linen/66 lg:px-8 lg:py-10 lg:text-left">
            <PhotoSlot
              alt=""
              className="pointer-events-none absolute -bottom-28 -left-20 -z-10 hidden aspect-[7/5] w-64 rounded-card object-contain opacity-80 mix-blend-screen lg:block"
              height={360}
              objectPosition="center bottom"
              sizes="16rem"
              src="/images/home/hero/folded-white-linen.webp"
              width={420}
            />

            <p className="text-small font-semibold uppercase tracking-[0.16em] text-gold">
              {t("eyebrow")}
            </p>
            <h1 className="mt-4 text-[clamp(2.65rem,10vw,4.75rem)] font-semibold leading-[0.98] tracking-[-0.035em] text-primary-strong lg:mt-5">
              {t("title")}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg sm:leading-8 lg:mx-0 lg:border-l-2 lg:border-gold lg:pl-5">
              {t("description")}
            </p>

            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <Link
                className="inline-flex min-h-12 w-full items-center justify-center rounded-control bg-primary px-6 py-3 text-sm font-semibold !text-white shadow-luxury transition-standard hover:bg-primary-strong hover:!text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:w-auto"
                href="/contact"
              >
                {t("primaryCta")}
              </Link>
              <Link
                className="inline-flex min-h-12 w-full items-center justify-center rounded-control border border-gold/80 bg-linen/85 px-6 py-3 text-sm font-semibold text-primary transition-standard hover:bg-gold-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 sm:w-auto"
                href="/#solutions"
              >
                {t("secondaryCta")}
              </Link>
            </div>

            <div className="mt-6 border-t border-primary/10 pt-5">
              <p className="text-small leading-6 text-muted">
                {t("trustStatement")}
              </p>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-[2rem] border border-white/45 bg-white/18 p-2 shadow-editorial backdrop-blur-[2px] sm:p-3">
              <DashboardPreview />
            </div>
            <PhotoSlot
              alt=""
              className="absolute -right-16 bottom-1 hidden aspect-[4/5] w-36 rounded-card object-cover opacity-95 shadow-editorial xl:block"
              height={560}
              objectPosition="65% center"
              sizes="9rem"
              src="/images/home/hero/folded-green-textiles.webp"
              width={448}
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
