import {
  CATALOG_SEGMENT_STARTERS,
  type CatalogSegmentStarter,
} from "@/features/catalog-segments/types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function checkbox(formData: FormData, name: string) {
  return formData.get(name) === "true";
}

function nonNegativeInteger(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 1_000_000 ? parsed : null;
}

function ids(formData: FormData, name: string) {
  return [...new Set(formData.getAll(name).map(String))];
}

export function parseCatalogSegmentForm(formData: FormData) {
  const fieldErrors: Record<string, string> = {};
  const segmentIdValue = String(formData.get("segmentId") ?? "").trim();
  const segmentId = segmentIdValue || null;
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const displayOrder = nonNegativeInteger(formData.get("displayOrder"));
  const starterValue = String(formData.get("starter") ?? "none");
  const starter = CATALOG_SEGMENT_STARTERS.includes(starterValue as CatalogSegmentStarter)
    ? starterValue as CatalogSegmentStarter
    : "none";

  if (segmentId && !UUID_PATTERN.test(segmentId)) fieldErrors.segmentId = "invalid";
  if (!name || name.length > 120) fieldErrors.name = "invalid";
  if (description.length > 1000) fieldErrors.description = "invalid";
  if (displayOrder === null) fieldErrors.displayOrder = "invalid";

  const serviceIds = ids(formData, "serviceIds");
  const categoryKeys = ids(formData, "categoryKeys");
  const customerIds = ids(formData, "customerIds");

  if ([...serviceIds, ...customerIds].some((id) => !UUID_PATTERN.test(id))) {
    fieldErrors.selection = "invalid";
  }
  if (categoryKeys.some((key) => !/^[a-z0-9_]{1,64}$/.test(key))) {
    fieldErrors.selection = "invalid";
  }

  const services = serviceIds.map((serviceId, index) => ({
    display_order: nonNegativeInteger(formData.get(`serviceOrder_${serviceId}`), index) ?? index,
    featured: formData.getAll("featuredServiceIds").map(String).includes(serviceId),
    service_id: serviceId,
  }));
  const categories = categoryKeys.map((categoryKey, index) => ({
    category_key: categoryKey,
    display_order: nonNegativeInteger(formData.get(`categoryOrder_${categoryKey}`), index) ?? index,
  }));

  return {
    fieldErrors,
    input: {
      categories,
      customerIds,
      description,
      displayOrder: displayOrder ?? 0,
      isActive: checkbox(formData, "isActive"),
      name,
      portalVisible: checkbox(formData, "portalVisible"),
      segmentId,
      services,
      starter,
    },
    valid: Object.keys(fieldErrors).length === 0,
  };
}

export function parseCustomerSegmentAssignment(formData: FormData) {
  const value = String(formData.get("catalogSegmentId") ?? "").trim();
  return value === "" || UUID_PATTERN.test(value)
    ? { segmentId: value || null, valid: true }
    : { segmentId: null, valid: false };
}
