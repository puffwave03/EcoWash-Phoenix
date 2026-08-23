import "server-only";

import type { CustomerPortalOrderRequestState } from "@/features/portal/types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

type RequestItem = {
  quantity: number;
  serviceId: string;
};

function text(formData: FormData, name: string, max: number) {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

function parseItems(value: string): RequestItem[] | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 20) return null;

  const items: RequestItem[] = [];
  const serviceIds = new Set<string>();

  for (const candidate of parsed) {
    if (!candidate || typeof candidate !== "object") return null;

    const serviceId = String((candidate as { serviceId?: unknown }).serviceId ?? "");
    const quantity = Number((candidate as { quantity?: unknown }).quantity);

    if (
      !UUID_PATTERN.test(serviceId)
      || serviceIds.has(serviceId)
      || !Number.isFinite(quantity)
      || quantity <= 0
      || quantity > 10000
      || Number(quantity.toFixed(3)) !== quantity
    ) {
      return null;
    }

    serviceIds.add(serviceId);
    items.push({ quantity, serviceId });
  }

  return items;
}

export function parseCustomerPortalOrderRequest(formData: FormData) {
  const fieldErrors: Record<string, string> = {};
  const requestId = text(formData, "requestId", 80);
  const propertyId = text(formData, "propertyId", 80);
  const requestedPickupAt = text(formData, "requestedPickupAt", 16);
  const items = parseItems(text(formData, "items", 12000));

  if (!UUID_PATTERN.test(requestId)) fieldErrors.requestId = "invalid";
  if (!UUID_PATTERN.test(propertyId)) fieldErrors.propertyId = "invalid";
  if (!DATE_TIME_PATTERN.test(requestedPickupAt)) fieldErrors.requestedPickupAt = "invalid";
  if (!items) fieldErrors.items = "invalid";

  const state: CustomerPortalOrderRequestState = {
    fieldErrors,
    formError: null,
  };

  return {
    input: {
      customerNotes: text(formData, "customerNotes", 1000),
      items: items ?? [],
      propertyId,
      requestedPickupAt,
      requestId,
    },
    state,
    valid: Object.keys(fieldErrors).length === 0,
  };
}
