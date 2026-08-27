import { getTranslations } from "next-intl/server";
import { CatalogSegmentManagement } from "@/components/catalog-segments/CatalogSegmentManagement";
import { FeatureUnavailablePanel } from "@/components/entitlements/FeatureUnavailablePanel";
import { SegmentPricingManagement } from "@/components/pricing-segments/SegmentPricingManagement";
import { saveCatalogSegmentAction } from "@/features/catalog-segments/server/actions";
import { getCatalogSegmentAdminSettings } from "@/features/catalog-segments/server/queries";
import type { CatalogSegmentStarter } from "@/features/catalog-segments/types";
import { FEATURES } from "@/features/entitlements/feature-catalog";
import { hasEntitlement } from "@/features/entitlements/server/resolver";
import { saveSegmentPriceAction } from "@/features/pricing-segments/server/actions";
import { getSegmentPricingSettings } from "@/features/pricing-segments/server/queries";
import { Link } from "@/i18n/navigation";

type CatalogSegmentsPageProps = { params: Promise<{ locale: string }> };

export default async function CatalogSegmentsPage({ params }: CatalogSegmentsPageProps) {
  const { locale } = await params;
  const pricingEnabled = await hasEntitlement(locale, FEATURES.segmentPriceOverrides);
  const [settings, pricing, t, pricingT, unavailableT] = await Promise.all([
    getCatalogSegmentAdminSettings(locale),
    pricingEnabled ? getSegmentPricingSettings(locale) : null,
    getTranslations({ locale, namespace: "common.catalogSegments" }),
    getTranslations({ locale, namespace: "common.pricingSegments" }),
    getTranslations({ locale, namespace: "common.entitlements.unavailable" }),
  ]);

  return (
    <div className="space-y-6">
      <header className="max-w-3xl space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">{t("eyebrow")}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{t("title")}</h1>
        <p className="text-base leading-7 text-muted">{t("description")}</p>
        <Link className="inline-flex min-h-11 items-center text-sm font-semibold !text-primary hover:underline" href="/app/settings/catalog" locale={locale}>← {t("servicesTab")}</Link>
      </header>
      {settings.available ? (
        <CatalogSegmentManagement
          action={saveCatalogSegmentAction.bind(null, locale)}
          categories={settings.categories}
          customers={settings.customers}
          segments={settings.segments}
          services={settings.services}
          text={{
            active: t("active"), assignedCustomers: t("assignedCustomers"), categories: t("categories"), categoryHelp: t("categoryHelp"), create: t("create"), createDescription: t("createDescription"), createTitle: t("createTitle"), customerHelp: t("customerHelp"), customers: t("customers"), description: t("segmentDescription"), displayOrder: t("displayOrder"), duplicate: t("duplicate"), featured: t("featured"), formError: t("formError"), hidden: t("hidden"), inactive: t("inactive"), linkedServices: t("linkedServices"), migrationRequired: t("migrationRequired"), name: t("name"), noCustomers: t("noCustomers"), noSegments: t("noSegments"), portalVisible: t("portalVisible"), save: t("save"), saved: t("saved"), saving: t("saving"), serviceHelp: t("serviceHelp"), services: t("services"), starter: t("starter"), starterHelp: t("starterHelp"), starters: t.raw("starters") as Record<CatalogSegmentStarter, string>, unavailable: t("unavailable"), visible: t("visible"),
          }}
        />
      ) : <p className="rounded-card border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">{t("migrationRequired")}</p>}
      {pricing?.available ? (
        <SegmentPricingManagement
          action={saveSegmentPriceAction.bind(null, locale)}
          currency={pricing.currency}
          locale={locale}
          locations={pricing.locations}
          prices={pricing.prices}
          segments={pricing.segments}
          services={pricing.services}
          text={{
            active: pricingT("active"), add: pricingT("add"), allLocations: pricingT("allLocations"), amount: pricingT("amount"), basePrice: pricingT("basePrice"), description: pricingT("description"), effective: pricingT("effective"), empty: pricingT("empty"), error: pricingT("error"), fallback: pricingT("fallback"), inactive: pricingT("inactive"), location: pricingT("location"), noBasePrice: pricingT("noBasePrice"), noSegments: pricingT("noSegments"), overridePrice: pricingT("overridePrice"), overlap: pricingT("overlap"), save: pricingT("save"), saved: pricingT("saved"), saving: pricingT("saving"), search: pricingT("search"), searchPlaceholder: pricingT("searchPlaceholder"), segment: pricingT("segment"), title: pricingT("title"), validFrom: pricingT("validFrom"), validTo: pricingT("validTo"),
          }}
          today={pricing.today}
        />
      ) : pricingEnabled ? null : (
        <FeatureUnavailablePanel
          backLabel={unavailableT("back")}
          description={unavailableT("description")}
          embedded
          eyebrow={unavailableT("eyebrow")}
          locale={locale}
          title={unavailableT("title")}
        />
      )}
    </div>
  );
}
