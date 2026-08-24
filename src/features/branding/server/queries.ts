import "server-only";

import { requireOwner } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ServiceCategoryKey } from "@/features/services/catalog";
import {
  DEFAULT_PORTAL_MEDIA,
  type PortalMediaRegistry,
} from "@/features/portal/media";
import {
  type BrandFocalPosition,
  type OrganizationBrandingSettings,
  type TenantBrandingExperience,
} from "@/features/branding/types";
import { safeBrandPalette } from "@/features/branding/validation";

type BrandingRow = {
  business_address: string | null;
  commercial_name: string | null;
  logo_alt: string | null;
  logo_path: string | null;
  organization_id: string;
  portal_hero_focal_position: BrandFocalPosition;
  portal_hero_path: string | null;
  portal_subtitle: string | null;
  portal_title: string | null;
  primary_color: string | null;
  promo_body: string | null;
  promo_cta_href: string | null;
  promo_cta_label: string | null;
  promo_enabled: boolean;
  promo_image_path: string | null;
  promo_title: string | null;
  soft_color: string | null;
  strong_color: string | null;
  support_email: string | null;
  support_phone: string | null;
  support_whatsapp: string | null;
  website_url: string | null;
};

type CategoryBrandingRow = {
  category_key: string;
  focal_position: BrandFocalPosition;
  image_path: string | null;
};

const BRANDING_SELECT = "organization_id, commercial_name, logo_path, logo_alt, primary_color, strong_color, soft_color, portal_hero_path, portal_hero_focal_position, portal_title, portal_subtitle, support_email, support_phone, support_whatsapp, business_address, website_url, promo_enabled, promo_title, promo_body, promo_image_path, promo_cta_label, promo_cta_href";

function defaultMediaRegistry(): PortalMediaRegistry {
  return {
    categories: Object.fromEntries(
      Object.entries(DEFAULT_PORTAL_MEDIA.categories).map(([key, value]) => [key, { ...value }]),
    ) as Record<ServiceCategoryKey, PortalMediaRegistry["categories"][ServiceCategoryKey]>,
    hero: { ...DEFAULT_PORTAL_MEDIA.hero },
    logistics: { ...DEFAULT_PORTAL_MEDIA.logistics },
  };
}

function publicBrandUrl(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  path: string | null,
) {
  if (!path) return null;
  return supabase.storage.from("brand-media").getPublicUrl(path).data.publicUrl;
}

function emptyExperience(): TenantBrandingExperience {
  return {
    brand: {},
    media: defaultMediaRegistry(),
    portalSubtitle: null,
    portalTitle: null,
    promotion: null,
    support: {
      address: null,
      email: null,
      phone: null,
      websiteUrl: null,
      whatsapp: null,
    },
  };
}

export function resolveTenantBranding(
  row: BrandingRow | null,
  categoryRows: CategoryBrandingRow[],
  assetUrl: (path: string | null) => string | null,
): TenantBrandingExperience {
  if (!row) return emptyExperience();

  const media = defaultMediaRegistry();
  const palette = row.primary_color && row.strong_color && row.soft_color
    ? safeBrandPalette(row.primary_color, row.strong_color, row.soft_color)
    : null;
  const heroUrl = assetUrl(row.portal_hero_path);

  if (heroUrl) {
    media.hero = {
      objectPosition: row.portal_hero_focal_position,
      path: heroUrl,
    };
  }

  for (const category of categoryRows) {
    const imageUrl = assetUrl(category.image_path);
    if (imageUrl && category.category_key in media.categories) {
      media.categories[category.category_key as ServiceCategoryKey] = {
        objectPosition: category.focal_position,
        path: imageUrl,
      };
    }
  }

  const promotion = row.promo_enabled && row.promo_title
    ? {
        body: row.promo_body,
        ctaHref: row.promo_cta_href,
        ctaLabel: row.promo_cta_label,
        imagePath: assetUrl(row.promo_image_path),
        title: row.promo_title,
      }
    : null;

  return {
    brand: {
      logoAlt: row.logo_alt ?? undefined,
      logoPath: assetUrl(row.logo_path),
      name: row.commercial_name ?? undefined,
      primaryColor: palette?.primary ?? undefined,
      primarySoftColor: palette?.soft ?? undefined,
      primaryStrongColor: palette?.strong ?? undefined,
    },
    media,
    portalSubtitle: row.portal_subtitle,
    portalTitle: row.portal_title,
    promotion,
    support: {
      address: row.business_address,
      email: row.support_email,
      phone: row.support_phone,
      websiteUrl: row.website_url,
      whatsapp: row.support_whatsapp,
    },
  };
}

async function brandingRows(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const [brandingResult, categoriesResult] = await Promise.all([
    supabase
      .from("organization_branding")
      .select(BRANDING_SELECT)
      .eq("organization_id", organizationId)
      .maybeSingle<BrandingRow>(),
    supabase
      .from("organization_portal_categories")
      .select("category_key, image_path, focal_position")
      .eq("organization_id", organizationId)
      .returns<CategoryBrandingRow[]>(),
  ]);

  return {
    available: !brandingResult.error && !categoriesResult.error,
    categoryRows: categoriesResult.data ?? [],
    row: brandingResult.data ?? null,
    supabase,
  };
}

export async function getTenantBranding(organizationId: string): Promise<TenantBrandingExperience> {
  const result = await brandingRows(organizationId);
  if (!result.available) return emptyExperience();

  return resolveTenantBranding(
    result.row,
    result.categoryRows,
    (path) => publicBrandUrl(result.supabase, path),
  );
}

export async function getOwnerBrandingSettings(locale: string): Promise<OrganizationBrandingSettings> {
  const { membership } = await requireOwner(locale);
  const result = await brandingRows(membership.organization.id);
  const row = result.row;

  return {
    available: result.available,
    businessAddress: row?.business_address ?? "",
    commercialName: row?.commercial_name ?? "",
    logoAlt: row?.logo_alt ?? "",
    logoPath: row?.logo_path ?? null,
    logoUrl: publicBrandUrl(result.supabase, row?.logo_path ?? null),
    organizationName: membership.organization.name,
    portalHeroFocalPosition: row?.portal_hero_focal_position ?? "center",
    portalHeroPath: row?.portal_hero_path ?? null,
    portalHeroUrl: publicBrandUrl(result.supabase, row?.portal_hero_path ?? null),
    portalSubtitle: row?.portal_subtitle ?? "",
    portalTitle: row?.portal_title ?? "",
    primaryColor: row?.primary_color ?? "",
    promoBody: row?.promo_body ?? "",
    promoCtaHref: row?.promo_cta_href ?? "",
    promoCtaLabel: row?.promo_cta_label ?? "",
    promoEnabled: row?.promo_enabled ?? false,
    promoImagePath: row?.promo_image_path ?? null,
    promoImageUrl: publicBrandUrl(result.supabase, row?.promo_image_path ?? null),
    promoTitle: row?.promo_title ?? "",
    softColor: row?.soft_color ?? "",
    strongColor: row?.strong_color ?? "",
    supportEmail: row?.support_email ?? "",
    supportPhone: row?.support_phone ?? "",
    supportWhatsapp: row?.support_whatsapp ?? "",
    websiteUrl: row?.website_url ?? "",
  };
}
