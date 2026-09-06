import { useTranslations } from "next-intl";
import { Section } from "@/components/Section";
import { PhotoSlot } from "@/components/home/PhotoSlot";
import { Link } from "@/i18n/navigation";

export function FinalCtaSection() {
  const t = useTranslations("home.finalCta");

  return (
    <Section className="bg-background" id="contact">
      <div className="relative isolate overflow-hidden rounded-[2rem] border border-primary/10 bg-forest-deep px-5 py-12 text-center text-white shadow-editorial sm:px-8 sm:py-16 lg:px-16 lg:py-20">
        <PhotoSlot
          alt=""
          className="absolute inset-0 -z-10 h-full w-full object-cover opacity-24"
          fill
          objectPosition="center center"
          sizes="100vw"
          src="/images/home/cta/green-linen-texture.webp"
        />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgb(202_164_92/_0.18),transparent_30%),linear-gradient(135deg,rgb(6_31_24/_0.92),rgb(11_62_48/_0.86))]" />

        <div className="mx-auto max-w-4xl">
          <p className="text-small font-semibold uppercase tracking-[0.16em] text-gold">{t("eyebrow")}</p>
          <h2 className="mt-4 text-h2 font-semibold leading-tight text-white">{t("title")}</h2>
          <p className="mx-auto mt-5 max-w-2xl text-body leading-8 text-white/74">{t("description")}</p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-control bg-white px-6 py-3 text-sm font-semibold !text-primary shadow-luxury transition-standard hover:bg-linen hover:!text-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-primary-strong"
              href="/contact"
            >
              {t("primaryCta")}
            </Link>
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-control border border-gold/70 bg-white/[0.06] px-6 py-3 text-sm font-semibold !text-white backdrop-blur transition-standard hover:bg-white/[0.12] hover:!text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-primary-strong"
              href="/#solutions"
            >
              {t("secondaryCta")}
            </Link>
          </div>

          <div className="mx-auto mt-7 max-w-2xl border-t border-white/12 pt-5">
            <p className="text-small leading-6 text-white/62">{t("supportingNote")}</p>
          </div>
        </div>
      </div>
    </Section>
  );
}
