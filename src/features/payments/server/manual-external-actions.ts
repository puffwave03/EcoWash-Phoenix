"use server";

import { revalidatePath } from "next/cache";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isBusinessDayClosedError } from "@/lib/daily-close-error";
import { parseManualExternalPayment } from "@/features/payments/manual-external-validation";

export type ManualExternalPaymentState = {
  fieldErrors: Record<string, string>;
  formError: "closedDay" | "generic" | null;
  success: boolean;
};

export async function recordManualExternalPaymentAction(
  locale: string,
  orderId: string,
  _state: ManualExternalPaymentState,
  formData: FormData,
): Promise<ManualExternalPaymentState> {
  void _state;
  const parsed = parseManualExternalPayment(formData);
  if (!parsed.valid) return { fieldErrors: parsed.fieldErrors, formError: null, success: false };
  await requireOwnerOrManager(locale);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("record_manual_external_payment", {
    target_amount: parsed.input.amount,
    target_idempotency_key: parsed.input.idempotencyKey,
    target_method: parsed.input.method,
    target_notes: parsed.input.notes || null,
    target_order_id: orderId,
    target_reference: parsed.input.reference,
  });
  if (error) {
    console.error("Manual external payment failed", error.code);
    return { fieldErrors: {}, formError: isBusinessDayClosedError(error) ? "closedDay" : "generic", success: false };
  }
  revalidatePath(`/${locale}/app/orders/${orderId}`);
  revalidatePath(`/${locale}/app/daily-close`);
  revalidatePath(`/${locale}/app/accounting`);
  revalidatePath(`/${locale}/app/customers`);
  revalidatePath(`/${locale}/app/billing`);
  return { fieldErrors: {}, formError: null, success: true };
}
