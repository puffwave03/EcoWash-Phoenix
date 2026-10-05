import "server-only";

import type {
  PersistedDailyClose,
  PersistedDailyCloseHistoryItem,
  PersistedDailyCloseWithScope,
} from "@/features/daily-close/persisted-types";
import {
  DAILY_CLOSE_HISTORY_PAGE_SIZE,
  dailyCloseHistoryKeyset,
  dailyCloseHistoryPage,
  decodeDailyCloseHistoryCursor,
  normalizeDailyCloseHistoryFilters,
  type DailyCloseHistoryFilters,
} from "@/features/daily-close/pagination";
import { resolveDailyCloseBusinessDay } from "@/features/daily-close/preview";
import { requireMembership } from "@/lib/auth/require-membership";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DailyCloseRow = {
  business_date: string;
  business_day_end_exclusive: string;
  business_day_start: string;
  calculation_version: string;
  close_note: string | null;
  closed_at: string;
  closed_by: string;
  created_at: string;
  id: string;
  location_id: string | null;
  organization_id: string;
  request_fingerprint: string;
  snapshot: unknown;
  snapshot_hash: string;
  snapshot_schema_version: number;
  tenant_timezone: string;
};

type DailyCloseHistoryRow = Pick<
  DailyCloseRow,
  "business_date" | "close_note" | "closed_at" | "id" | "location_id" | "snapshot_hash" | "tenant_timezone"
> & {
  location: { name: string } | { name: string }[] | null;
};

type DailyCloseDetailRow = DailyCloseRow & {
  location: { name: string } | { name: string }[] | null;
};

export type { DailyCloseHistoryFilters } from "@/features/daily-close/pagination";

export type DailyCloseHistoryScope = {
  id: string;
  name: string;
};

type DailyCloseHistoryScopeResult = {
  hasOrganizationScope: boolean;
  scopes: DailyCloseHistoryScope[];
};

function locationName(value: DailyCloseHistoryRow["location"]) {
  const location = Array.isArray(value) ? value[0] : value;
  return location?.name ?? null;
}

function persistedClose(row: DailyCloseRow): PersistedDailyClose {
  return {
    businessDate: row.business_date,
    businessDayEndExclusive: row.business_day_end_exclusive,
    businessDayStart: row.business_day_start,
    calculationVersion: row.calculation_version,
    closeNote: row.close_note,
    closedAt: row.closed_at,
    closedBy: row.closed_by,
    createdAt: row.created_at,
    id: row.id,
    locationId: row.location_id,
    organizationId: row.organization_id,
    requestFingerprint: row.request_fingerprint,
    snapshot: row.snapshot,
    snapshotHash: row.snapshot_hash,
    snapshotSchemaVersion: row.snapshot_schema_version,
    tenantTimezone: row.tenant_timezone,
  };
}

export type CurrentDailyCloseState = {
  locationIds: string[];
  organizationWide: boolean;
};

export async function getCurrentDailyCloseState(locale: string): Promise<CurrentDailyCloseState> {
  const { membership } = await requireMembership(locale);
  const businessDate = resolveDailyCloseBusinessDay(
    undefined,
    membership.organization.timezone,
  ).businessDate;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("daily_closes")
    .select("location_id")
    .eq("organization_id", membership.organization.id)
    .eq("business_date", businessDate)
    .returns<{ location_id: string | null }[]>();

  if (error) throw new Error(`daily_close_state_read_failed:${error.code}`);

  return {
    locationIds: (data ?? []).flatMap((row) => row.location_id ? [row.location_id] : []),
    organizationWide: (data ?? []).some((row) => row.location_id === null),
  };
}

export async function getPersistedDailyClose(
  locale: string,
  scope: { businessDate: string; locationId: string | null },
): Promise<PersistedDailyClose | null> {
  const { membership } = await requireOwnerOrManager(locale);
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("daily_closes")
    .select("id, organization_id, business_date, location_id, tenant_timezone, business_day_start, business_day_end_exclusive, closed_at, closed_by, close_note, snapshot_schema_version, calculation_version, request_fingerprint, snapshot, snapshot_hash, created_at")
    .eq("organization_id", membership.organization.id)
    .eq("business_date", scope.businessDate);
  query = scope.locationId ? query.eq("location_id", scope.locationId) : query.is("location_id", null);
  const { data, error } = await query.maybeSingle<DailyCloseRow>();
  if (error) throw new Error(`daily_close_read_failed:${error.code}`);
  if (!data) return null;

  return persistedClose(data);
}

export async function listPersistedDailyCloses(
  locale: string,
  filters: DailyCloseHistoryFilters = {},
  rawCursor?: string,
): Promise<{
  closes: PersistedDailyCloseHistoryItem[];
  pagination: { newerCursor: string | null; olderCursor: string | null };
  hasOrganizationScope: boolean;
  scopes: DailyCloseHistoryScope[];
}> {
  const { membership } = await requireOwnerOrManager(locale);
  const supabase = await createSupabaseServerClient();
  const normalized = normalizeDailyCloseHistoryFilters(filters);
  let cursor = decodeDailyCloseHistoryCursor(rawCursor, normalized);
  const select = "id, business_date, location_id, closed_at, close_note, snapshot_hash, tenant_timezone, location:locations!daily_closes_location_same_org(name)";
  const loadHistory = async () => {
    let query = supabase.from("daily_closes").select(select)
      .eq("organization_id", membership.organization.id);
    if (normalized.businessDate) query = query.eq("business_date", normalized.businessDate);
    if (normalized.locationId === "organization") query = query.is("location_id", null);
    else if (normalized.locationId) query = query.eq("location_id", normalized.locationId);
    if (cursor) query = query.or(dailyCloseHistoryKeyset(cursor));
    const ascending = cursor?.direction === "newer";
    const { data, error } = await query
      .order("business_date", { ascending })
      .order("closed_at", { ascending })
      .order("id", { ascending })
      .limit(DAILY_CLOSE_HISTORY_PAGE_SIZE + 1)
      .returns<DailyCloseHistoryRow[]>();
    if (error) throw new Error(`daily_close_history_read_failed:${error.code}`);
    return (data ?? []).map((row): PersistedDailyCloseHistoryItem => ({
      businessDate: row.business_date,
      closeNote: row.close_note,
      closedAt: row.closed_at,
      id: row.id,
      locationId: row.location_id,
      locationName: locationName(row.location),
      snapshotHash: row.snapshot_hash,
      tenantTimezone: row.tenant_timezone,
    }));
  };

  const [initialRows, scopeResult] = await Promise.all([
    loadHistory(),
    supabase.rpc("list_daily_close_history_scopes"),
  ]);
  if (scopeResult.error) throw new Error(`daily_close_history_scope_read_failed:${scopeResult.error.code}`);
  const scopes = scopeResult.data as DailyCloseHistoryScopeResult | null;
  if (!scopes || !Array.isArray(scopes.scopes)
    || typeof scopes.hasOrganizationScope !== "boolean") throw new Error("daily_close_history_scope_invalid_response");
  let rows = initialRows;
  if (!rows.length && cursor) {
    cursor = null;
    rows = await loadHistory();
  }
  const page = dailyCloseHistoryPage(rows, cursor, normalized);

  return {
    closes: page.items,
    pagination: { newerCursor: page.newerCursor, olderCursor: page.olderCursor },
    hasOrganizationScope: scopes.hasOrganizationScope,
    scopes: scopes.scopes.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export async function getPersistedDailyCloseById(
  locale: string,
  closeId: string,
): Promise<PersistedDailyCloseWithScope | null> {
  const { membership } = await requireOwnerOrManager(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("daily_closes")
    .select("id, organization_id, business_date, location_id, tenant_timezone, business_day_start, business_day_end_exclusive, closed_at, closed_by, close_note, snapshot_schema_version, calculation_version, request_fingerprint, snapshot, snapshot_hash, created_at, location:locations!daily_closes_location_same_org(name)")
    .eq("organization_id", membership.organization.id)
    .eq("id", closeId)
    .maybeSingle<DailyCloseDetailRow>();
  if (error) throw new Error(`daily_close_history_detail_read_failed:${error.code}`);
  if (!data) return null;

  return { ...persistedClose(data), locationName: locationName(data.location) };
}
