"use client";

/* eslint-disable @next/next/no-img-element */
import { useActionState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type {
  OrderPhoto,
  PhotoActionState,
  PhotoCategory,
} from "@/features/order-photos/types";

type OrderPhotosPanelText = {
  caption: string;
  categories: Record<PhotoCategory, string>;
  category: string;
  customerHidden: string;
  customerVisible: string;
  deactivate: string;
  empty: string;
  error: string;
  file: string;
  fileHelp: string;
  inactive: string;
  title: string;
  upload: string;
  uploading: string;
};

type OrderPhotosPanelProps = {
  action: (state: PhotoActionState, formData: FormData) => Promise<PhotoActionState>;
  canManageCustomerVisibility?: boolean;
  deactivateAction: (photoId: string) => Promise<void>;
  photos: OrderPhoto[];
  setCustomerVisibilityAction?: (photoId: string, formData: FormData) => Promise<void>;
  text: OrderPhotosPanelText;
};

const initialState: PhotoActionState = { fieldErrors: {}, formError: null };

function fieldClass(hasError = false) {
  return `min-h-11 w-full rounded-control border bg-white px-3 text-sm text-foreground outline-none transition-standard focus:border-primary focus:ring-2 focus:ring-primary/20 ${
    hasError ? "border-red-300" : "border-border"
  }`;
}

function formatSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function OrderPhotosPanel({
  action,
  canManageCustomerVisibility = false,
  deactivateAction,
  photos,
  setCustomerVisibilityAction,
  text,
}: OrderPhotosPanelProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <Card className="space-y-5">
      <h3 className="text-xl font-semibold text-primary">{text.title}</h3>
      <form action={formAction} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        {state.formError ? <p className="md:col-span-3 rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{text.error}</p> : null}
        <label className="space-y-2 text-sm font-semibold text-primary">
          <span>{text.file}</span>
          <input accept="image/jpeg,image/png,image/webp" className={fieldClass(Boolean(state.fieldErrors.photo))} name="photo" type="file" />
          <span className="block text-xs font-normal text-muted">{text.fileHelp}</span>
        </label>
        <label className="space-y-2 text-sm font-semibold text-primary">
          <span>{text.category}</span>
          <select className={fieldClass(Boolean(state.fieldErrors.category))} name="category">
            {Object.entries(text.categories).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold text-primary md:col-span-2">
          <span>{text.caption}</span>
          <input className={fieldClass()} name="caption" />
        </label>
        <Button disabled={isPending} type="submit">{isPending ? text.uploading : text.upload}</Button>
      </form>

      {photos.length === 0 ? (
        <p className="rounded-card border border-border p-4 text-sm text-muted">{text.empty}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {photos.map((photo) => (
            <div className="overflow-hidden rounded-card border border-border bg-white" key={photo.id}>
              {photo.signedUrl ? (
                <img alt={photo.caption || text.categories[photo.category]} className="aspect-[4/3] w-full object-cover" src={photo.signedUrl} />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-secondary-soft text-sm text-muted">
                  {photo.isActive ? text.error : text.inactive}
                </div>
              )}
              <div className="space-y-3 p-4">
                <div>
                  <p className="font-semibold text-primary">{text.categories[photo.category]}</p>
                  <p className="text-sm text-muted">{formatSize(photo.sizeBytes)} · {photo.uploadedByName || "-"}</p>
                  <p className="mt-1 text-xs font-semibold text-muted">
                    {photo.customerVisible ? text.customerVisible : text.customerHidden}
                  </p>
                </div>
                {photo.caption ? <p className="text-sm text-muted">{photo.caption}</p> : null}
                {canManageCustomerVisibility && photo.isActive && setCustomerVisibilityAction ? (
                  <form action={setCustomerVisibilityAction.bind(null, photo.id)}>
                    <input
                      name="customerVisible"
                      type="hidden"
                      value={photo.customerVisible ? "false" : "true"}
                    />
                    <Button type="submit" variant="secondary">
                      {photo.customerVisible ? text.customerHidden : text.customerVisible}
                    </Button>
                  </form>
                ) : null}
                {photo.isActive ? (
                  <form action={deactivateAction.bind(null, photo.id)}>
                    <Button type="submit" variant="secondary">{text.deactivate}</Button>
                  </form>
                ) : <p className="text-sm font-semibold text-muted">{text.inactive}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
