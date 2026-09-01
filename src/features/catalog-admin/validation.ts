import { BRAND_FOCAL_POSITIONS, type BrandFocalPosition } from "@/features/branding/types";
import { routing } from "@/i18n/routing";
import type { CatalogTranslations, CategoryTranslations } from "@/features/catalog-productization/types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(formData: FormData, name: string, max: number) {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

function integer(value: string, maximum = 100000) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= maximum ? parsed : null;
}

export function isServiceCategoryKey(value: string) {
  return /^[a-z0-9_]{1,64}$/.test(value);
}

export function categoryKeyFromTitle(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64);
}

export function parseServiceTranslations(formData: FormData) {
  const translations: CatalogTranslations = {};
  for (const locale of routing.locales) {
    const name = text(formData, `serviceName_${locale}`, 160);
    const description = text(formData, `serviceDescription_${locale}`, 1000);
    if (name) translations[locale] = { description, name };
  }
  return translations;
}

export function parseCategoryTranslations(formData: FormData) {
  const translations: CategoryTranslations = {};
  for (const locale of routing.locales) {
    const title = text(formData, `categoryTitle_${locale}`, 120);
    if (title) translations[locale] = title;
  }
  return translations;
}

export function parseNewCatalogCategoryForm(formData: FormData) {
  const fieldErrors: Record<string, string> = {};
  const portalTitle = text(formData, "portalTitle", 120);
  const categoryKey = categoryKeyFromTitle(portalTitle);
  if (!portalTitle) fieldErrors.portalTitle = "required";
  if (!isServiceCategoryKey(categoryKey)) fieldErrors.portalTitle = "invalid";
  return { input: { categoryKey, portalTitle }, valid: Object.keys(fieldErrors).length === 0, fieldErrors };
}

export function parseCatalogServiceForm(formData: FormData) {
  const fieldErrors: Record<string, string> = {};
  const serviceId = text(formData, "serviceId", 80);
  const category = text(formData, "portalCategoryKey", 64);
  const portalSortOrder = integer(text(formData, "portalSortOrder", 12));
  const portalDescription = text(formData, "portalDescription", 1000);

  if (!UUID_PATTERN.test(serviceId)) fieldErrors.serviceId = "invalid";
  if (!isServiceCategoryKey(category)) fieldErrors.portalCategoryKey = "invalid";
  if (portalSortOrder === null) fieldErrors.portalSortOrder = "invalid";

  return {
    input: {
      customerOrderable: formData.get("customerOrderable") === "true",
      portalCategoryKey: category,
      portalDescription,
      portalFeatured: formData.get("portalFeatured") === "true",
      portalSortOrder: portalSortOrder ?? 0,
      portalVisible: formData.get("portalVisible") === "true",
      removeImage: formData.get("removeImage") === "true",
      serviceId,
    },
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
  };
}

export function parseCatalogCategoryForm(formData: FormData) {
  const fieldErrors: Record<string, string> = {};
  const categoryKey = text(formData, "categoryKey", 64);
  const focalPosition = text(formData, "focalPosition", 16);
  const portalSortOrder = integer(text(formData, "portalSortOrder", 12));
  const portalTitle = text(formData, "portalTitle", 120);

  if (!isServiceCategoryKey(categoryKey)) fieldErrors.categoryKey = "invalid";
  if (!BRAND_FOCAL_POSITIONS.includes(focalPosition as BrandFocalPosition)) {
    fieldErrors.focalPosition = "invalid";
  }
  if (portalSortOrder === null) fieldErrors.portalSortOrder = "invalid";

  return {
    input: {
      categoryKey,
      focalPosition: focalPosition as BrandFocalPosition,
      portalFeatured: formData.get("portalFeatured") === "true",
      portalSortOrder: portalSortOrder ?? 0,
      portalTitle,
      portalVisible: formData.get("portalVisible") === "true",
      removeImage: formData.get("removeImage") === "true",
    },
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
  };
}

export function parseBulkCatalogForm(formData: FormData) {
  const fieldErrors: Record<string, string> = {};
  const action = text(formData, "bulkAction", 40);
  const category = text(formData, "bulkCategory", 64);
  let serviceIds: string[] = [];

  try {
    const parsed = JSON.parse(text(formData, "serviceIds", 25000));
    if (!Array.isArray(parsed)) throw new Error("invalid");
    serviceIds = [...new Set(parsed.map(String))];
  } catch {
    fieldErrors.serviceIds = "invalid";
  }

  if (serviceIds.length < 1 || serviceIds.length > 500 || serviceIds.some((id) => !UUID_PATTERN.test(id))) {
    fieldErrors.serviceIds = "invalid";
  }
  if (!["show", "hide", "orderable", "notOrderable", "category"].includes(action)) {
    fieldErrors.bulkAction = "invalid";
  }
  if (action === "category" && !isServiceCategoryKey(category)) {
    fieldErrors.bulkCategory = "invalid";
  }

  return {
    input: { action, category, serviceIds },
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
  };
}
