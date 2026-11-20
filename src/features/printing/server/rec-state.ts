import "server-only";

import { getBillingSimplifiedIssued } from "@/features/billing/server/queries";
import { getBillingSimplifiedPosPreview } from "@/features/billing/server/simplified-pos-bridge";
import { billingSimplifiedIssuedDocument } from "@/features/billing/simplified-document";
import { FEATURES } from "@/features/entitlements/feature-catalog";
import { requireEntitlement } from "@/features/entitlements/server/resolver";
import { PRODUCTION_STATUSES, type ProductionStatus } from "@/features/orders/types";
import { PAYMENT_METHODS, PAYMENT_RECORD_STATUSES, type Payment } from "@/features/payments/types";
import { requirePosAccess } from "@/features/pos/server/access";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Amount = number | string;
type OrderRow = {
  id: string; organization_id: string; customer_id: string; currency: string;
  subtotal: Amount; discount_amount: Amount; total: Amount;
  is_active: boolean; production_status: string;
};
type LedgerRow = {
  id: string; organization_id: string; order_id: string; amount: Amount;
  status: Payment["status"]; method: Payment["method"]; channel: Payment["channel"];
  paid_at: string; refunded_from_payment_id: string | null;
};
type ItemRow = {
  id: string; organization_id: string; order_id: string;
  description: string; quantity: number | string; unit_price: Amount; line_total: Amount;
};
type InvoiceRow = {
  id: string; organization_id: string; customer_id: string;
  fiscal_document_type: string; document_status: string;
  invoice_number: string | null; sequence_number: number | string | null; issued_at: string | null;
};

export type RecEconomicState =
  | { status: "unknown"; reason: string }
  | { status: "anomaly"; reason: string }
  | {
      status: "unpaid" | "partial" | "paid" | "refunded";
      total: number; confirmed: number; refunded: number; collectedNet: number; outstanding: number;
      confirmedPaymentCount: number; multiplePayments: boolean; collectionTimes: string[];
      // The ledger has no fiscal advance/settlement allocation. Multiple rows
      // can be mixed tender or advances; neither proves fiscal eligibility.
      advanceTreatment: "not_assessed";
    };
export type RecBillingState =
  | { status: "unknown" | "none" }
  | { status: "simplified_issued"; invoiceId: string; invoiceNumber: string; snapshot: "identified" | "unavailable" }
  | { status: "compatible_draft"; invoiceId: string }
  | { status: "conflict"; invoiceId: string; reason: string };
export type RecState = {
  state: "unpaid" | "partial_or_advance" | "paid_fiscal_review" | "simplified_issued"
    | "compatible_draft" | "billing_conflict" | "refunded" | "reconciliation_anomaly" | "unknown";
  orderId: string;
  economic: RecEconomicState;
  billing: RecBillingState;
  print: { status: "not_requested"; source: "operational_order" | "billing_snapshot" | null; documentId: string | null };
  fiscalIssuanceAllowed: false;
  reason: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 200;
const emptyPrint: RecState["print"] = { status: "not_requested", source: null, documentId: null };

// Same persisted cent-precision contract as the canonical POS/Billing bridge.
// These are ledger consistency checks, never a new price/tax calculation.
function cents(value: Amount): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) return null;
  const amount = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(amount) ? amount : null;
}
const sum = (amounts: number[]) => amounts.reduce((a, b) => a + b, 0);

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;
async function readOrderRows<T extends { id: string; organization_id: string; order_id: string }>(
  client: Client, table: "payments" | "order_items", columns: string, orgId: string, orderId: string,
): Promise<T[]> {
  const rows: T[] = [];
  let expected: number | null = null;
  for (;;) {
    let query = client.from(table).select(columns, { count: "exact" })
      .eq("organization_id", orgId).eq("order_id", orderId);
    if (table === "order_items") query = query.eq("is_active", true);
    const page = await query.order("id").range(rows.length, rows.length + PAGE_SIZE - 1).returns<T[]>();
    if (page.error || !Array.isArray(page.data) || !Number.isSafeInteger(page.count) || page.count! < 0
      || (expected !== null && page.count !== expected) || page.data.length > PAGE_SIZE
      || rows.length + page.data.length > page.count!
      || (page.data.length === 0 && rows.length !== page.count)) throw new Error("incomplete_read");
    expected = page.count;
    for (const row of page.data) {
      if (!UUID.test(row.id) || row.organization_id !== orgId || row.order_id !== orderId
        || rows.some((existing) => existing.id === row.id)) throw new Error("invalid_reference");
      rows.push(row);
    }
    if (rows.length === expected) return rows;
  }
}

async function readEconomic(client: Client, orgId: string, order: OrderRow): Promise<RecEconomicState> {
  try {
    const rows = await readOrderRows<LedgerRow>(client, "payments",
      "id, organization_id, order_id, amount, status, method, channel, paid_at, refunded_from_payment_id", orgId, order.id);
    const summary = await client.rpc("get_order_payment_summary", { target_order_id: order.id })
      .single<{ total_due: Amount; total_paid: Amount; balance_due: Amount; payment_status: string }>();
    if (summary.error || !summary.data) throw new Error("summary_unavailable");
    if (rows.some((p) => (typeof p.amount !== "number" && typeof p.amount !== "string")
      || !PAYMENT_RECORD_STATUSES.includes(p.status) || !PAYMENT_METHODS.includes(p.method)
      || !["order", "pos", "online", "manual_external"].includes(p.channel)
      || typeof p.paid_at !== "string" || !Number.isFinite(Date.parse(p.paid_at))
      || (p.refunded_from_payment_id !== null && !UUID.test(p.refunded_from_payment_id)))) throw new Error("incomplete_payment");
    if (rows.some((p) => cents(p.amount) === null || cents(p.amount)! <= 0)) {
      return { status: "anomaly", reason: "invalid_payment_amount" };
    }
    const confirmed = rows.filter((p) => p.status === "confirmed");
    const refunds = rows.filter((p) => p.status === "refunded");
    if (rows.some((p) => p.status !== "refunded" && p.refunded_from_payment_id !== null)
      || refunds.some((p) => !confirmed.some((original) => original.id === p.refunded_from_payment_id
        && original.method === p.method && original.channel === p.channel))) {
      return { status: "anomaly", reason: "invalid_refund_reference" };
    }
    for (const original of confirmed) {
      if (sum(refunds.filter((p) => p.refunded_from_payment_id === original.id).map((p) => cents(p.amount)!)) > cents(original.amount)!) {
        return { status: "anomaly", reason: "refund_exceeds_payment" };
      }
    }
    const total = cents(order.total), collected = sum(confirmed.map((p) => cents(p.amount)!));
    const returned = sum(refunds.map((p) => cents(p.amount)!)), net = collected - returned;
    if (total === null || ![collected, returned, net].every(Number.isSafeInteger) || net < 0 || net > total) {
      return { status: "anomaly", reason: "invalid_ledger_totals" };
    }
    const expectedStatus = total === 0 ? "paid" : net <= 0 && returned > 0 ? "refunded"
      : net === 0 && rows.some((p) => p.status === "void") ? "void" : net === 0 ? "unpaid"
        : net < total ? "partially_paid" : "paid";
    if (cents(summary.data.total_due) !== total || cents(summary.data.total_paid) !== net
      || cents(summary.data.balance_due) !== total - net || summary.data.payment_status !== expectedStatus) {
      return { status: "anomaly", reason: "payment_reconciliation_failed" };
    }
    if (rows.some((p) => p.status === "pending")) return { status: "unknown", reason: "payment_pending" };
    if (total === 0) return { status: "unknown", reason: "zero_total_requires_review" };
    return {
      status: refunds.length ? "refunded" : net === 0 ? "unpaid" : net < total ? "partial" : "paid",
      total: total / 100, confirmed: collected / 100, refunded: returned / 100,
      collectedNet: net / 100, outstanding: (total - net) / 100,
      confirmedPaymentCount: confirmed.length, multiplePayments: confirmed.length > 1,
      collectionTimes: [...new Set(confirmed.map((p) => p.paid_at))].sort(), advanceTreatment: "not_assessed",
    };
  } catch {
    return { status: "unknown", reason: "payment_read_unreliable" };
  }
}

/** Internal advisory reader only: no Server Action, UI entrypoint or mutation.
 * Owner/Manager + Billing + POS boundaries match the existing Billing bridge.
 * Print source identification is not print permission or proof of printing.
 * Separate reads are not a transaction/issuance lock; future mutations must
 * revalidate through canonical SQL. No financial/fiscal eligibility is granted.
 */
export async function resolveOrderRecState(locale: string, orderId: string): Promise<RecState> {
  const { membership } = await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  const pos = await requirePosAccess(locale);
  const orgId = membership.organization.id;
  let economic: RecEconomicState = { status: "unknown", reason: "not_read" };
  let billing: RecBillingState = { status: "unknown" };
  const result = (state: RecState["state"], reason: string | null = null, print = emptyPrint): RecState => ({
    state, orderId, economic, billing, print: { ...print }, fiscalIssuanceAllowed: false, reason,
  });
  if (!UUID.test(orderId) || pos.membership.organization.id !== orgId) return result("unknown", "order_unavailable");

  try {
    const client = await createSupabaseServerClient();
    const orderResult = await client.from("orders")
      .select("id, organization_id, customer_id, currency, subtotal, discount_amount, total, is_active, production_status")
      .eq("organization_id", orgId).eq("id", orderId).maybeSingle<OrderRow>();
    const order = orderResult.data;
    if (orderResult.error || !order || order.id !== orderId || order.organization_id !== orgId || !UUID.test(order.customer_id)) {
      return result("unknown", "order_unavailable");
    }
    // Discover the persisted document before evaluating current collection or
    // order eligibility. A refund/cancelled order must not hide an issued fact.
    const links = await client.from("invoice_orders").select("organization_id, invoice_id, order_id, is_active", { count: "exact" })
      .eq("organization_id", orgId).eq("order_id", orderId).eq("is_active", true).limit(2)
      .returns<Array<{ organization_id: string; invoice_id: string; order_id: string; is_active: boolean }>>();
    if (links.error || !Array.isArray(links.data) || links.count !== links.data.length
      || links.data.some((l) => l.organization_id !== orgId || l.order_id !== orderId || !l.is_active || !UUID.test(l.invoice_id))) {
      return result("unknown", "billing_read_unreliable");
    }
    if (links.data.length > 1) return result("unknown", "ambiguous_invoice_links");
    let invoice: InvoiceRow | null = null;
    if (links.data.length) {
      const read = await client.from("invoices")
        .select("id, organization_id, customer_id, fiscal_document_type, document_status, invoice_number, sequence_number, issued_at")
        .eq("organization_id", orgId).eq("id", links.data[0].invoice_id).maybeSingle<InvoiceRow>();
      invoice = read.data;
      if (read.error || !invoice || invoice.id !== links.data[0].invoice_id || invoice.organization_id !== orgId
        || !UUID.test(invoice.customer_id) || !["ordinaria", "simplificada"].includes(invoice.fiscal_document_type)
        || !["draft", "issued", "cancelled"].includes(invoice.document_status)) return result("unknown", "billing_read_unreliable");
    } else billing = { status: "none" };

    if (invoice?.fiscal_document_type === "simplificada" && invoice.document_status === "issued") {
      if (order.customer_id !== invoice.customer_id
        || !invoice.invoice_number?.trim() || !invoice.issued_at || !Number.isFinite(Date.parse(invoice.issued_at))
        || !Number.isSafeInteger(Number(invoice.sequence_number)) || Number(invoice.sequence_number) < 1) {
        return result("unknown", "invalid_issued_identity");
      }
      billing = { status: "simplified_issued", invoiceId: invoice.id, invoiceNumber: invoice.invoice_number, snapshot: "unavailable" };
      try {
        const detail = await getBillingSimplifiedIssued(locale, invoice.id);
        const snapshot = billingSimplifiedIssuedDocument(detail);
        if (snapshot.document.id !== invoice.id || snapshot.document.number !== invoice.invoice_number
          || snapshot.document.issuedAt !== invoice.issued_at || detail.invoice.sequenceNumber !== Number(invoice.sequence_number)
          || detail.invoice.customerId !== invoice.customer_id || detail.invoice.orderIds.length !== 1
          || detail.invoice.orderIds[0] !== orderId || detail.items.some((item) => item.sourceOrderId !== orderId)) {
          return result("unknown", "invalid_snapshot_reference");
        }
        billing = { ...billing, snapshot: "identified" };
      } catch {
        return result("unknown", "snapshot_read_unreliable");
      }
      economic = await readEconomic(client, orgId, order);
      return result("simplified_issued", null, { status: "not_requested", source: "billing_snapshot", documentId: invoice.id });
    }

    economic = await readEconomic(client, orgId, order);
    if (economic.status === "unknown") return result("unknown", economic.reason);
    const subtotal = cents(order.subtotal), discount = cents(order.discount_amount), total = cents(order.total);
    if (typeof order.is_active !== "boolean" || !order.is_active || !PRODUCTION_STATUSES.includes(order.production_status as ProductionStatus)
      || order.production_status === "cancelled" || !/^[A-Z]{3}$/.test(order.currency)
      || subtotal === null || discount === null || total === null || subtotal - discount !== total) {
      return result("unknown", "order_data_unreliable");
    }
    const items = await readOrderRows<ItemRow>(client, "order_items",
      "id, organization_id, order_id, description, quantity, unit_price, line_total", orgId, orderId);
    if (!items.length || items.some((item) => !item.description?.trim() || !Number.isFinite(Number(item.quantity))
      || Number(item.quantity) <= 0 || cents(item.unit_price) === null || cents(item.line_total) === null)
      || sum(items.map((item) => cents(item.line_total)!)) !== subtotal) return result("unknown", "order_items_unreliable");
    if (invoice) billing = { status: "conflict", invoiceId: invoice.id, reason: "incompatible_billing_document" };
    if (economic.status === "anomaly") return result("reconciliation_anomaly", economic.reason);
    if (economic.status === "refunded") return result("refunded", "refund_requires_review");
    if (invoice) {
      if (invoice.fiscal_document_type !== "simplificada" || invoice.document_status !== "draft"
        || invoice.customer_id !== order.customer_id || invoice.invoice_number !== null
        || invoice.sequence_number !== null || invoice.issued_at !== null) return result("billing_conflict", "incompatible_billing_document");
      // Reuse the existing read-only compatibility checks; never prepare a
      // draft to discover whether a compatible one already exists.
      const preview = await getBillingSimplifiedPosPreview(locale, orderId);
      if (preview.status === "blocked") {
        if (["read_failed", "billing_schema_unavailable", "order_unavailable"].includes(preview.reason)) {
          billing = { status: "unknown" };
          return result("unknown", "draft_read_unreliable");
        }
        return result("billing_conflict", preview.reason);
      }
      if (preview.context.activeInvoice?.id !== invoice.id || preview.ticket.document.document.id !== invoice.id
        || preview.context.orderId !== orderId || preview.context.orderTotal !== economic.total
        || preview.context.posPaidTotal !== economic.collectedNet || preview.context.outstanding !== economic.outstanding) {
        billing = { status: "unknown" };
        return result("unknown", "draft_reference_mismatch");
      }
      billing = { status: "compatible_draft", invoiceId: invoice.id };
      return result("compatible_draft");
    }
    if (economic.status === "unpaid") return result("unpaid", null, { status: "not_requested", source: "operational_order", documentId: null });
    return result(economic.status === "partial" ? "partial_or_advance" : "paid_fiscal_review");
  } catch {
    return result("unknown", "read_unreliable");
  }
}
