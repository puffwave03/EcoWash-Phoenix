export type SubmissionAttempt = {
  version: 1;
  key: string;
  payload: string;
  status: "pending" | "completed" | "rejected";
  orderId: string | null;
  orderNumber: string | null;
  rejectionReason?: string;
};

export function readSubmissionAttempt(storage: Pick<Storage, "getItem">, key: string):
  { kind: "missing" } | { kind: "unavailable" } | { kind: "invalid" } | { kind: "present"; attempt: SubmissionAttempt } {
  let raw: string | null;
  try { raw = storage.getItem(key); } catch { return { kind: "unavailable" }; }
  if (raw === null) return { kind: "missing" };
  try {
    const value = JSON.parse(raw) as Partial<SubmissionAttempt>;
    if (value.version !== 1 || typeof value.key !== "string" || typeof value.payload !== "string"
      || (value.status !== "pending" && value.status !== "completed" && value.status !== "rejected")
      || (value.orderId !== null && typeof value.orderId !== "string")
      || (value.orderNumber !== null && typeof value.orderNumber !== "string")
      || (value.status === "completed" && (!value.orderId || !value.orderNumber))
      || (value.status === "rejected" && (typeof value.rejectionReason !== "string" || !value.rejectionReason || value.orderId !== null || value.orderNumber !== null))) return { kind: "invalid" };
    const payload = JSON.parse(value.payload) as { idempotencyKey?: unknown };
    if (payload.idempotencyKey !== value.key) return { kind: "invalid" };
    return { kind: "present", attempt: value as SubmissionAttempt };
  } catch { return { kind: "invalid" }; }
}

export function persistSubmissionAttempt(storage: Pick<Storage, "setItem" | "getItem">, key: string, attempt: SubmissionAttempt) {
  const serialized = JSON.stringify(attempt);
  try {
    storage.setItem(key, serialized);
    return storage.getItem(key) === serialized;
  } catch { return false; }
}

export function removeSubmissionAttempt(storage: Pick<Storage, "removeItem" | "getItem">, key: string) {
  try {
    storage.removeItem(key);
    return storage.getItem(key) === null;
  } catch { return false; }
}
