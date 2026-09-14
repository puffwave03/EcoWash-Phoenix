import "server-only";

import type { CustomerHandoff } from "@/features/handoffs/types";
import { requireMembership } from "@/lib/auth/require-membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CustomerHandoffRow = {
  balance_currency: string;
  balance_due_at_handoff: number;
  completed_at: string;
  completed_by: string;
  completed_by_profile: { display_name: string } | { display_name: string }[] | null;
  id: string;
  location_id: string | null;
  notes: string | null;
  order_id: string;
  unpaid_balance_acknowledged: boolean;
};

function relationName(value: CustomerHandoffRow["completed_by_profile"]) {
  const profile = Array.isArray(value) ? value[0] : value;
  return profile?.display_name ?? null;
}

export async function getCustomerHandoff(locale: string, orderId: string): Promise<CustomerHandoff | null> {
  const { membership } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("order_customer_handoffs")
    .select("id, order_id, location_id, completed_at, completed_by, notes, balance_due_at_handoff, balance_currency, unpaid_balance_acknowledged, completed_by_profile:profiles!order_customer_handoffs_completed_by_fkey(display_name)")
    .eq("organization_id", membership.organization.id)
    .eq("order_id", orderId)
    .maybeSingle<CustomerHandoffRow>();

  if (error) {
    console.error("Customer handoff query failed", error.code);
    throw new Error("customer_handoff_query_failed");
  }

  return data ? {
    balanceCurrency: data.balance_currency,
    balanceDueAtHandoff: Number(data.balance_due_at_handoff),
    completedAt: data.completed_at,
    completedBy: data.completed_by,
    completedByName: relationName(data.completed_by_profile),
    id: data.id,
    locationId: data.location_id,
    notes: data.notes,
    orderId: data.order_id,
    unpaidBalanceAcknowledged: data.unpaid_balance_acknowledged,
  } : null;
}
