import "server-only";

import type { PersistedDailyClose } from "@/features/daily-close/persisted-types";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
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

  return {
    businessDate: data.business_date,
    businessDayEndExclusive: data.business_day_end_exclusive,
    businessDayStart: data.business_day_start,
    calculationVersion: data.calculation_version,
    closeNote: data.close_note,
    closedAt: data.closed_at,
    closedBy: data.closed_by,
    createdAt: data.created_at,
    id: data.id,
    locationId: data.location_id,
    organizationId: data.organization_id,
    requestFingerprint: data.request_fingerprint,
    snapshot: data.snapshot,
    snapshotHash: data.snapshot_hash,
    snapshotSchemaVersion: data.snapshot_schema_version,
    tenantTimezone: data.tenant_timezone,
  };
}
