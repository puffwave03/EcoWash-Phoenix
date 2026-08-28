import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePosAccess } from "@/features/pos/server/access";
import type { PosLocation, PosOrderDue, PosPayment, PosSession, PosSessionSummary } from "@/features/pos/types";

type SessionRow = {
  closed_at: string | null;
  counted_cash: number | null;
  difference: number | null;
  expected_cash: number | null;
  id: string;
  location_id: string | null;
  location: { name: string } | { name: string }[] | null;
  opened_at: string;
  opened_by_profile: { display_name: string } | { display_name: string }[] | null;
  opening_cash: number;
  status: PosSession["status"];
};

type DueOrderRow = {
  currency: string;
  customer_name: string;
  id: string;
  location_id: string | null;
  order_number: string;
  outstanding: number;
  production_status: string;
  total: number;
  total_paid: number;
};

type PosPaymentRow = {
  amount: number;
  id: string;
  method: PosPayment["method"];
  order_id: string;
  order: { order_number: string } | { order_number: string }[] | null;
  paid_at: string;
  provider: string | null;
  recorded_by_profile: { display_name: string } | { display_name: string }[] | null;
  refunded_from_payment_id: string | null;
  status: PosPayment["status"];
};

function name(relation: { display_name?: string; name?: string } | { display_name?: string; name?: string }[] | null) {
  const row = Array.isArray(relation) ? relation[0] : relation;
  return row?.display_name ?? row?.name ?? null;
}

function mapSession(row: SessionRow): PosSession {
  return {
    closedAt: row.closed_at,
    countedCash: row.counted_cash,
    difference: row.difference,
    expectedCash: row.expected_cash,
    id: row.id,
    locationId: row.location_id,
    locationName: name(row.location),
    openedAt: row.opened_at,
    openedByName: name(row.opened_by_profile),
    openingCash: row.opening_cash,
    status: row.status,
  };
}

const SESSION_SELECT = "id, location_id, opened_at, opening_cash, status, closed_at, expected_cash, counted_cash, difference, location:locations!pos_sessions_location_same_org(name), opened_by_profile:profiles!pos_sessions_opened_by_fkey(display_name)";

export async function getCurrentPosSession(locale: string): Promise<PosSession | null> {
  const { membership, profile } = await requirePosAccess(locale);
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("pos_sessions").select(SESSION_SELECT)
    .eq("organization_id", membership.organization.id).eq("status", "open")
    .order("opened_at", { ascending: false }).limit(1);
  if (membership.role === "staff") query = query.eq("opened_by", profile.id);
  const { data, error } = await query.returns<SessionRow[]>();
  if (error) {
    console.error("POS current session query failed", error.code);
    throw new Error("POS current session is temporarily unavailable");
  }
  return data?.[0] ? mapSession(data[0]) : null;
}

export async function getPosSessionSummary(locale: string, sessionId: string): Promise<PosSessionSummary | null> {
  await requirePosAccess(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_pos_session_summary", { target_session_id: sessionId }).single<{
    cash_payments: number; cash_refunds: number; expected_cash: number; opening_cash: number; transaction_count: number;
  }>();
  if (error || !data) { console.error("POS summary query failed", error?.code); return null; }
  return { cashPayments: data.cash_payments, cashRefunds: data.cash_refunds, expectedCash: data.expected_cash, openingCash: data.opening_cash, transactionCount: data.transaction_count };
}

export async function listPosOrdersDue(locale: string, query = ""): Promise<PosOrderDue[]> {
  await requirePosAccess(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("list_pos_orders_due", { target_limit: 30, target_query: query || null }).returns<DueOrderRow[]>();
  if (error) { console.error("POS due orders query failed", error.code); return []; }
  const rows = (data ?? []) as unknown as DueOrderRow[];
  return rows.map((row) => ({ currency: row.currency, customerName: row.customer_name, id: row.id, locationId: row.location_id, orderNumber: row.order_number, outstanding: row.outstanding, productionStatus: row.production_status, total: row.total, totalPaid: row.total_paid }));
}

export async function listPosSessionPayments(locale: string, sessionId: string): Promise<PosPayment[]> {
  const { membership } = await requirePosAccess(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("payments")
    .select("id, order_id, amount, method, status, paid_at, provider, refunded_from_payment_id, order:orders!payments_order_same_org(order_number), recorded_by_profile:profiles!payments_recorded_by_fkey(display_name)")
    .eq("organization_id", membership.organization.id).eq("pos_session_id", sessionId)
    .order("created_at", { ascending: false }).limit(100).returns<PosPaymentRow[]>();
  if (error) { console.error("POS payments query failed", error.code); return []; }
  return (data ?? []).map((row) => ({ amount: row.amount, id: row.id, method: row.method, orderId: row.order_id, orderNumber: (Array.isArray(row.order) ? row.order[0] : row.order)?.order_number ?? "", paidAt: row.paid_at, provider: row.provider, recordedByName: name(row.recorded_by_profile), refundedFromPaymentId: row.refunded_from_payment_id, status: row.status }));
}

export async function listPosSessionHistory(locale: string): Promise<PosSession[]> {
  const { membership } = await requirePosAccess(locale);
  if (membership.role === "staff") return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("pos_sessions").select(SESSION_SELECT)
    .eq("organization_id", membership.organization.id).order("opened_at", { ascending: false }).limit(25).returns<SessionRow[]>();
  if (error) { console.error("POS history query failed", error.code); return []; }
  return (data ?? []).map(mapSession);
}

export async function listPosLocations(locale: string): Promise<PosLocation[]> {
  const { membership } = await requirePosAccess(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("locations").select("id, name")
    .eq("organization_id", membership.organization.id).eq("is_active", true).is("deleted_at", null)
    .order("name").limit(50).returns<PosLocation[]>();
  if (error) { console.error("POS locations query failed", error.code); return []; }
  return data ?? [];
}

export async function getPosCurrency(locale: string): Promise<string> {
  const { membership } = await requirePosAccess(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("organizations").select("default_currency")
    .eq("id", membership.organization.id).single<{ default_currency: string }>();
  if (error || !data) { console.error("POS currency query failed", error?.code); return "EUR"; }
  return data.default_currency;
}
