import { getTranslations } from "next-intl/server";
import { CatalogManagement } from "@/components/catalog-admin/CatalogManagement";
import { CatalogTools } from "@/components/catalog-admin/CatalogTools";
import {
  archiveCatalogCategoryAction,
  archiveCatalogServiceAction,
  bulkUpdateCatalogServicesAction,
  createCatalogCategoryAction,
  reorderCatalogCategoryAction,
  reactivateCatalogServiceAction,
  saveCatalogCategoryAction,
  saveCatalogServiceAction,
  setCatalogOrderModeAction,
} from "@/features/catalog-admin/server/actions";
import { confirmCatalogImportAction, previewCatalogImportAction } from "@/features/catalog-productization/server/actions";
import { getCatalogAdminSettings } from "@/features/catalog-admin/server/queries";
import type { ServiceUnitType } from "@/features/services/types";
import { Link } from "@/i18n/navigation";

type CatalogSettingsPageProps = { params: Promise<{ locale: string }> };

export default async function CatalogSettingsPage({ params }: CatalogSettingsPageProps) {
  const { locale } = await params;
  const [settings, t, catalogT, localeT, toolsT] = await Promise.all([
    getCatalogAdminSettings(locale),
    getTranslations({ locale, namespace: "common.catalogAdmin" }),
    getTranslations({ locale, namespace: "common.catalog" }),
    getTranslations({ locale, namespace: "common.language.locales" }),
    getTranslations({ locale, namespace: "common.catalogProductization" }),
  ]);

  return (
    <div className="space-y-6">
      <header className="max-w-3xl space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">{t("eyebrow")}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{t("title")}</h1>
        <p className="text-base leading-7 text-muted">{t("description")}</p>
        <Link className="inline-flex min-h-11 items-center text-sm font-semibold !text-primary hover:underline" href="/app/settings/catalog/segments" locale={locale}>{t("segmentsLink")} →</Link>
      </header>
      {settings.available ? (
        <>
        <CatalogTools
          confirmAction={confirmCatalogImportAction.bind(null, locale)}
          exportHref={`/${locale}/app/settings/catalog/export`}
          orderMode={settings.orderMode}
          orderModeAction={setCatalogOrderModeAction.bind(null, locale)}
          previewAction={previewCatalogImportAction.bind(null, locale)}
          text={{
            applyImport: toolsT("applyImport"), cancelHelp: toolsT("cancelHelp"), confirmImport: toolsT("confirmImport"), export: toolsT("export"), exportHelp: toolsT("exportHelp"), import: toolsT("import"), importError: toolsT("importError"), importHelp: toolsT("importHelp"), importSuccess: toolsT("importSuccess"), modes: toolsT.raw("modes"), ordering: toolsT("ordering"), orderingHelp: toolsT("orderingHelp"), preview: toolsT("preview"), previewSummary: toolsT.raw("previewSummary") as string, save: toolsT("save"), saved: toolsT("saved"), title: toolsT("title"),
          }}
        />
        <CatalogManagement
          bulkAction={bulkUpdateCatalogServicesAction.bind(null, locale)}
          categoryArchiveAction={archiveCatalogCategoryAction.bind(null, locale)}
          categories={settings.categories}
          categoryAction={saveCatalogCategoryAction.bind(null, locale)}
          categoryCreateAction={createCatalogCategoryAction.bind(null, locale)}
          categoryReorderAction={reorderCatalogCategoryAction.bind(null, locale)}
          locale={locale}
          serviceAction={saveCatalogServiceAction.bind(null, locale)}
          serviceArchiveAction={archiveCatalogServiceAction.bind(null, locale)}
          serviceReactivateAction={reactivateCatalogServiceAction.bind(null, locale)}
          services={settings.services}
          text={{
            all: t("all"),
            bulkAction: t("bulkAction"), bulkApply: t("bulkApply"), bulkCategory: t("bulkCategory"), bulkConfirm: t.raw("bulkConfirm") as string, bulkOptions: t.raw("bulkOptions"), bulkSelect: t("bulkSelect"),
            activeServices: t.raw("activeServices") as string, categories: t("categories"), categoriesHelp: t("categoriesHelp"), category: t("category"), categoryActive: t("categoryActive"), categoryArchive: t("categoryArchive"), categoryArchiveBlocked: t("categoryArchiveBlocked"), categoryArchiveConfirm: t("categoryArchiveConfirm"), categoryArchived: t("categoryArchived"), categoryCreate: t("categoryCreate"), categoryCreateHelp: t("categoryCreateHelp"), categoryDuplicate: t("categoryDuplicate"), categoryFeatured: t("categoryFeatured"), categoryHiddenHelp: t("categoryHiddenHelp"), categoryImage: t("categoryImage"), categoryName: t("categoryName"), categoryTitle: t("categoryTitle"),
            customerDescription: t("customerDescription"), customerOrderable: t("customerOrderable"), customerPresentation: t("customerPresentation"), customerPresentationHelp: t("customerPresentationHelp"), displayOrder: t("displayOrder"), editPresentation: t("editPresentation"), featured: t("featured"), filters: t.raw("filters"),
            focalPosition: t("focalPosition"), focalPositions: t.raw("focalPositions"), formError: t("formError"), fromPrice: catalogT("fromPrice"), imageHelp: t("imageHelp"), uploadError: t("uploadError"), internalDescription: t("internalDescription"), migrationRequired: t("migrationRequired"), moveDown: t("moveDown"), moveUp: t("moveUp"), noResults: t("noResults"), removeImage: t("removeImage"), save: t("save"), saved: t("saved"), saving: t("saving"), search: t("search"), searchPlaceholder: t("searchPlaceholder"), selectAll: t("selectAll"), selectedCount: t.raw("selectedCount") as string, serviceArchive: t("serviceArchive"), serviceArchiveConfirm: t("serviceArchiveConfirm"), serviceReactivate: toolsT("reactivate"), showArchived: t("showArchived"), summary: t.raw("summary"), translations: toolsT("translations"), translationsHelp: toolsT("translationsHelp"), localeLabels: { de: localeT("de"), en: localeT("en"), es: localeT("es"), fr: localeT("fr"), it: localeT("it") }, unitTypes: catalogT.raw("unitTypes") as Record<ServiceUnitType, string>, visible: t("visible"), categoryLabels: catalogT.raw("categories"),
          }}
        />
        </>
      ) : (
        <p className="rounded-card border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">{t("migrationRequired")}</p>
      )}
    </div>
  );
}
