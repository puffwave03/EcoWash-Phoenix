import type { ServiceCategoryKey } from "@/features/services/catalog";

export type PortalMediaAsset = {
  objectPosition?: string;
  path: string;
};

export type PortalBrandPresentation = {
  logoAlt?: string;
  logoPath?: string | null;
  name?: string;
  primaryColor?: string;
  primarySoftColor?: string;
  primaryStrongColor?: string;
};

export type PortalMediaRegistry = {
  categories: Record<ServiceCategoryKey, PortalMediaAsset>;
  hero: PortalMediaAsset;
  logistics: PortalMediaAsset;
};

export const DEFAULT_PORTAL_BRAND: PortalBrandPresentation = {};

/**
 * Local, production-safe defaults for the customer experience.
 * A future tenant branding layer can replace this registry without changing
 * Portal components or the catalog/order domain.
 */
export const DEFAULT_PORTAL_MEDIA: PortalMediaRegistry = {
  hero: {
    path: "/images/portal/hero-linen-care.webp",
    objectPosition: "center",
  },
  logistics: {
    path: "/images/portal/category-pickup-delivery.webp",
    objectPosition: "center",
  },
  categories: {
    laundry_by_weight: {
      path: "/images/home/hero/folded-green-textiles.webp",
      objectPosition: "center",
    },
    ironing: {
      path: "/images/home/services/ironing-finishing.webp",
      objectPosition: "center",
    },
    bed_linen: {
      path: "/images/home/hero/folded-white-linen.webp",
      objectPosition: "center",
    },
    home_textiles: {
      path: "/images/home/industries/vacation-rental.webp",
      objectPosition: "center",
    },
    dry_cleaning: {
      path: "/images/home/services/dry-cleaning.webp",
      objectPosition: "center",
    },
    leather: {
      path: "/images/home/services/dry-cleaning.webp",
      objectPosition: "center",
    },
    rugs_bulky: {
      path: "/images/portal/category-rugs-bulky.webp",
      objectPosition: "center",
    },
    self_service: {
      path: "/images/portal/category-self-service.webp",
      objectPosition: "center",
    },
    professional_services: {
      path: "/images/home/industries/professional-laundry.webp",
      objectPosition: "center",
    },
    special_services: {
      path: "/images/portal/category-special-care.webp",
      objectPosition: "center",
    },
    traditional_ceremonial: {
      path: "/images/portal/category-traditional-ceremonial.webp",
      objectPosition: "center",
    },
  },
};

export function portalCategoryMedia(
  category: string,
  registry: PortalMediaRegistry = DEFAULT_PORTAL_MEDIA,
): PortalMediaAsset | null {
  return category in registry.categories
    ? registry.categories[category as ServiceCategoryKey]
    : null;
}
