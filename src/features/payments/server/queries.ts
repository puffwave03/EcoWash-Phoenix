import "server-only";

import { requireMembership } from "@/lib/auth/require-membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Payment,
  PaymentSummary,
} from "@/features/payments/types";

type PaymentRow = {
  amount: number;
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

export async function getOrderPayments(locale: string, orderId: string): Promise<Payment[]> {
  const { membership } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("payments")
    .select("id, amount, method, status, paid_at, reference, proof_photo_id, refunded_from_payment_id, created_at, recorded_by_profile:profiles!payments_recorded_by_fkey(display_name)")
    .eq("organization_id", membership.organization.id)
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .returns<PaymentRow[]>();

  if (error || !data) {
    console.error("Payments query failed", error?.code);
    return [];
  }

  return data.map((row) => ({
    amount: row.amount,
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
  const { data, error } = await supabase
    .rpc("get_order_payment_summary", { target_order_id: orderId })
    .single<SummaryRow>();

  if (error || !data) {
    console.error("Payment summary query failed", error?.code);
    return { balanceDue: 0, paymentStatus: "unpaid", totalDue: 0, totalPaid: 0 };
  }

  return {
    balanceDue: data.balance_due,
    paymentStatus: data.payment_status,
    totalDue: data.total_due,
    totalPaid: data.total_paid,
  };
}
