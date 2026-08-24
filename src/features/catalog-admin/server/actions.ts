"use server";

import { revalidatePath } from "next/cache";
import { validateBrandMediaFile } from "@/features/branding/validation";
import type { CatalogAdminActionState } from "@/features/catalog-admin/types";
import {
  parseBulkCatalogForm,
  parseCatalogCategoryForm,
  parseCatalogServiceForm,
} from "@/features/catalog-admin/validation";
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
  revalidatePath(`/${locale}/app/settings/catalog`);
  revalidatePath(`/${locale}/portal`);
  revalidatePath(`/${locale}/portal/requests/new`);
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

  const image = await validateBrandMediaFile(formData.get("image"));
  if (!image.valid) return fail({ image: "invalid" });

  const supabase = await createSupabaseServerClient();
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

  if (oldManagedPath && oldManagedPath !== nextImagePath) await removeMedia(supabase, oldManagedPath);
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
  const { error } = await supabase
    .from("services")
    .update({ ...updates, updated_by: user.id })
    .eq("organization_id", membership.organization.id)
    .in("id", parsed.input.serviceIds);

  if (error) {
    console.error("Catalog bulk update failed", error.code);
    return fail({}, error.code === "42703" ? "migration" : "generic");
  }

  revalidateCatalog(locale);
  return { ...initialState, success: true };
}
