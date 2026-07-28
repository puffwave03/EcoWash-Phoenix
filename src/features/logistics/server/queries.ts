import "server-only";

import { requireMembership } from "@/lib/auth/require-membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  LogisticsRecord,
  OrderLogistics,
} from "@/features/logistics/types";
import type { AssignmentOption } from "@/features/orders/server/queries";

type LogisticsRow = {
  address_line1: string | null;
  address_line2: string | null;
  assigned_to: string | null;
  assigned_to_profile: { display_name: string } | { display_name: string }[] | null;
  cancellation_reason: string | null;
  city: string | null;
  completed_at: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  country_code: string | null;
  fee: number;
  id: string;
  notes: string | null;
  postal_code: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  status: LogisticsRecord["status"];
};

function relationName(value: { display_name?: string } | { display_name?: string }[] | null) {
  const row = Array.isArray(value) ? value[0] : value;

  return row?.display_name ?? null;
}

function mapLogistics(row: LogisticsRow): LogisticsRecord {
  return {
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    assignedTo: row.assigned_to,
    assignedToName: relationName(row.assigned_to_profile),
    cancellationReason: row.cancellation_reason,
    city: row.city,
    completedAt: row.completed_at,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    countryCode: row.country_code,
    fee: row.fee,
    id: row.id,
    notes: row.notes,
    postalCode: row.postal_code,
    scheduledAt: row.scheduled_at,
    startedAt: row.started_at,
    status: row.status,
  };
}

const LOGISTICS_SELECT =
  "id, status, scheduled_at, started_at, completed_at, assigned_to, address_line1, address_line2, city, postal_code, country_code, contact_name, contact_phone, notes, cancellation_reason, fee, assigned_to_profile:profiles(display_name)";

export async function getOrderLogistics(locale: string, orderId: string): Promise<OrderLogistics> {
  const { membership } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const [pickupResult, deliveryResult] = await Promise.all([
    supabase
      .from("pickups")
      .select(LOGISTICS_SELECT)
      .eq("organization_id", membership.organization.id)
      .eq("order_id", orderId)
      .neq("status", "cancelled")
      .maybeSingle<LogisticsRow>(),
    supabase
      .from("deliveries")
      .select(LOGISTICS_SELECT)
      .eq("organization_id", membership.organization.id)
      .eq("order_id", orderId)
      .neq("status", "cancelled")
      .maybeSingle<LogisticsRow>(),
  ]);

  if (pickupResult.error) console.error("Pickup query failed", pickupResult.error.code);
  if (deliveryResult.error) console.error("Delivery query failed", deliveryResult.error.code);

  return {
    delivery: deliveryResult.data ? mapLogistics(deliveryResult.data) : null,
    pickup: pickupResult.data ? mapLogistics(pickupResult.data) : null,
  };
}

export async function listAssignableStaff(locale: string): Promise<AssignmentOption[]> {
  const { membership } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("profile_id, profile:profiles(display_name)")
    .eq("organization_id", membership.organization.id)
    .eq("is_active", true)
    .returns<{ profile: { display_name: string } | { display_name: string }[] | null; profile_id: string }[]>();

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.profile_id,
    label: relationName(row.profile) ?? row.profile_id,
  }));
}
