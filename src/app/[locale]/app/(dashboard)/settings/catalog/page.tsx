import { getTranslations } from "next-intl/server";
import { CatalogManagement } from "@/components/catalog-admin/CatalogManagement";
import {
  bulkUpdateCatalogServicesAction,
  saveCatalogCategoryAction,
  saveCatalogServiceAction,
} from "@/features/catalog-admin/server/actions";
import { getCatalogAdminSettings } from "@/features/catalog-admin/server/queries";
import type { ServiceUnitType } from "@/features/services/types";

type CatalogSettingsPageProps = { params: Promise<{ locale: string }> };

export default async function CatalogSettingsPage({ params }: CatalogSettingsPageProps) {
  const { locale } = await params;
  const [settings, t, catalogT] = await Promise.all([
    getCatalogAdminSettings(locale),
    getTranslations({ locale, namespace: "common.catalogAdmin" }),
    getTranslations({ locale, namespace: "common.catalog" }),
  ]);

  return (
    <div className="space-y-6">
      <header className="max-w-3xl space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">{t("eyebrow")}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{t("title")}</h1>
        <p className="text-base leading-7 text-muted">{t("description")}</p>
      </header>
      {settings.available ? (
        <CatalogManagement
          bulkAction={bulkUpdateCatalogServicesAction.bind(null, locale)}
          categories={settings.categories}
          categoryAction={saveCatalogCategoryAction.bind(null, locale)}
          locale={locale}
          serviceAction={saveCatalogServiceAction.bind(null, locale)}
          services={settings.services}
          text={{
            all: t("all"),
            bulkAction: t("bulkAction"), bulkApply: t("bulkApply"), bulkCategory: t("bulkCategory"), bulkConfirm: t.raw("bulkConfirm") as string, bulkOptions: t.raw("bulkOptions"), bulkSelect: t("bulkSelect"),
            categories: t("categories"), categoriesHelp: t("categoriesHelp"), category: t("category"), categoryFeatured: t("categoryFeatured"), categoryHiddenHelp: t("categoryHiddenHelp"), categoryImage: t("categoryImage"), categoryTitle: t("categoryTitle"),
            customerDescription: t("customerDescription"), customerOrderable: t("customerOrderable"), displayOrder: t("displayOrder"), editPresentation: t("editPresentation"), featured: t("featured"), filters: t.raw("filters"),
            focalPosition: t("focalPosition"), focalPositions: t.raw("focalPositions"), formError: t("formError"), fromPrice: catalogT("fromPrice"), imageHelp: t("imageHelp"), internalDescription: t("internalDescription"), migrationRequired: t("migrationRequired"), noResults: t("noResults"), removeImage: t("removeImage"), save: t("save"), saved: t("saved"), saving: t("saving"), search: t("search"), searchPlaceholder: t("searchPlaceholder"), selectAll: t("selectAll"), selectedCount: t.raw("selectedCount") as string, summary: t.raw("summary"), unitTypes: catalogT.raw("unitTypes") as Record<ServiceUnitType, string>, visible: t("visible"), categoryLabels: catalogT.raw("categories"),
          }}
        />
      ) : (
        <p className="rounded-card border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">{t("migrationRequired")}</p>
      )}
    </div>
  );
}
