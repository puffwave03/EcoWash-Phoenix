import "server-only";

import { requireMembership } from "@/lib/auth/require-membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PaymentReadError } from "@/features/payments/read-error";
import type {
  Payment,
  PaymentSummary,
} from "@/features/payments/types";

type PaymentRow = {
  amount: number;
  channel: Payment["channel"];
  created_at: string;
  id: string;
  method: Payment["method"];
  paid_at: string;
  proof_photo_id: string | null;
  recorded_by_profile: { display_name: string } | { display_name: string }[] | null;
  reference: string | null;
  refunded_from_payment_id: string | null;
  status: Payment["status"];
};

type SummaryRow = {
  balance_due: number;
  payment_status: PaymentSummary["paymentStatus"];
  total_due: number;
  total_paid: number;
};

function relationName(value: { display_name?: string } | { display_name?: string }[] | null) {
  const row = Array.isArray(value) ? value[0] : value;

  return row?.display_name ?? null;
}

async function readPaymentQuery<T>(
  query: PromiseLike<{ data: T | null; error: { code?: string } | null }>,
  message: string,
): Promise<T> {
  let result;
  try {
    result = await query;
  } catch {
    // Transport failures can reject instead of returning a PostgREST error.
    console.error(message, "request_failed");
    throw new PaymentReadError();
  }
  if (result.error || result.data == null) {
    console.error(message, result.error?.code ?? "missing_data");
    throw new PaymentReadError();
  }
  return result.data;
}

export async function getOrderPayments(locale: string, orderId: string): Promise<Payment[]> {
  const { membership } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const data = await readPaymentQuery(
    supabase
      .from("payments")
      .select("id, amount, channel, method, status, paid_at, reference, proof_photo_id, refunded_from_payment_id, created_at, recorded_by_profile:profiles!payments_recorded_by_fkey(display_name)")
      .eq("organization_id", membership.organization.id)
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .returns<PaymentRow[]>(),
    "Payments query failed",
  );

  return data.map((row) => ({
    amount: row.amount,
    channel: row.channel,
    createdAt: row.created_at,
    id: row.id,
    method: row.method,
    paidAt: row.paid_at,
    proofPhotoId: row.proof_photo_id,
    recordedByName: relationName(row.recorded_by_profile),
    reference: row.reference,
    refundedFromPaymentId: row.refunded_from_payment_id,
    status: row.status,
  }));
}

export async function getOrderPaymentSummary(locale: string, orderId: string): Promise<PaymentSummary> {
  await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const data = await readPaymentQuery(
    supabase
      .rpc("get_order_payment_summary", { target_order_id: orderId })
      .single<SummaryRow>(),
    "Payment summary query failed",
  );

  return {
    balanceDue: data.balance_due,
    paymentStatus: data.payment_status,
    totalDue: data.total_due,
    totalPaid: data.total_paid,
  };
}
