import "server-only";

import { requireMembership } from "@/lib/auth/require-membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OrderPhoto } from "@/features/order-photos/types";

type PhotoRow = {
  caption: string | null;
  category: OrderPhoto["category"];
  created_at: string;
  id: string;
  is_active: boolean;
  mime_type: string;
  original_filename: string | null;
  size_bytes: number;
  storage_bucket: string;
  storage_path: string;
  uploaded_by_profile: { display_name: string } | { display_name: string }[] | null;
};

function relationName(value: { display_name?: string } | { display_name?: string }[] | null) {
  const row = Array.isArray(value) ? value[0] : value;

  return row?.display_name ?? null;
}

export async function getOrderPhotos(locale: string, orderId: string): Promise<OrderPhoto[]> {
  const { membership } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("order_photos")
    .select("id, category, storage_bucket, storage_path, original_filename, mime_type, size_bytes, caption, uploaded_by_profile:profiles!order_photos_uploaded_by_fkey(display_name), created_at, is_active")
    .eq("organization_id", membership.organization.id)
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .returns<PhotoRow[]>();

  if (error || !data) {
    console.error("Order photos query failed", error?.code);
    return [];
  }

  return Promise.all(data.map(async (row) => {
    let signedUrl: string | null = null;

    if (row.is_active) {
      const result = await supabase.storage
        .from(row.storage_bucket)
        .createSignedUrl(row.storage_path, 600);
      signedUrl = result.data?.signedUrl ?? null;
      if (result.error) console.error("Photo signed URL failed", result.error.message);
    }

    return {
      caption: row.caption,
      category: row.category,
      createdAt: row.created_at,
      id: row.id,
      isActive: row.is_active,
      mimeType: row.mime_type,
      originalFilename: row.original_filename,
      signedUrl,
      sizeBytes: row.size_bytes,
      uploadedByName: relationName(row.uploaded_by_profile),
    };
  }));
}
