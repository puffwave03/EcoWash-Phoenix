export const PHOTO_CATEGORIES = [
  "intake",
  "processing",
  "quality",
  "issue",
  "delivery",
  "payment_proof",
] as const;

export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number];

export type OrderPhoto = {
  caption: string | null;
  category: PhotoCategory;
  createdAt: string;
  id: string;
  isActive: boolean;
  mimeType: string;
  originalFilename: string | null;
  signedUrl: string | null;
  sizeBytes: number;
  uploadedByName: string | null;
};

export type PhotoActionState = {
  fieldErrors: Record<string, string>;
  formError: string | null;
};
