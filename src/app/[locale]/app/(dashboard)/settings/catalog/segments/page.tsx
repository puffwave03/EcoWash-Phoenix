import { getTranslations } from "next-intl/server";
import { CatalogSegmentManagement } from "@/components/catalog-segments/CatalogSegmentManagement";
import { saveCatalogSegmentAction } from "@/features/catalog-segments/server/actions";
import { getCatalogSegmentAdminSettings } from "@/features/catalog-segments/server/queries";
import type { CatalogSegmentStarter } from "@/features/catalog-segments/types";
import { Link } from "@/i18n/navigation";

type CatalogSegmentsPageProps = { params: Promise<{ locale: string }> };

export default async function CatalogSegmentsPage({ params }: CatalogSegmentsPageProps) {
  const { locale } = await params;
  const [settings, t] = await Promise.all([
    getCatalogSegmentAdminSettings(locale),
    getTranslations({ locale, namespace: "common.catalogSegments" }),
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
    </div>
  );
}
