import { PAYMENT_METHODS, type PaymentMethod } from "@/features/payments/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function value(formData: FormData, key: string, max = 600) {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

function money(formData: FormData, key: string) {
  const number = Number(value(formData, key, 24));
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : Number.NaN;
}

function method(value: string): value is PaymentMethod {
  return PAYMENT_METHODS.includes(value as PaymentMethod);
}

export function parseOpenSession(formData: FormData) {
  const openingCash = money(formData, "openingCash");
  const locationId = value(formData, "locationId", 80);
  const fieldErrors: Record<string, string> = {};
  if (!Number.isFinite(openingCash) || openingCash < 0) fieldErrors.openingCash = "invalid";
  if (locationId && !UUID.test(locationId)) fieldErrors.locationId = "invalid";
  return { fieldErrors, input: { locationId: locationId || null, notes: value(formData, "notes"), openingCash }, valid: Object.keys(fieldErrors).length === 0 };
}

export function parsePosPayment(formData: FormData) {
  const amount = money(formData, "amount");
  const paymentMethod = value(formData, "method", 32);
  const orderId = value(formData, "orderId", 80);
  const sessionId = value(formData, "sessionId", 80);
  const idempotencyKey = value(formData, "idempotencyKey", 80);
  const fieldErrors: Record<string, string> = {};
  if (!Number.isFinite(amount) || amount <= 0) fieldErrors.amount = "invalid";
  if (!method(paymentMethod)) fieldErrors.method = "invalid";
  if (!UUID.test(orderId)) fieldErrors.orderId = "invalid";
  if (sessionId && !UUID.test(sessionId)) fieldErrors.sessionId = "invalid";
  if (!UUID.test(idempotencyKey)) fieldErrors.idempotencyKey = "invalid";
  return {
    fieldErrors,
    input: { amount, idempotencyKey, method: method(paymentMethod) ? paymentMethod : "cash" as PaymentMethod, notes: value(formData, "notes"), orderId, reference: value(formData, "reference", 180), sessionId: sessionId || null },
    valid: Object.keys(fieldErrors).length === 0,
  };
}

export function parsePosRefund(formData: FormData) {
  const amount = money(formData, "amount");
  const paymentId = value(formData, "paymentId", 80);
  const sessionId = value(formData, "sessionId", 80);
  const idempotencyKey = value(formData, "idempotencyKey", 80);
  const reason = value(formData, "reason");
  const fieldErrors: Record<string, string> = {};
  if (!Number.isFinite(amount) || amount <= 0) fieldErrors.amount = "invalid";
  if (![paymentId, idempotencyKey].every((item) => UUID.test(item))) fieldErrors.paymentId = "invalid";
  if (sessionId && !UUID.test(sessionId)) fieldErrors.sessionId = "invalid";
  if (!reason) fieldErrors.reason = "required";
  return { fieldErrors, input: { amount, idempotencyKey, paymentId, reason, sessionId: sessionId || null }, valid: Object.keys(fieldErrors).length === 0 };
}

export function parseCloseSession(formData: FormData) {
  const countedCash = money(formData, "countedCash");
  const sessionId = value(formData, "sessionId", 80);
  const fieldErrors: Record<string, string> = {};
  if (!Number.isFinite(countedCash) || countedCash < 0) fieldErrors.countedCash = "invalid";
  if (!UUID.test(sessionId)) fieldErrors.sessionId = "invalid";
  return { fieldErrors, input: { countedCash, notes: value(formData, "notes"), sessionId }, valid: Object.keys(fieldErrors).length === 0 };
}
