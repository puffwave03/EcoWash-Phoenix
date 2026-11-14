import type { PrintOrderContext } from "@/features/printing/types";

export type PosBillingSnapshot = {
  workflow: "pos_billing_payment_link"; order_id: string; order_number: string;
  created_at: string; due_at: string | null; customer_name: string; customer_notes: string | null;
  currency: string; subtotal: number; discount: number; total: number;
  items: Array<Pick<PrintOrderContext["items"][number], "id" | "description" | "quantity" | "unitType" | "unitPrice" | "lineTotal">>;
};
export type PosBillingDocument = {
  id: string; number: string; issuedAt: string; paymentId: string; role: "advance" | "final";
  event: "advance" | "service"; total: number; base: number; tax: number; roundingDelta: number | null;
  issuer?: { name: string; taxId: string; address: string };
  snapshot: PosBillingSnapshot | null;
};
export type PosBillingDocuments = { state: "ready"; enabled: boolean; documents: PosBillingDocument[] } | { state: "unavailable" };
export const isPaymentLinkId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

// Keep a malformed response distinct from a successful empty history.
export function parsePosBillingDocuments(value: unknown): PosBillingDocuments {
  if (!value || typeof value !== "object") return { state: "unavailable" };
  const data = value as { enabled?: unknown; documents?: unknown };
  if (typeof data.enabled !== "boolean" || !Array.isArray(data.documents)) return { state: "unavailable" };
  for (const item of data.documents) {
    if (!item || typeof item !== "object") return { state: "unavailable" };
    const d = item as PosBillingDocument;
    if (![d.id, d.paymentId].every(id => typeof id === "string" && isPaymentLinkId(id))
      || typeof d.number !== "string" || !d.number || typeof d.issuedAt !== "string"
      || ![d.total, d.base, d.tax].every(n => typeof n === "number" && Number.isFinite(n))
      || !["advance", "final"].includes(d.role) || !["advance", "service"].includes(d.event)) return { state: "unavailable" };
    if (d.snapshot !== null) {
      const s = d.snapshot;
      if (!s || s.workflow !== "pos_billing_payment_link" || !isPaymentLinkId(s.order_id)
        || ![s.order_number, s.created_at, s.customer_name, s.currency].every(v => typeof v === "string")
        || (s.due_at !== null && typeof s.due_at !== "string") || (s.customer_notes !== null && typeof s.customer_notes !== "string")
        || ![s.subtotal, s.discount, s.total].every(n => typeof n === "number" && Number.isFinite(n))
        || !Array.isArray(s.items) || s.items.some(i => !i || typeof i.id !== "string" || typeof i.description !== "string"
          || typeof i.unitType !== "string" || ![i.quantity, i.unitPrice, i.lineTotal].every(n => typeof n === "number" && Number.isFinite(n)))) return { state: "unavailable" };
    }
  }
  return { state: "ready", enabled: data.enabled, documents: data.documents as PosBillingDocument[] };
}
