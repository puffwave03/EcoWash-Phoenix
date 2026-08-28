"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePosAccess } from "@/features/pos/server/access";
import type { PosActionState } from "@/features/pos/types";
import { parseCloseSession, parseOpenSession, parsePosPayment, parsePosRefund } from "@/features/pos/validation";
import { MANUAL_CARD_PROVIDER } from "@/features/pos/providers/types";

const initialState: PosActionState = { fieldErrors: {}, formError: null, success: false };
const fail = (fieldErrors: Record<string, string> = {}, formError = "generic"): PosActionState => ({ fieldErrors, formError, success: false });

function refresh(locale: string, orderId?: string) {
  revalidatePath(`/${locale}/app/pos`);
  if (orderId) revalidatePath(`/${locale}/app/orders/${orderId}`);
  revalidatePath(`/${locale}/app/billing`);
  revalidatePath(`/${locale}/app/customers`);
}

export async function openPosSessionAction(locale: string, _state: PosActionState = initialState, formData: FormData) {
  void _state;
  const parsed = parseOpenSession(formData);
  if (!parsed.valid) return fail(parsed.fieldErrors, "validation");
  await requirePosAccess(locale);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("open_pos_session", { target_location_id: parsed.input.locationId, target_notes: parsed.input.notes || null, target_opening_cash: parsed.input.openingCash });
  if (error) { console.error("POS open failed", error.code); return fail({}, error.code === "23505" ? "alreadyOpen" : "generic"); }
  refresh(locale);
  return { ...initialState, success: true };
}

export async function recordPosPaymentAction(locale: string, _state: PosActionState = initialState, formData: FormData) {
  void _state;
  const parsed = parsePosPayment(formData);
  if (!parsed.valid) return fail(parsed.fieldErrors, "validation");
  await requirePosAccess(locale);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("record_pos_payment", {
    target_amount: parsed.input.amount, target_external_status: parsed.input.method === "card" ? "recorded_manual" : null,
    target_idempotency_key: parsed.input.idempotencyKey, target_method: parsed.input.method, target_notes: parsed.input.notes || null,
    target_order_id: parsed.input.orderId, target_pos_session_id: parsed.input.sessionId, target_provider: parsed.input.method === "card" ? MANUAL_CARD_PROVIDER : null,
    target_provider_reference: parsed.input.method === "card" ? parsed.input.reference || null : null, target_reference: parsed.input.reference || null,
  });
  if (error) { console.error("POS payment failed", error.code); return fail({}, "payment"); }
  refresh(locale, parsed.input.orderId);
  return { ...initialState, success: true };
}

export async function refundPosPaymentAction(locale: string, _state: PosActionState = initialState, formData: FormData) {
  void _state;
  const parsed = parsePosRefund(formData);
  if (!parsed.valid) return fail(parsed.fieldErrors, "validation");
  await requirePosAccess(locale);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("record_pos_refund", { target_amount: parsed.input.amount, target_idempotency_key: parsed.input.idempotencyKey, target_payment_id: parsed.input.paymentId, target_pos_session_id: parsed.input.sessionId, target_reason: parsed.input.reason });
  if (error) { console.error("POS refund failed", error.code); return fail({}, "refund"); }
  refresh(locale);
  return { ...initialState, success: true };
}

export async function closePosSessionAction(locale: string, _state: PosActionState = initialState, formData: FormData) {
  void _state;
  const parsed = parseCloseSession(formData);
  if (!parsed.valid) return fail(parsed.fieldErrors, "validation");
  await requirePosAccess(locale);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("close_pos_session", { target_counted_cash: parsed.input.countedCash, target_notes: parsed.input.notes || null, target_session_id: parsed.input.sessionId });
  if (error) { console.error("POS close failed", error.code); return fail({}, "close"); }
  refresh(locale);
  return { ...initialState, success: true };
}
