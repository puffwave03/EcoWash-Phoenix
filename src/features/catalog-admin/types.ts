import type { BrandFocalPosition } from "@/features/branding/types";
import type { ServiceUnitType } from "@/features/services/types";

export type CatalogAdminService = {
  amount: number | null;
  code: string | null;
  currency: string | null;
  customerOrderable: boolean;
  id: string;
  internalCategory: string | null;
  internalDescription: string | null;
  isActive: boolean;
  name: string;
  portalCategoryKey: string | null;
  portalDescription: string;
  portalFeatured: boolean;
  portalImagePath: string | null;
  portalImageUrl: string | null;
  portalSortOrder: number;
  portalVisible: boolean;
  priceIsFrom: boolean;
  unitType: ServiceUnitType;
};

export type CatalogAdminCategory = {
  activeServiceCount: number;
  categoryKey: string;
  focalPosition: BrandFocalPosition;
  imagePath: string | null;
  imageUrl: string | null;
  isActive: boolean;
  portalFeatured: boolean;
  portalSortOrder: number;
  portalTitle: string;
  portalVisible: boolean;
};

export type CatalogAdminSettings = {
  available: boolean;
  categories: CatalogAdminCategory[];
  services: CatalogAdminService[];
};

export type CatalogAdminActionState = {
  fieldErrors: Record<string, string>;
  formError: "categoryNotEmpty" | "duplicate" | "generic" | "migration" | "upload" | null;
  success: boolean;
};
