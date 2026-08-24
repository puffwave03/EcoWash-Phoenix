import type { Service } from "@/features/services/types";

export const SERVICE_CATEGORY_KEYS = [
  "laundry_by_weight",
  "ironing",
  "bed_linen",
  "home_textiles",
  "dry_cleaning",
  "leather",
  "rugs_bulky",
  "self_service",
  "professional_services",
  "special_services",
  "traditional_ceremonial",
] as const;

export type ServiceCategoryKey = (typeof SERVICE_CATEGORY_KEYS)[number];

export function groupServicesByCategory<T extends Pick<Service, "category">>(services: T[]) {
  const groups = new Map<string, T[]>();

  for (const service of services) {
    const category = service.category?.trim() || "other";
    groups.set(category, [...(groups.get(category) ?? []), service]);
  }

  return [...groups.entries()].map(([category, items]) => ({ category, items }));
}

export function catalogCategoryLabel(
  category: string,
  labels: Partial<Record<string, string>>,
) {
  return labels[category] ?? category.replaceAll("_", " ");
}
