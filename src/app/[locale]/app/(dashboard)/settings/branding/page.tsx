import { getTranslations } from "next-intl/server";
import { BrandingSettingsForm } from "@/components/branding/BrandingSettingsForm";
import { saveOrganizationBrandingAction } from "@/features/branding/server/actions";
import { getOwnerBrandingSettings } from "@/features/branding/server/queries";
import type { BrandFocalPosition } from "@/features/branding/types";

type BrandingSettingsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function BrandingSettingsPage({ params }: BrandingSettingsPageProps) {
  const { locale } = await params;
  const [settings, t] = await Promise.all([
    getOwnerBrandingSettings(locale),
    getTranslations({ locale, namespace: "common.branding" }),
  ]);

  return (
    <div className="space-y-6">
      <header className="max-w-3xl space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">{t("eyebrow")}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{t("title")}</h1>
        <p className="text-base leading-7 text-muted">{t("description")}</p>
      </header>
      <BrandingSettingsForm
        action={saveOrganizationBrandingAction.bind(null, locale)}
        settings={settings}
        text={{
          address: t("address"),
          colors: t("colors"),
          colorsHelp: t("colorsHelp"),
          commercialName: t("commercialName"),
          contact: t("contact"),
          fileHelp: t("fileHelp"),
          focalPosition: t("focalPosition"),
          focalPositions: t.raw("focalPositions") as Record<BrandFocalPosition, string>,
          formError: t("formError"),
          hero: t("hero"),
          identity: t("identity"),
          logo: t("logo"),
          logoAlt: t("logoAlt"),
          migrationRequired: t("migrationRequired"),
          portal: t("portal"),
          portalSubtitle: t("portalSubtitle"),
          portalTitle: t("portalTitle"),
          preview: t("preview"),
          primaryColor: t("primaryColor"),
          promoBody: t("promoBody"),
          promoCtaHref: t("promoCtaHref"),
          promoCtaLabel: t("promoCtaLabel"),
          promoEnabled: t("promoEnabled"),
          promoImage: t("promoImage"),
          promotion: t("promotion"),
          promoTitle: t("promoTitle"),
          removeHero: t("removeHero"),
          removeLogo: t("removeLogo"),
          removePromoImage: t("removePromoImage"),
          save: t("save"),
          saving: t("saving"),
          softColor: t("softColor"),
          strongColor: t("strongColor"),
          success: t("success"),
          supportEmail: t("supportEmail"),
          supportPhone: t("supportPhone"),
          supportWhatsapp: t("supportWhatsapp"),
          validationError: t("validationError"),
          website: t("website"),
        }}
      />
    </div>
  );
}
