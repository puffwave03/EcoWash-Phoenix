import "server-only";

import type {
  OrderStorageAssignment,
  OrderStorageMode,
  WarehouseLocation,
  WarehousePosition,
  WarehousePositionType,
} from "@/features/warehouse/types";
import { requireMembership } from "@/lib/auth/require-membership";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type WarehousePositionRow = {
  code: string;
  description: string | null;
  id: string;
  is_active: boolean;
  location_id: string;
  name: string | null;
  position_type: WarehousePositionType;
};

type OrderStorageRow = {
  entered_at: string;
  id: string;
  location_id: string;
  order_id: string;
  package_count: number;
  position: { code: string; id: string; name: string | null } | { code: string; id: string; name: string | null }[] | null;
  storage_mode: OrderStorageMode;
  warehouse_position_id: string;
};

function positionRelation(value: OrderStorageRow["position"]) {
  return Array.isArray(value) ? value[0] : value;
}

export async function listWarehouseLocations(locale: string): Promise<WarehouseLocation[]> {
  const { membership } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("locations")
    .select("id, name, is_active")
    .eq("organization_id", membership.organization.id)
    .is("deleted_at", null)
    .order("name")
    .limit(100)
    .returns<Array<{ id: string; is_active: boolean; name: string }>>();
  if (error) throw new Error(`warehouse_locations_read_failed:${error.code}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    isActive: row.is_active,
    name: row.name,
  }));
}

export async function listWarehousePositions(
  locale: string,
  locationId?: string,
): Promise<WarehousePosition[]> {
  const { membership } = await requireMembership(locale);
  const supabase = createSupabaseAdminClient();
  let query = supabase.from("warehouse_positions")
    .select("id, location_id, code, name, description, position_type, is_active")
    .eq("organization_id", membership.organization.id)
    .order("code")
    .limit(500);
  if (locationId) query = query.eq("location_id", locationId);

  const { data, error } = await query.returns<WarehousePositionRow[]>();
  if (error) throw new Error(`warehouse_positions_read_failed:${error.code}`);

  return (data ?? []).map((row) => ({
    code: row.code,
    description: row.description,
    id: row.id,
    isActive: row.is_active,
    locationId: row.location_id,
    name: row.name,
    positionType: row.position_type,
  }));
}

export async function getOrderStorageAssignment(
  locale: string,
  orderId: string,
): Promise<OrderStorageAssignment | null> {
  const { membership } = await requireMembership(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("order_storage")
    .select("id, order_id, location_id, warehouse_position_id, package_count, storage_mode, entered_at, position:warehouse_positions!order_storage_position_same_location(id, code, name)")
    .eq("organization_id", membership.organization.id)
    .eq("order_id", orderId)
    .maybeSingle<OrderStorageRow>();
  if (error) throw new Error(`order_storage_read_failed:${error.code}`);
  if (!data) return null;

  const position = positionRelation(data.position);
  if (!position) throw new Error("order_storage_position_missing");

  return {
    enteredAt: data.entered_at,
    id: data.id,
    locationId: data.location_id,
    orderId: data.order_id,
    packageCount: data.package_count,
    positionCode: position.code,
    positionId: data.warehouse_position_id,
    positionName: position.name,
    storageMode: data.storage_mode,
  };
}
