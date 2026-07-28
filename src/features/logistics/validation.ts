import {
  FULFILLMENT_STATUSES,
  type FulfillmentStatus,
} from "@/features/logistics/types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function text(formData: FormData, name: string, max = 180) {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

function optionalUuid(value: string) {
  return value === "" || UUID_PATTERN.test(value);
}

export function optionalDbValue(value: string) {
  return value || null;
}

export function parseLogisticsForm(formData: FormData) {
  const fieldErrors: Record<string, string> = {};
  const recordId = text(formData, "recordId", 80);
  const assignedTo = text(formData, "assignedTo", 80);
  const scheduledAt = text(formData, "scheduledAt", 16);
  const countryCode = text(formData, "countryCode", 2).toUpperCase();
  const fee = Number(text(formData, "fee", 24) || "0");

  if (!optionalUuid(recordId)) fieldErrors.recordId = "invalid";
  if (!optionalUuid(assignedTo)) fieldErrors.assignedTo = "invalid";
  if (scheduledAt && !DATE_TIME_PATTERN.test(scheduledAt)) fieldErrors.scheduledAt = "invalid";
  if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) fieldErrors.countryCode = "invalid";
  if (!Number.isFinite(fee) || fee < 0) fieldErrors.fee = "invalid";

  return {
    fieldErrors,
    input: {
      addressLine1: text(formData, "addressLine1", 180),
      addressLine2: text(formData, "addressLine2", 180),
      assignedTo,
      city: text(formData, "city", 120),
      contactName: text(formData, "contactName", 120),
      contactPhone: text(formData, "contactPhone", 80),
      countryCode,
      fee: Number.isFinite(fee) ? Math.round(fee * 100) / 100 : 0,
      notes: text(formData, "notes", 600),
      postalCode: text(formData, "postalCode", 40),
      recordId,
      scheduledAt,
    },
    valid: Object.keys(fieldErrors).length === 0,
  };
}

export function parseFulfillmentStatus(value: string): FulfillmentStatus | null {
  return FULFILLMENT_STATUSES.includes(value as FulfillmentStatus)
    ? (value as FulfillmentStatus)
    : null;
}
