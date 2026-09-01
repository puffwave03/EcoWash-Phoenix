"use server";

import { revalidatePath } from "next/cache";
import { validateBrandMediaFile } from "@/features/branding/validation";
import type { CatalogAdminActionState } from "@/features/catalog-admin/types";
import {
  parseBulkCatalogForm,
  parseCategoryTranslations,
  parseCatalogCategoryForm,
  parseCatalogServiceForm,
  parseNewCatalogCategoryForm,
  parseServiceTranslations,
} from "@/features/catalog-admin/validation";
import { CATALOG_ORDER_MODES, type CatalogOrderMode } from "@/features/catalog-productization/types";
import { routing } from "@/i18n/routing";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const initialState: CatalogAdminActionState = {
  fieldErrors: {},
  formError: null,
  success: false,
};

function fail(
  fieldErrors: Record<string, string> = {},
  formError: CatalogAdminActionState["formError"] = null,
): CatalogAdminActionState {
  return { fieldErrors, formError, success: false };
}

function revalidateCatalog(locale: string) {
  for (const activeLocale of new Set([locale, ...routing.locales])) {
    revalidatePath(`/${activeLocale}/app/settings/catalog`);
    revalidatePath(`/${activeLocale}/portal`);
    revalidatePath(`/${activeLocale}/portal/requests/new`);
    revalidatePath(`/${activeLocale}/app/services`);
    revalidatePath(`/${activeLocale}/app/shop`);
  }
}

async function activeCategoryExists(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string,
  categoryKey: string,
) {
  const { data } = await supabase.from("organization_portal_categories").select("category_key")
    .eq("organization_id", organizationId).eq("category_key", categoryKey).eq("is_active", true).maybeSingle();
  return Boolean(data);
}

export async function createCatalogCategoryAction(
  locale: string,
  _state: CatalogAdminActionState = initialState,
  formData: FormData,
): Promise<CatalogAdminActionState> {
  void _state;
  const { membership } = await requireOwnerOrManager(locale);
  const parsed = parseNewCatalogCategoryForm(formData);
  if (!parsed.valid) return fail(parsed.fieldErrors);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("organization_portal_categories").insert({
    category_key: parsed.input.categoryKey,
    organization_id: membership.organization.id,
    portal_title: parsed.input.portalTitle,
  });
  if (error) return fail({}, error.code === "23505" ? "duplicate" : error.code === "42703" ? "migration" : "generic");
  revalidateCatalog(locale);
  return { ...initialState, success: true };
}

function managedMediaPath(path: string | null, organizationId: string, kind: "category" | "service") {
  return Boolean(path?.startsWith(`${organizationId}/${kind}/`)) ? path : null;
}

async function removeMedia(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  path: string | null,
) {
  if (!path) return;
  const { error } = await supabase.storage.from("brand-media").remove([path]);
  if (error) console.error("Catalog media cleanup failed", error.name);
}

async function uploadMedia(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string,
  kind: "category" | "service",
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

export async function saveCatalogServiceAction(
  locale: string,
  _state: CatalogAdminActionState = initialState,
  formData: FormData,
): Promise<CatalogAdminActionState> {
  void _state;
  const { membership, user } = await requireOwnerOrManager(locale);
  const parsed = parseCatalogServiceForm(formData);
  if (!parsed.valid) return fail(parsed.fieldErrors);
  const translations = parseServiceTranslations(formData);

  const image = await validateBrandMediaFile(formData.get("image"));
  if (!image.valid) return fail({ image: "invalid" });

  const supabase = await createSupabaseServerClient();
  if (!await activeCategoryExists(supabase, membership.organization.id, parsed.input.portalCategoryKey)) {
    return fail({ portalCategoryKey: "invalid" });
  }
  const { data: current, error: currentError } = await supabase
    .from("services")
    .select("portal_image_path")
    .eq("organization_id", membership.organization.id)
    .eq("id", parsed.input.serviceId)
    .maybeSingle<{ portal_image_path: string | null }>();

  if (currentError || !current) return fail({}, currentError?.code === "42703" ? "migration" : "generic");
  const oldManagedPath = managedMediaPath(current.portal_image_path, membership.organization.id, "service");
  let nextImagePath = parsed.input.removeImage ? null : current.portal_image_path;
  let uploadedPath: string | null = null;

  if (image.file && image.extension) {
    const upload = await uploadMedia(
      supabase,
      membership.organization.id,
      "service",
      image.file,
      image.extension,
    );
    if (upload.error || !upload.path) return fail({}, "upload");
    uploadedPath = upload.path;
    nextImagePath = upload.path;
  }

  const { error } = await supabase
    .from("services")
    .update({
      category: parsed.input.portalCategoryKey,
      customer_orderable: parsed.input.customerOrderable,
      portal_category_key: parsed.input.portalCategoryKey,
      portal_description: parsed.input.portalDescription || null,
      portal_featured: parsed.input.portalFeatured,
      portal_image_path: nextImagePath,
      portal_sort_order: parsed.input.portalSortOrder,
      portal_visible: parsed.input.portalVisible,
      updated_by: user.id,
    })
    .eq("organization_id", membership.organization.id)
    .eq("id", parsed.input.serviceId);

  if (error) {
    console.error("Catalog service save failed", error.code);
    await removeMedia(supabase, uploadedPath);
    return fail({}, error.code === "42703" ? "migration" : "generic");
  }

  const translationRows = Object.entries(translations).map(([translationLocale, translation]) => ({
    description: translation.description || null,
    locale: translationLocale,
    name: translation.name,
    organization_id: membership.organization.id,
    service_id: parsed.input.serviceId,
  }));
  if (translationRows.length > 0) {
    const { error: translationError } = await supabase.from("service_catalog_translations")
      .upsert(translationRows, { onConflict: "organization_id,service_id,locale" });
    if (translationError) return fail({}, translationError.code === "42P01" ? "migration" : "generic");
  }

  if (oldManagedPath && oldManagedPath !== nextImagePath) await removeMedia(supabase, oldManagedPath);
  revalidateCatalog(locale);
  return { ...initialState, success: true };
}

export async function saveCatalogCategoryAction(
  locale: string,
  _state: CatalogAdminActionState = initialState,
  formData: FormData,
): Promise<CatalogAdminActionState> {
  void _state;
  const { membership } = await requireOwnerOrManager(locale);
  const parsed = parseCatalogCategoryForm(formData);
  if (!parsed.valid) return fail(parsed.fieldErrors);
  const translations = parseCategoryTranslations(formData);

  const image = await validateBrandMediaFile(formData.get("image"));
  if (!image.valid) return fail({ image: "invalid" });
  const supabase = await createSupabaseServerClient();
  const { data: current, error: currentError } = await supabase
    .from("organization_portal_categories")
    .select("image_path")
    .eq("organization_id", membership.organization.id)
    .eq("category_key", parsed.input.categoryKey)
    .maybeSingle<{ image_path: string | null }>();

  if (currentError) return fail({}, currentError.code === "42703" ? "migration" : "generic");
  const oldManagedPath = managedMediaPath(current?.image_path ?? null, membership.organization.id, "category");
  let nextImagePath = parsed.input.removeImage ? null : current?.image_path ?? null;
  let uploadedPath: string | null = null;

  if (image.file && image.extension) {
    const upload = await uploadMedia(
      supabase,
      membership.organization.id,
      "category",
      image.file,
      image.extension,
    );
    if (upload.error || !upload.path) return fail({}, "upload");
    uploadedPath = upload.path;
    nextImagePath = upload.path;
  }

  const { error } = await supabase.from("organization_portal_categories").upsert({
    category_key: parsed.input.categoryKey,
    focal_position: parsed.input.focalPosition,
    image_path: nextImagePath,
    organization_id: membership.organization.id,
    portal_featured: parsed.input.portalFeatured,
    portal_sort_order: parsed.input.portalSortOrder,
    portal_title: parsed.input.portalTitle || null,
    portal_visible: parsed.input.portalVisible,
  }, { onConflict: "organization_id,category_key" });

  if (error) {
    console.error("Catalog category save failed", error.code);
    await removeMedia(supabase, uploadedPath);
    return fail({}, error.code === "42703" ? "migration" : "generic");
  }

  const translationRows = Object.entries(translations).map(([translationLocale, title]) => ({
    category_key: parsed.input.categoryKey,
    locale: translationLocale,
    organization_id: membership.organization.id,
    title,
  }));
  if (translationRows.length > 0) {
    const { error: translationError } = await supabase.from("category_catalog_translations")
      .upsert(translationRows, { onConflict: "organization_id,category_key,locale" });
    if (translationError) return fail({}, translationError.code === "42P01" ? "migration" : "generic");
  }

  if (oldManagedPath && oldManagedPath !== nextImagePath) await removeMedia(supabase, oldManagedPath);
  revalidateCatalog(locale);
  return { ...initialState, success: true };
}

export async function reorderCatalogCategoryAction(
  locale: string,
  _state: CatalogAdminActionState = initialState,
  formData: FormData,
): Promise<CatalogAdminActionState> {
  void _state;
  const { membership } = await requireOwnerOrManager(locale);
  const categoryKey = String(formData.get("categoryKey") ?? "").trim();
  const direction = String(formData.get("direction") ?? "");
  if (!/^[a-z0-9_]{1,64}$/.test(categoryKey) || !["up", "down"].includes(direction)) {
    return fail({ categoryKey: "invalid" });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error: readError } = await supabase
    .from("organization_portal_categories")
    .select("category_key, portal_sort_order")
    .eq("organization_id", membership.organization.id)
    .eq("is_active", true)
    .order("portal_sort_order", { ascending: true })
    .order("category_key", { ascending: true })
    .returns<Array<{ category_key: string; portal_sort_order: number }>>();
  if (readError) return fail({}, readError.code === "42703" ? "migration" : "generic");

  const orderedKeys = (data ?? []).map((category) => category.category_key);
  const currentIndex = orderedKeys.indexOf(categoryKey);
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedKeys.length) {
    return { ...initialState, success: true };
  }

  [orderedKeys[currentIndex], orderedKeys[targetIndex]] = [orderedKeys[targetIndex], orderedKeys[currentIndex]];
  const { error } = await supabase.from("organization_portal_categories").upsert(
    orderedKeys.map((key, index) => ({
      category_key: key,
      organization_id: membership.organization.id,
      portal_sort_order: index,
    })),
    { onConflict: "organization_id,category_key" },
  );
  if (error) return fail({}, error.code === "42703" ? "migration" : "generic");

  revalidateCatalog(locale);
  return { ...initialState, success: true };
}

export async function archiveCatalogCategoryAction(
  locale: string,
  _state: CatalogAdminActionState = initialState,
  formData: FormData,
): Promise<CatalogAdminActionState> {
  void _state;
  await requireOwnerOrManager(locale);
  const categoryKey = String(formData.get("categoryKey") ?? "").trim();
  if (!/^[a-z0-9_]{1,64}$/.test(categoryKey)) return fail({ categoryKey: "invalid" });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("archive_catalog_category", { target_category_key: categoryKey });
  if (error) return fail({}, error.code === "23503" ? "categoryNotEmpty" : error.code === "42883" ? "migration" : "generic");
  revalidateCatalog(locale);
  return { ...initialState, success: true };
}

export async function archiveCatalogServiceAction(
  locale: string,
  _state: CatalogAdminActionState = initialState,
  formData: FormData,
): Promise<CatalogAdminActionState> {
  void _state;
  const { membership, user } = await requireOwnerOrManager(locale);
  const serviceId = String(formData.get("serviceId") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(serviceId)) return fail({ serviceId: "invalid" });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("services")
    .update({ customer_orderable: false, is_active: false, portal_visible: false, updated_by: user.id })
    .eq("organization_id", membership.organization.id).eq("id", serviceId).select("id").maybeSingle();
  if (error || !data) return fail({}, error?.code === "42703" ? "migration" : "generic");
  revalidateCatalog(locale);
  return { ...initialState, success: true };
}

export async function reactivateCatalogServiceAction(
  locale: string,
  _state: CatalogAdminActionState = initialState,
  formData: FormData,
): Promise<CatalogAdminActionState> {
  void _state;
  const { membership, user } = await requireOwnerOrManager(locale);
  const serviceId = String(formData.get("serviceId") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(serviceId)) return fail({ serviceId: "invalid" });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("services")
    .update({ is_active: true, updated_by: user.id })
    .eq("organization_id", membership.organization.id).eq("id", serviceId).select("id").maybeSingle();
  if (error || !data) return fail({}, error?.code === "42703" ? "migration" : "generic");
  revalidateCatalog(locale);
  return { ...initialState, success: true };
}

export async function setCatalogOrderModeAction(
  locale: string,
  _state: CatalogAdminActionState = initialState,
  formData: FormData,
): Promise<CatalogAdminActionState> {
  void _state;
  await requireOwnerOrManager(locale);
  const orderMode = String(formData.get("orderMode") ?? "") as CatalogOrderMode;
  if (!CATALOG_ORDER_MODES.includes(orderMode)) return fail({ orderMode: "invalid" });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_catalog_order_mode", { target_mode: orderMode });
  if (error) return fail({}, error.code === "42883" ? "migration" : "generic");
  revalidateCatalog(locale);
  return { ...initialState, success: true };
}

export async function bulkUpdateCatalogServicesAction(
  locale: string,
  _state: CatalogAdminActionState = initialState,
  formData: FormData,
): Promise<CatalogAdminActionState> {
  void _state;
  const { membership, user } = await requireOwnerOrManager(locale);
  const parsed = parseBulkCatalogForm(formData);
  if (!parsed.valid) return fail(parsed.fieldErrors);

  const updates = parsed.input.action === "show"
    ? { portal_visible: true }
    : parsed.input.action === "hide"
      ? { portal_visible: false }
      : parsed.input.action === "orderable"
        ? { customer_orderable: true }
        : parsed.input.action === "notOrderable"
          ? { customer_orderable: false }
          : { portal_category_key: parsed.input.category };

  const supabase = await createSupabaseServerClient();
  if (parsed.input.action === "category" && !await activeCategoryExists(supabase, membership.organization.id, parsed.input.category)) {
    return fail({ bulkCategory: "invalid" });
  }
  const { error } = await supabase
    .from("services")
    .update({ ...updates, ...(parsed.input.action === "category" ? { category: parsed.input.category } : {}), updated_by: user.id })
    .eq("organization_id", membership.organization.id)
    .in("id", parsed.input.serviceIds);

  if (error) {
    console.error("Catalog bulk update failed", error.code);
    return fail({}, error.code === "42703" ? "migration" : "generic");
  }

  revalidateCatalog(locale);
  return { ...initialState, success: true };
}
