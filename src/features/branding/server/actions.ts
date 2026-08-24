"use server";

import { revalidatePath } from "next/cache";
import type { BrandingActionState } from "@/features/branding/types";
import {
  parseBrandingForm,
  safeBrandPalette,
  validateBrandMediaFile,
} from "@/features/branding/validation";
import { requireOwner } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type StoredBrandingPaths = {
  logo_path: string | null;
  portal_hero_path: string | null;
  promo_image_path: string | null;
};

type BrandMediaKind = "hero" | "logo" | "promo";

const initialState: BrandingActionState = {
  fieldErrors: {},
  formError: null,
  success: false,
};

function fail(
  fieldErrors: Record<string, string> = {},
  formError: BrandingActionState["formError"] = null,
): BrandingActionState {
  return { fieldErrors, formError, success: false };
}

async function removeBrandFiles(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  paths: string[],
) {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from("brand-media").remove(paths);
  if (error) console.error("Brand media cleanup failed", error.name);
}

async function uploadBrandFile(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string,
  kind: BrandMediaKind,
  file: File,
  extension: string,
) {
  const path = `${organizationId}/${kind}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("brand-media").upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type,
    upsert: false,
  });

  return error ? { error, path: null } : { error: null, path };
}

export async function saveOrganizationBrandingAction(
  locale: string,
  _state: BrandingActionState = initialState,
  formData: FormData,
): Promise<BrandingActionState> {
  void _state;
  const { membership } = await requireOwner(locale);
  const parsed = parseBrandingForm(formData);
  if (!parsed.valid) return fail(parsed.fieldErrors);

  const [logoFile, heroFile, promoFile] = await Promise.all([
    validateBrandMediaFile(formData.get("logo")),
    validateBrandMediaFile(formData.get("hero")),
    validateBrandMediaFile(formData.get("promoImage")),
  ]);
  const fileErrors: Record<string, string> = {};
  if (!logoFile.valid) fileErrors.logo = "invalid";
  if (!heroFile.valid) fileErrors.hero = "invalid";
  if (!promoFile.valid) fileErrors.promoImage = "invalid";
  if (Object.keys(fileErrors).length > 0) return fail(fileErrors);

  const supabase = await createSupabaseServerClient();
  const { data: current, error: currentError } = await supabase
    .from("organization_branding")
    .select("logo_path, portal_hero_path, promo_image_path")
    .eq("organization_id", membership.organization.id)
    .maybeSingle<StoredBrandingPaths>();
  if (currentError) return fail({}, "unavailable");

  const currentPaths: StoredBrandingPaths = current ?? {
    logo_path: null,
    portal_hero_path: null,
    promo_image_path: null,
  };
  const uploadedPaths: string[] = [];

  async function nextPath(
    fileResult: Awaited<ReturnType<typeof validateBrandMediaFile>>,
    field: keyof StoredBrandingPaths,
    kind: BrandMediaKind,
    remove: boolean,
  ) {
    if (remove) return null;
    if (!fileResult.file || !fileResult.extension) return currentPaths[field];
    const upload = await uploadBrandFile(
      supabase,
      membership.organization.id,
      kind,
      fileResult.file,
      fileResult.extension,
    );
    if (upload.path) uploadedPaths.push(upload.path);
    if (upload.error || !upload.path) throw new Error("upload");
    return upload.path;
  }

  let nextLogoPath: string | null;
  let nextHeroPath: string | null;
  let nextPromoImagePath: string | null;

  try {
    nextLogoPath = await nextPath(logoFile, "logo_path", "logo", parsed.input.removeLogo);
    nextHeroPath = await nextPath(heroFile, "portal_hero_path", "hero", parsed.input.removeHero);
    nextPromoImagePath = await nextPath(promoFile, "promo_image_path", "promo", parsed.input.removePromoImage);
  } catch {
    await removeBrandFiles(supabase, uploadedPaths);
    return fail({}, "upload");
  }

  const palette = parsed.input.primaryColor || parsed.input.strongColor || parsed.input.softColor
    ? safeBrandPalette(parsed.input.primaryColor, parsed.input.strongColor, parsed.input.softColor)
    : null;
  const nullIfEmpty = (value: string) => value || null;
  const { error } = await supabase.from("organization_branding").upsert({
    business_address: nullIfEmpty(parsed.input.businessAddress),
    commercial_name: nullIfEmpty(parsed.input.commercialName),
    logo_alt: nullIfEmpty(parsed.input.logoAlt),
    logo_path: nextLogoPath,
    organization_id: membership.organization.id,
    portal_hero_focal_position: parsed.input.portalHeroFocalPosition,
    portal_hero_path: nextHeroPath,
    portal_subtitle: nullIfEmpty(parsed.input.portalSubtitle),
    portal_title: nullIfEmpty(parsed.input.portalTitle),
    primary_color: palette?.primary ?? null,
    promo_body: nullIfEmpty(parsed.input.promoBody),
    promo_cta_href: nullIfEmpty(parsed.input.promoCtaHref),
    promo_cta_label: nullIfEmpty(parsed.input.promoCtaLabel),
    promo_enabled: parsed.input.promoEnabled,
    promo_image_path: nextPromoImagePath,
    promo_title: nullIfEmpty(parsed.input.promoTitle),
    soft_color: palette?.soft ?? null,
    strong_color: palette?.strong ?? null,
    support_email: nullIfEmpty(parsed.input.supportEmail),
    support_phone: nullIfEmpty(parsed.input.supportPhone),
    support_whatsapp: nullIfEmpty(parsed.input.supportWhatsapp),
    website_url: nullIfEmpty(parsed.input.websiteUrl),
  }, { onConflict: "organization_id" });

  if (error) {
    console.error("Organization branding save failed", error.code);
    await removeBrandFiles(supabase, uploadedPaths);
    return fail({}, "generic");
  }

  const obsoletePaths = [
    currentPaths.logo_path && currentPaths.logo_path !== nextLogoPath ? currentPaths.logo_path : null,
    currentPaths.portal_hero_path && currentPaths.portal_hero_path !== nextHeroPath ? currentPaths.portal_hero_path : null,
    currentPaths.promo_image_path && currentPaths.promo_image_path !== nextPromoImagePath ? currentPaths.promo_image_path : null,
  ].filter((path): path is string => Boolean(path));
  await removeBrandFiles(supabase, obsoletePaths);

  revalidatePath(`/${locale}/app`, "layout");
  revalidatePath(`/${locale}/portal`, "layout");
  return { ...initialState, success: true };
}
