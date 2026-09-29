import "server-only";

import type { CurrentStoredOrder } from "@/features/warehouse/overview";
import type { ProductionStatus } from "@/features/orders/types";
import type { OrderStorageMode, WarehouseLocation, WarehousePosition, WarehousePositionType } from "@/features/warehouse/types";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 500;
const ORDER_BATCH_SIZE = 100;

type StorageRow = {
  entered_at: string;
  id: string;
  location_id: string;
  order_id: string;
  package_count: number;
  storage_mode: OrderStorageMode;
  warehouse_position_id: string;
};
type PositionRow = {
  code: string;
  description: string | null;
  id: string;
  is_active: boolean;
  is_default_inbound: boolean;
  is_default_delivery_staging: boolean;
  location_id: string;
  name: string | null;
  position_type: WarehousePositionType;
};
type LocationRow = { id: string; is_active: boolean; name: string };
type CustomerRow = { customer_code: string | null; display_name: string };
type OrderRow = {
  customer: CustomerRow | CustomerRow[] | null;
  id: string;
  order_number: string;
  production_status: ProductionStatus;
  walk_in_name: string | null;
};

/** One authenticated, tenant-scoped, read-only snapshot for the operational overview. */
export async function listCurrentWarehouseOverview(locale: string): Promise<{
  locations: WarehouseLocation[];
  orders: CurrentStoredOrder[];
  positions: WarehousePosition[];
  timeZone: string;
}> {
  const { membership } = await requireOwnerOrManager(locale);
  const organizationId = membership.organization.id;
  const admin = createSupabaseAdminClient();
  const storage: StorageRow[] = [];
  const positionRows: PositionRow[] = [];
  const locationRows: LocationRow[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await admin.from("order_storage")
      .select("id, order_id, location_id, warehouse_position_id, package_count, storage_mode, entered_at")
      .eq("organization_id", organizationId).order("id")
      .range(offset, offset + PAGE_SIZE - 1).returns<StorageRow[]>();
    if (error) throw new Error(`warehouse_current_storage_read_failed:${error.code}`);
    storage.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await admin.from("warehouse_positions")
      .select("id, location_id, code, name, description, position_type, is_active, is_default_inbound, is_default_delivery_staging")
      .eq("organization_id", organizationId).order("id")
      .range(offset, offset + PAGE_SIZE - 1).returns<PositionRow[]>();
    if (error) throw new Error(`warehouse_positions_read_failed:${error.code}`);
    positionRows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await admin.from("locations")
      .select("id, name, is_active")
      .eq("organization_id", organizationId).order("id")
      .range(offset, offset + PAGE_SIZE - 1).returns<LocationRow[]>();
    if (error) throw new Error(`warehouse_locations_read_failed:${error.code}`);
    locationRows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }

  const orderRows: OrderRow[] = [];
  for (let offset = 0; offset < storage.length; offset += ORDER_BATCH_SIZE) {
    const ids = storage.slice(offset, offset + ORDER_BATCH_SIZE).map((row) => row.order_id);
    const { data, error } = await admin.from("orders")
      .select("id, order_number, production_status, walk_in_name, customer:customers!orders_customer_same_organization(customer_code, display_name)")
      .eq("organization_id", organizationId).in("id", ids)
      .returns<OrderRow[]>();
    if (error) throw new Error(`warehouse_orders_read_failed:${error.code}`);
    orderRows.push(...(data ?? []));
  }
  const ordersById = new Map(orderRows.map((row) => [row.id, row]));
  const orders: CurrentStoredOrder[] = storage.map((row) => {
    const order = ordersById.get(row.order_id);
    if (!order) throw new Error("warehouse_current_order_missing");
    const customer = Array.isArray(order.customer) ? order.customer[0] : order.customer;
    return {
      customerName: customer?.customer_code === "WALKIN-SHARED"
        ? order.walk_in_name || customer.display_name : customer?.display_name ?? "",
      enteredAt: row.entered_at,
      locationId: row.location_id,
      orderId: row.order_id,
      orderNumber: order.order_number,
      packageCount: row.package_count,
      positionId: row.warehouse_position_id,
      productionStatus: order.production_status,
      storageMode: row.storage_mode,
    };
  }).sort((left, right) => right.enteredAt.localeCompare(left.enteredAt)
    || left.orderNumber.localeCompare(right.orderNumber));

  return {
    locations: locationRows.map((row) => ({ id: row.id, isActive: row.is_active, name: row.name })),
    orders,
    positions: positionRows.map((row) => ({
      code: row.code, description: row.description, id: row.id, isActive: row.is_active,
      isDefaultInbound: row.is_default_inbound,
      isDefaultDeliveryStaging: row.is_default_delivery_staging,
      locationId: row.location_id, name: row.name, positionType: row.position_type,
    })),
    timeZone: membership.organization.timezone,
  };
}
