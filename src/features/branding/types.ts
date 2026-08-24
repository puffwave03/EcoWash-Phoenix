import type {
  PortalBrandPresentation,
  PortalMediaRegistry,
} from "@/features/portal/media";

export const BRAND_FOCAL_POSITIONS = ["center", "top", "bottom", "left", "right"] as const;
export type BrandFocalPosition = (typeof BRAND_FOCAL_POSITIONS)[number];

export type TenantBrandingSupport = {
  address: string | null;
  email: string | null;
  phone: string | null;
  websiteUrl: string | null;
  whatsapp: string | null;
};

export type TenantBrandingPromotion = {
  body: string | null;
  ctaHref: string | null;
  ctaLabel: string | null;
  imagePath: string | null;
  title: string;
};

export type TenantBrandingExperience = {
  brand: PortalBrandPresentation;
  media: PortalMediaRegistry;
  portalSubtitle: string | null;
  portalTitle: string | null;
  promotion: TenantBrandingPromotion | null;
  support: TenantBrandingSupport;
};

export type OrganizationBrandingSettings = {
  available: boolean;
  businessAddress: string;
  commercialName: string;
  logoAlt: string;
  logoPath: string | null;
  logoUrl: string | null;
  organizationName: string;
  portalHeroFocalPosition: BrandFocalPosition;
  portalHeroPath: string | null;
  portalHeroUrl: string | null;
  portalSubtitle: string;
  portalTitle: string;
  primaryColor: string;
  promoBody: string;
  promoCtaHref: string;
  promoCtaLabel: string;
  promoEnabled: boolean;
  promoImagePath: string | null;
  promoImageUrl: string | null;
  promoTitle: string;
  softColor: string;
  strongColor: string;
  supportEmail: string;
  supportPhone: string;
  supportWhatsapp: string;
  websiteUrl: string;
};

export type BrandingActionState = {
  fieldErrors: Record<string, string>;
  formError: "generic" | "unavailable" | "upload" | null;
  success: boolean;
};
