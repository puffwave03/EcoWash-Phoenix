"use server";
import { revalidatePath } from "next/cache";
import { recordPosPaymentAction } from "./actions";
import { requirePosAccess } from "./access";
import { requireShopTerminalAccess } from "@/features/shop-terminal/server/access";
import { requireEntitlement } from "@/features/entitlements/server/resolver";
import { FEATURES } from "@/features/entitlements/feature-catalog";
import { parsePosPayment } from "@/features/pos/validation";
import type { PosActionState } from "@/features/pos/types";
import { isServiceDeclarationDate } from "@/features/billing/fiscal-coverage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MANUAL_CARD_PROVIDER } from "@/features/pos/providers/types";

export async function recordPosPaymentWithCoverageAction(locale: string, state: PosActionState, form: FormData): Promise<PosActionState> {
  // No declaration: the existing POS workflow remains the sole monetary writer.
  if (form.get("serviceEvidence") !== "on") return recordPosPaymentAction(locale, state, form);
  await requirePosAccess(locale);
  await requireShopTerminalAccess(locale);
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  const parsed = parsePosPayment(form);
  const date = form.get("servicePerformedOn");
  if (!parsed.valid || !isServiceDeclarationDate(date)) {
    return { fieldErrors: { ...parsed.fieldErrors, servicePerformedOn: "invalid" }, formError: "validation", success: false };
  }
  const client = await createSupabaseServerClient();
  const p = parsed.input;
  // One call, atomic payment + evidence. Never fall back to another charge on failure.
  let error: { code?: string } | null;
  try {
    ({ error } = await client.rpc("record_pos_payment_with_service_evidence", {
    target_order_id: p.orderId, target_amount: p.amount, target_method: p.method,
    target_pos_session_id: p.sessionId, target_reference: p.reference || null,
    target_notes: p.notes || null, target_idempotency_key: p.idempotencyKey,
    target_service_performed_on: date, target_confirmed: true,
    target_provider: p.method === "card" ? MANUAL_CARD_PROVIDER : null,
    target_provider_reference: p.method === "card" ? p.reference || null : null,
    target_external_status: p.method === "card" ? "recorded_manual" : null,
    }));
  } catch {
    return { fieldErrors: {}, formError: "payment", success: false, paymentOutcome: "uncertain" };
  }
  if (error) {
    if (!["22023", "42501", "55000", "23505", "25000"].includes(error.code ?? "")) {
      return { fieldErrors: {}, formError: "payment", success: false, paymentOutcome: "uncertain" };
    }
    return { fieldErrors: { servicePerformedOn: "invalid" }, formError: "payment", success: false };
  }
  for (const path of ["pos", "daily-close", `orders/${p.orderId}`, "customers", "billing"]) revalidatePath(`/${locale}/app/${path}`);
  return { fieldErrors: {}, formError: null, success: true };
}
