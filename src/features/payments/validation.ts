import {
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/features/payments/types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function text(formData: FormData, name: string, max = 180) {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

function optionalUuid(value: string) {
  return value === "" || UUID_PATTERN.test(value);
}

function isMethod(value: string): value is PaymentMethod {
  return PAYMENT_METHODS.includes(value as PaymentMethod);
}

export function optionalDbValue(value: string) {
  return value || null;
}

export function parsePaymentForm(formData: FormData) {
  const fieldErrors: Record<string, string> = {};
  const amount = Number(text(formData, "amount", 24));
  const method = text(formData, "method", 32);
  const paidAt = text(formData, "paidAt", 16);
  const proofPhotoId = text(formData, "proofPhotoId", 80);

  if (!Number.isFinite(amount) || amount <= 0) fieldErrors.amount = "invalid";
  if (!isMethod(method)) fieldErrors.method = "invalid";
  if (paidAt && !DATE_TIME_PATTERN.test(paidAt)) fieldErrors.paidAt = "invalid";
  if (!optionalUuid(proofPhotoId)) fieldErrors.proofPhotoId = "invalid";

  return {
    fieldErrors,
    input: {
      amount: Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0,
      method: isMethod(method) ? method : "cash",
      notes: text(formData, "notes", 600),
      paidAt,
      proofPhotoId,
      reference: text(formData, "reference", 180),
    },
    valid: Object.keys(fieldErrors).length === 0,
  };
}

export function parseReasonForm(formData: FormData) {
  const reason = text(formData, "reason", 600);
  return {
    fieldErrors: reason ? {} : { reason: "required" },
    input: { reason },
    valid: Boolean(reason),
  };
}

export function parseRefundForm(formData: FormData) {
  const amount = Number(text(formData, "amount", 24));
  const reason = text(formData, "reason", 600);
  const fieldErrors: Record<string, string> = {};

  if (!Number.isFinite(amount) || amount <= 0) fieldErrors.amount = "invalid";
  if (!reason) fieldErrors.reason = "required";

  return {
    fieldErrors,
    input: {
      amount: Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0,
      reason,
    },
    valid: Object.keys(fieldErrors).length === 0,
  };
}
