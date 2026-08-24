import type { CatalogAdminCategory, CatalogAdminService } from "@/features/catalog-admin/types";

export const CATALOG_SEGMENT_STARTERS = [
  "none",
  "vacationRental",
  "hotel",
  "restaurant",
  "privateCustomer",
] as const;

export type CatalogSegmentStarter = (typeof CATALOG_SEGMENT_STARTERS)[number];

export type CatalogSegmentServiceLink = {
  displayOrder: number;
  featured: boolean;
  serviceId: string;
};

export type CatalogSegmentCategoryLink = {
  categoryKey: string;
  displayOrder: number;
};

export type CatalogSegment = {
  categoryLinks: CatalogSegmentCategoryLink[];
  customerIds: string[];
  description: string;
  displayOrder: number;
  id: string;
  isActive: boolean;
  name: string;
  portalVisible: boolean;
  serviceLinks: CatalogSegmentServiceLink[];
};

export type CatalogSegmentCustomer = {
  catalogSegmentId: string | null;
  displayName: string;
  id: string;
  isActive: boolean;
};

export type CatalogSegmentAdminSettings = {
  available: boolean;
  categories: CatalogAdminCategory[];
  customers: CatalogSegmentCustomer[];
  segments: CatalogSegment[];
  services: CatalogAdminService[];
};

export type CatalogSegmentActionState = {
  fieldErrors: Record<string, string>;
  formError: "duplicate" | "generic" | "migration" | null;
  success: boolean;
};

export type CustomerSegmentAssignment = {
  currentSegmentId: string | null;
  segments: Array<{ id: string; name: string }>;
};
