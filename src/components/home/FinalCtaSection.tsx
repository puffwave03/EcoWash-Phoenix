import { useTranslations } from "next-intl";
import { Section } from "@/components/Section";
import { PhotoSlot } from "@/components/home/PhotoSlot";
import { Link } from "@/i18n/navigation";

export function FinalCtaSection() {
  const t = useTranslations("home.finalCta");

  return (
    <Section className="bg-background" id="contact">
      <div className="relative isolate overflow-hidden rounded-card bg-forest-deep px-5 py-14 text-center text-white shadow-editorial sm:px-8 lg:px-16 lg:py-20">
        <PhotoSlot
          alt=""
          className="absolute inset-0 -z-10 h-full w-full object-cover opacity-22"
          fill
          objectPosition="center center"
          sizes="100vw"
          src="/images/home/cta/green-linen-texture.webp"
        />
        <div className="absolute inset-0 -z-10 bg-primary-strong/78" />
        <p className="text-small font-semibold uppercase tracking-[0.14em] text-gold">
          {t("eyebrow")}
        </p>
        <h2 className="mx-auto mt-5 max-w-4xl text-h2 font-semibold leading-tight text-white">
          {t("title")}
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-body leading-8 text-white/75">
          {t("description")}
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-control bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-luxury transition-standard hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            href="/contact"
          >
            {t("primaryCta")}
          </Link>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-control border border-gold bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition-standard hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
            href="/#solutions"
          >
            {t("secondaryCta")}
          </Link>
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-small leading-6 text-white/65">
          {t("supportingNote")}
        </p>
      </div>
    </Section>
  );
}
