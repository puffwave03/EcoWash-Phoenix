import {
  fileExtension,
  hasAllowedImageSignature,
  ORDER_PHOTO_MIME_TYPES,
} from "@/features/order-photos/validation";
import {
  BRAND_FOCAL_POSITIONS,
  type BrandFocalPosition,
} from "@/features/branding/types";

export const MAX_BRAND_MEDIA_BYTES = 2 * 1024 * 1024;

function text(formData: FormData, name: string, max: number) {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

function optionalEmail(value: string) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function optionalPhone(value: string) {
  return !value || /^\+?[0-9 ()-]{6,40}$/.test(value);
}

function optionalHttpUrl(value: string) {
  if (!value) return true;

  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function normalizeHexColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : null;
}

function relativeLuminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [red, green, blue] = channels.map((channel) => (
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(first: string, second: string) {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));

  return (lighter + 0.05) / (darker + 0.05);
}

export function safeBrandPalette(primary: string, strong: string, soft: string) {
  const normalized = {
    primary: normalizeHexColor(primary),
    soft: normalizeHexColor(soft),
    strong: normalizeHexColor(strong),
  };

  if (!normalized.primary || !normalized.strong || !normalized.soft) return null;
  if (contrastRatio(normalized.primary, "#FFFFFF") < 4.5) return null;
  if (contrastRatio(normalized.strong, "#FFFFFF") < 4.5) return null;
  if (contrastRatio(normalized.primary, normalized.soft) < 4.5) return null;

  return normalized;
}

export function parseBrandingForm(formData: FormData) {
  const fieldErrors: Record<string, string> = {};
  const input = {
    businessAddress: text(formData, "businessAddress", 320),
    commercialName: text(formData, "commercialName", 120),
    logoAlt: text(formData, "logoAlt", 180),
    portalHeroFocalPosition: text(formData, "portalHeroFocalPosition", 16),
    portalSubtitle: text(formData, "portalSubtitle", 320),
    portalTitle: text(formData, "portalTitle", 120),
    primaryColor: text(formData, "primaryColor", 7),
    promoBody: text(formData, "promoBody", 500),
    promoCtaHref: text(formData, "promoCtaHref", 500),
    promoCtaLabel: text(formData, "promoCtaLabel", 80),
    promoEnabled: formData.get("promoEnabled") === "true",
    promoTitle: text(formData, "promoTitle", 120),
    removeHero: formData.get("removeHero") === "true",
    removeLogo: formData.get("removeLogo") === "true",
    removePromoImage: formData.get("removePromoImage") === "true",
    softColor: text(formData, "softColor", 7),
    strongColor: text(formData, "strongColor", 7),
    supportEmail: text(formData, "supportEmail", 254),
    supportPhone: text(formData, "supportPhone", 40),
    supportWhatsapp: text(formData, "supportWhatsapp", 40),
    websiteUrl: text(formData, "websiteUrl", 500),
  };

  if (!BRAND_FOCAL_POSITIONS.includes(input.portalHeroFocalPosition as BrandFocalPosition)) {
    fieldErrors.portalHeroFocalPosition = "invalid";
  }
  const hasAnyColor = Boolean(input.primaryColor || input.strongColor || input.softColor);
  if (hasAnyColor && !safeBrandPalette(input.primaryColor, input.strongColor, input.softColor)) {
    fieldErrors.colors = "contrast";
  }
  if (!optionalEmail(input.supportEmail)) fieldErrors.supportEmail = "invalid";
  if (!optionalPhone(input.supportPhone)) fieldErrors.supportPhone = "invalid";
  if (!optionalPhone(input.supportWhatsapp)) fieldErrors.supportWhatsapp = "invalid";
  if (!optionalHttpUrl(input.websiteUrl)) fieldErrors.websiteUrl = "invalid";
  if (!optionalHttpUrl(input.promoCtaHref)) fieldErrors.promoCtaHref = "invalid";
  if (input.promoEnabled && !input.promoTitle) fieldErrors.promoTitle = "required";

  return {
    fieldErrors,
    input: {
      ...input,
      portalHeroFocalPosition: input.portalHeroFocalPosition as BrandFocalPosition,
    },
    valid: Object.keys(fieldErrors).length === 0,
  };
}

export async function validateBrandMediaFile(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size === 0) return { extension: null, file: null, valid: true };
  const extension = fileExtension(file.type);
  const mimeAllowed = ORDER_PHOTO_MIME_TYPES.includes(file.type as (typeof ORDER_PHOTO_MIME_TYPES)[number]);
  const valid = Boolean(
    extension
    && mimeAllowed
    && file.size <= MAX_BRAND_MEDIA_BYTES
    && await hasAllowedImageSignature(file)
  );

  return { extension, file, valid };
}
