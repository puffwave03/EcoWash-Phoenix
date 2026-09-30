const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseManualExternalPayment(formData: FormData) {
  const amount = Number(String(formData.get("amount") ?? ""));
  const method = String(formData.get("method") ?? "");
  const reference = String(formData.get("reference") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  const normalizedAmount = Math.round(amount * 100) / 100;
  const fieldErrors: Record<string, string> = {};
  if (!Number.isFinite(amount) || normalizedAmount <= 0) fieldErrors.amount = "invalid";
  if (method !== "bank_transfer" && method !== "other") fieldErrors.method = "invalid";
  if (!reference || reference.length > 180) fieldErrors.reference = "invalid";
  if (method === "other" && !notes) fieldErrors.notes = "required";
  if (notes.length > 600) fieldErrors.notes = "invalid";
  if (!UUID.test(idempotencyKey)) fieldErrors.idempotencyKey = "invalid";
  return {
    fieldErrors,
    input: { amount: normalizedAmount, idempotencyKey, method, notes, reference },
    valid: Object.keys(fieldErrors).length === 0,
  };
}
