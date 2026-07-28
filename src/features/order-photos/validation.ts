import {
  PHOTO_CATEGORIES,
  type PhotoCategory,
} from "@/features/order-photos/types";

export const MAX_ORDER_PHOTO_BYTES = 1024 * 1024;
export const ORDER_PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const EXTENSIONS: Record<(typeof ORDER_PHOTO_MIME_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function text(formData: FormData, name: string, max = 180) {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

export function isPhotoCategory(value: string): value is PhotoCategory {
  return PHOTO_CATEGORIES.includes(value as PhotoCategory);
}

export function fileExtension(mimeType: string) {
  return EXTENSIONS[mimeType as keyof typeof EXTENSIONS] ?? null;
}

export function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

export async function hasAllowedImageSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());

  if (file.type === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (file.type === "image/png") {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
      && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  }

  if (file.type === "image/webp") {
    return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  }

  return false;
}

export function parsePhotoForm(formData: FormData) {
  const fieldErrors: Record<string, string> = {};
  const category = text(formData, "category", 32);
  const caption = text(formData, "caption", 600);
  const file = formData.get("photo");

  if (!isPhotoCategory(category)) fieldErrors.category = "invalid";
  if (!(file instanceof File) || file.size === 0) {
    fieldErrors.photo = "required";
  } else {
    if (!ORDER_PHOTO_MIME_TYPES.includes(file.type as (typeof ORDER_PHOTO_MIME_TYPES)[number])) {
      fieldErrors.photo = "mime";
    }
    if (file.size > MAX_ORDER_PHOTO_BYTES) fieldErrors.photo = "size";
  }

  return {
    fieldErrors,
    input: {
      caption,
      category: isPhotoCategory(category) ? category : "intake",
      file: file instanceof File ? file : null,
    },
    valid: Object.keys(fieldErrors).length === 0,
  };
}
