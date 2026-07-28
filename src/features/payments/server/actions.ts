"use server";

import { revalidatePath } from "next/cache";
import { requireMembership } from "@/lib/auth/require-membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PaymentActionState } from "@/features/payments/types";
import {
  optionalDbValue,
  parsePaymentForm,
  parseReasonForm,
  parseRefundForm,
} from "@/features/payments/validation";

const initialState: PaymentActionState = { fieldErrors: {}, formError: null };

function fail(fieldErrors: Record<string, string> = {}, formError: string | null = "generic") {
  return { fieldErrors, formError };
}

function revalidateOrder(locale: string, orderId: string) {
  revalidatePath(`/${locale}/app/orders/${orderId}`);
}

export async function recordPaymentAction(
  locale: string,
  orderId: string,
  _state: PaymentActionState = initialState,
  formData: FormData,
) {
  void _state;

  const { fieldErrors, input, valid } = parsePaymentForm(formData);
  if (!valid) return fail(fieldErrors, null);

  await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("record_payment", {
    target_amount: input.amount,
    target_method: input.method,
    target_notes: optionalDbValue(input.notes),
    target_order_id: orderId,
    target_paid_at: optionalDbValue(input.paidAt),
    target_proof_photo_id: optionalDbValue(input.proofPhotoId),
    target_reference: optionalDbValue(input.reference),
  });

  if (error) {
    console.error("Payment record failed", error.code);
    return fail();
  }

  revalidateOrder(locale, orderId);
  return initialState;
}

export async function voidPaymentAction(locale: string, orderId: string, paymentId: string, formData: FormData) {
  const { fieldErrors, input, valid } = parseReasonForm(formData);
  if (!valid) return;

  await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("void_payment", {
    target_payment_id: paymentId,
    target_reason: input.reason,
  });

  if (error) console.error("Payment void failed", error.code, fieldErrors.reason);
  revalidateOrder(locale, orderId);
}

export async function refundPaymentAction(locale: string, orderId: string, paymentId: string, formData: FormData) {
  const { input, valid } = parseRefundForm(formData);
  if (!valid) return;

  await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("refund_payment", {
    target_amount: input.amount,
    target_payment_id: paymentId,
    target_reason: input.reason,
  });

  if (error) console.error("Payment refund failed", error.code);
  revalidateOrder(locale, orderId);
}
