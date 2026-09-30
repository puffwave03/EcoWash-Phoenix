"use server";

import { revalidatePath } from "next/cache";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isBusinessDayClosedError } from "@/lib/daily-close-error";
import { parseManualExternalRefund } from "@/features/payments/manual-external-refund-validation";

export type ManualExternalRefundState = {
  fieldErrors: Record<string, string>;
  formError: "closedDay" | "generic" | null;
  success: boolean;
};

export async function recordManualExternalRefundAction(
  locale: string,
  orderId: string,
  _state: ManualExternalRefundState,
  formData: FormData,
): Promise<ManualExternalRefundState> {
  void _state;
  const parsed = parseManualExternalRefund(formData);
  if (!parsed.valid) return { fieldErrors: parsed.fieldErrors, formError: null, success: false };
  const access = await requireOwnerOrManager(locale);
  const supabase = await createSupabaseServerClient();
  if (!parsed.input.notes) {
    const { data: source } = await supabase
      .from("payments")
      .select("method")
      .eq("organization_id", access.membership.organization.id)
      .eq("id", parsed.input.paymentId)
      .eq("channel", "manual_external")
      .eq("status", "confirmed")
      .maybeSingle<{ method: string }>();
    if (source?.method === "other") {
      return { fieldErrors: { notes: "required" }, formError: null, success: false };
    }
  }
  const { error } = await supabase.rpc("record_manual_external_refund", {
    target_amount: parsed.input.amount,
    target_idempotency_key: parsed.input.idempotencyKey,
    target_notes: parsed.input.notes || null,
    target_payment_id: parsed.input.paymentId,
    target_reason: parsed.input.reason,
    target_reference: parsed.input.reference,
  });
  if (error) {
    console.error("Manual external refund failed", error.code);
    return { fieldErrors: {}, formError: isBusinessDayClosedError(error) ? "closedDay" : "generic", success: false };
  }
  revalidatePath(`/${locale}/app/orders/${orderId}`);
  revalidatePath(`/${locale}/app/daily-close`);
  revalidatePath(`/${locale}/app/accounting`);
  revalidatePath(`/${locale}/app/customers`);
  revalidatePath(`/${locale}/app/billing`);
  return { fieldErrors: {}, formError: null, success: true };
}
