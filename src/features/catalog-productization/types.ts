import type { AppLocale } from "@/i18n/routing";
import type { ServiceUnitType } from "@/features/services/types";

export const CATALOG_ORDER_MODES = ["alphabetical_asc", "alphabetical_desc", "manual"] as const;
export type CatalogOrderMode = (typeof CATALOG_ORDER_MODES)[number];

export type CatalogTranslation = { description: string; name: string };
export type CatalogTranslations = Partial<Record<AppLocale, CatalogTranslation>>;
export type CategoryTranslations = Partial<Record<AppLocale, string>>;

export type CatalogPresentation = {
  categorySortOrder: number;
  categoryTitle: string;
  description: string | null;
  manualSortOrder: number;
  name: string;
  orderMode: CatalogOrderMode;
  serviceId: string;
};

export type CatalogImportRow = {
  canonicalDescription: string;
  canonicalName: string;
  categoryKey: string;
  categoryTranslations: CategoryTranslations;
  customerOrderable: boolean;
  customerVisible: boolean;
  featured: boolean;
  manualSortOrder: number;
  orderMode: CatalogOrderMode;
  serviceCode: string;
  serviceId: string;
  status: "active" | "archived";
  translations: CatalogTranslations;
  unitType: ServiceUnitType;
};

export type CatalogImportPreviewItem = {
  action: "archive" | "create" | "error" | "unchanged" | "update";
  code: string;
  errors: string[];
  name: string;
  row: number;
};

export type CatalogImportState = {
  error: string | null;
  payload: string | null;
  preview: {
    archives: number;
    creates: number;
    errors: number;
    items: CatalogImportPreviewItem[];
    unchanged: number;
    updates: number;
  } | null;
  success: boolean;
};
