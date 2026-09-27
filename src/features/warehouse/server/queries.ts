import "server-only";

import type {
  OrderStorageAssignment,
  OrderStorageMode,
  WarehouseMovement,
  WarehouseLocation,
  WarehousePosition,
  WarehousePositionType,
} from "@/features/warehouse/types";
import { requireMembership } from "@/lib/auth/require-membership";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type WarehousePositionRow = {
  code: string;
  description: string | null;
  id: string;
  is_active: boolean;
  is_default_inbound: boolean;
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
    .select("id, location_id, code, name, description, position_type, is_active, is_default_inbound")
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
    isDefaultInbound: row.is_default_inbound,
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
  const supabase = createSupabaseAdminClient();
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

type WarehouseMovementRow = {
  id: string;
  occurred_at: string;
  actor_name: string | null;
  movement_type: WarehouseMovement["movementType"];
  source: WarehouseMovement["source"];
  from_position_label: string | null;
  to_position_label: string | null;
  from_package_count: number | null;
  to_package_count: number | null;
  from_storage_mode: OrderStorageMode | null;
  to_storage_mode: OrderStorageMode | null;
  note: string | null;
};

export async function listWarehouseMovements(locale: string, orderId: string): Promise<WarehouseMovement[]> {
  const { membership } = await requireOwnerOrManager(locale);
  const admin = createSupabaseAdminClient();
  const rows: WarehouseMovementRow[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await admin.from("warehouse_movements")
      .select("id, occurred_at, actor_name, movement_type, source, from_position_label, to_position_label, from_package_count, to_package_count, from_storage_mode, to_storage_mode, note")
      .eq("organization_id", membership.organization.id)
      .eq("order_id", orderId)
      .order("occurred_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1)
      .returns<WarehouseMovementRow[]>();
    if (error) throw new Error(`warehouse_movements_read_failed:${error.code}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows.map((row) => ({
    id: row.id,
    occurredAt: row.occurred_at,
    actorName: row.actor_name,
    movementType: row.movement_type,
    source: row.source,
    fromPositionLabel: row.from_position_label,
    toPositionLabel: row.to_position_label,
    fromPackageCount: row.from_package_count,
    toPackageCount: row.to_package_count,
    fromStorageMode: row.from_storage_mode,
    toStorageMode: row.to_storage_mode,
    note: row.note,
  }));
}
