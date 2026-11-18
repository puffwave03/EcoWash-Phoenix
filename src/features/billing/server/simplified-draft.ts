import "server-only";

import { getBillingSimplifiedPosPreview, type BillingSimplifiedPosBridgeResult } from "@/features/billing/server/simplified-pos-bridge";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DraftFailure = "invalid_input" | "draft_conflict" | "draft_incompatible"
  | "draft_creation_failed" | "draft_schema_unavailable";
export type BillingSimplifiedDraftResult =
  | { status: "draft"; invoiceId: string; preview: BillingSimplifiedPosBridgeResult }
  | Exclude<BillingSimplifiedPosBridgeResult, { status: "preview" }>
  | { status: "blocked"; reason: DraftFailure };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Internal service only: no Server Action, public route or UI entry point.
// The bridge enforces the existing role/entitlement/POS and full-payment gates;
// the RPC repeats authoritative checks and creates/prepares atomically.
export async function createBillingSimplifiedDraft(
  locale: string, orderId: string, series: string,
): Promise<BillingSimplifiedDraftResult> {
  const normalizedSeries = series.trim().toUpperCase();
  if (!UUID.test(orderId) || !/^[A-Z0-9-]{1,12}$/.test(normalizedSeries)) {
    return { status: "blocked", reason: "invalid_input" };
  }
  const before = await getBillingSimplifiedPosPreview(locale, orderId);
  if (before.status === "blocked" && before.reason !== "simplified_draft_required") return before;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_simplified_billing_draft", {
    target_order_id: orderId, target_series: normalizedSeries,
  });
  if (error || typeof data !== "string" || !UUID.test(data)) {
    const reasons: Record<string, DraftFailure> = {
      billing_simplified_draft_conflict: "draft_conflict",
      billing_order_already_invoiced: "draft_conflict",
      billing_simplified_draft_incompatible: "draft_incompatible",
    };
    return { status: "blocked", reason: error?.code === "PGRST202" || error?.code === "42883"
      ? "draft_schema_unavailable" : reasons[error?.message ?? ""] ?? "draft_creation_failed" };
  }
  // A later read can block (e.g. concurrent refund). Report the persisted draft
  // ID separately; never imply that a failed preview rolled back its creation.
  return { status: "draft", invoiceId: data, preview: await getBillingSimplifiedPosPreview(locale, orderId) };
}
