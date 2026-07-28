"use server";

import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/auth/require-membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PhotoActionState } from "@/features/order-photos/types";
import {
  fileExtension,
  hasAllowedImageSignature,
  parsePhotoForm,
  sanitizeFilename,
} from "@/features/order-photos/validation";

const initialState: PhotoActionState = { fieldErrors: {}, formError: null };

function fail(fieldErrors: Record<string, string> = {}, formError: string | null = "generic") {
  return { fieldErrors, formError };
}

function revalidateOrder(locale: string, orderId: string) {
  revalidatePath(`/${locale}/app/orders/${orderId}`);
}

export async function uploadOrderPhotoAction(
  locale: string,
  orderId: string,
  _state: PhotoActionState = initialState,
  formData: FormData,
) {
  void _state;

  const { fieldErrors, input, valid } = parsePhotoForm(formData);
  if (!valid || !input.file) return fail(fieldErrors, null);

  const extension = fileExtension(input.file.type);
  if (!extension) return fail({ photo: "mime" }, null);
  if (!(await hasAllowedImageSignature(input.file))) return fail({ photo: "signature" }, null);

  const { membership } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const storagePath = `${membership.organization.id}/${orderId}/${crypto.randomUUID()}.${extension}`;
  const upload = await supabase.storage
    .from("order-media")
    .upload(storagePath, input.file, {
      cacheControl: "3600",
      contentType: input.file.type,
      upsert: false,
    });

  if (upload.error) {
    console.error("Order photo upload failed", upload.error.message);
    return fail();
  }

  const { error } = await supabase.rpc("register_order_photo", {
    target_caption: input.caption || null,
    target_category: input.category,
    target_mime_type: input.file.type,
    target_order_id: orderId,
    target_original_filename: sanitizeFilename(input.file.name),
    target_size_bytes: input.file.size,
    target_storage_path: storagePath,
  });

  if (error) {
    console.error("Order photo registration failed", error.code);
    return fail();
  }

  revalidateOrder(locale, orderId);
  return initialState;
}

export async function deactivateOrderPhotoAction(locale: string, orderId: string, photoId: string) {
  await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("deactivate_order_photo", {
    target_photo_id: photoId,
  });

  if (error) console.error("Order photo deactivate failed", error.code);
  revalidateOrder(locale, orderId);
}
