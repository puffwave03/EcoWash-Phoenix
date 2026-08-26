import "server-only";

import {
  CUSTOMER_LIFECYCLE_BLOCKING_REASONS,
  type CustomerLifecycleBlockingReason,
  type CustomerLifecycleEligibility,
} from "@/features/customer-lifecycle/types";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type LifecycleRow = {
  blocking_reasons: string[];
  can_anonymize: boolean;
  can_deactivate: boolean;
  can_hard_delete: boolean;
  can_reactivate: boolean;
  customer_id: string;
  delivery_count: number;
  has_segment_assignment: boolean;
  is_active: boolean;
  order_count: number;
  order_history_count: number;
  order_item_count: number;
  payment_count: number;
  photo_count: number;
  pickup_count: number;
  portal_access_count: number;
  property_count: number;
};

function count(value: number | string) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function isBlockingReason(value: string): value is CustomerLifecycleBlockingReason {
  return CUSTOMER_LIFECYCLE_BLOCKING_REASONS.includes(value as CustomerLifecycleBlockingReason);
}

export async function getCustomerLifecycleEligibility(
  locale: string,
  customerId: string,
): Promise<CustomerLifecycleEligibility | null> {
  await requireOwnerOrManager(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .rpc("get_customer_lifecycle_eligibility", { target_customer_id: customerId })
    .maybeSingle<LifecycleRow>();

  if (error || !data) {
    console.error("Customer lifecycle eligibility query failed", error?.code ?? "missing_data");
    return null;
  }

  return {
    blockingReasons: (data.blocking_reasons ?? []).filter(isBlockingReason),
    canAnonymize: data.can_anonymize,
    canDeactivate: data.can_deactivate,
    canHardDelete: data.can_hard_delete,
    canReactivate: data.can_reactivate,
    customerId: data.customer_id,
    deliveryCount: count(data.delivery_count),
    hasSegmentAssignment: data.has_segment_assignment,
    isActive: data.is_active,
    orderCount: count(data.order_count),
    orderHistoryCount: count(data.order_history_count),
    orderItemCount: count(data.order_item_count),
    paymentCount: count(data.payment_count),
    photoCount: count(data.photo_count),
    pickupCount: count(data.pickup_count),
    portalAccessCount: count(data.portal_access_count),
    propertyCount: count(data.property_count),
  };
}
