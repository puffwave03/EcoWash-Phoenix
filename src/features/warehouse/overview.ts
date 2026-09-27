import type { ProductionStatus } from "../orders/types";
import type { OrderStorageMode, WarehouseLocation, WarehousePosition, WarehousePositionType } from "./types";

export const POSITION_TYPES: readonly WarehousePositionType[] = ["shelf", "rack", "hanger", "cabinet", "other"];
export const STORAGE_MODES: readonly OrderStorageMode[] = ["folded", "hanging", "mixed", "other"];

export type CurrentStoredOrder = {
  customerName: string;
  enteredAt: string;
  locationId: string;
  orderId: string;
  orderNumber: string;
  packageCount: number;
  positionId: string;
  productionStatus: ProductionStatus;
  storageMode: OrderStorageMode;
};

export type WarehouseOverviewFilters = {
  query: string;
  locationId: string;
  positionId: string;
  storageMode: string;
};

export type WarehousePositionOverview = WarehousePosition & {
  locationName: string;
  orderCount: number;
  packageCount: number;
};

export function summarizeCurrentWarehouse(
  positions: readonly WarehousePosition[],
  locations: readonly WarehouseLocation[],
  orders: readonly CurrentStoredOrder[],
) {
  const locationNames = new Map(locations.map((location) => [location.id, location.name]));
  const counts = new Map<string, { orders: number; packages: number }>();
  const ordersByType = Object.fromEntries(POSITION_TYPES.map((type) => [type, 0])) as Record<WarehousePositionType, number>;
  const positionTypes = new Map(positions.map((position) => [position.id, position.positionType]));
  let totalPackages = 0;
  let cancelledOrdersInCustody = 0;

  for (const order of orders) {
    const type = positionTypes.get(order.positionId);
    if (!type) throw new Error("warehouse_current_position_missing");
    const count = counts.get(order.positionId) ?? { orders: 0, packages: 0 };
    count.orders += 1;
    count.packages += order.packageCount;
    counts.set(order.positionId, count);
    ordersByType[type] += 1;
    totalPackages += order.packageCount;
    if (order.productionStatus === "cancelled") cancelledOrdersInCustody += 1;
  }

  const positionOverview: WarehousePositionOverview[] = positions.map((position) => ({
    ...position,
    locationName: locationNames.get(position.locationId) ?? position.locationId,
    orderCount: counts.get(position.id)?.orders ?? 0,
    packageCount: counts.get(position.id)?.packages ?? 0,
  })).sort((left, right) =>
    Number(right.orderCount > 0) - Number(left.orderCount > 0)
    || left.locationName.localeCompare(right.locationName)
    || left.code.localeCompare(right.code));

  return { totalOrders: orders.length, totalPackages, cancelledOrdersInCustody, ordersByType, positions: positionOverview };
}

export function filterCurrentStoredOrders(
  orders: readonly CurrentStoredOrder[],
  filters: WarehouseOverviewFilters,
): CurrentStoredOrder[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return orders.filter((order) =>
    (!query || order.orderNumber.toLocaleLowerCase().includes(query)
      || order.customerName.toLocaleLowerCase().includes(query))
    && (!filters.locationId || order.locationId === filters.locationId)
    && (!filters.positionId || order.positionId === filters.positionId)
    && (!filters.storageMode || order.storageMode === filters.storageMode));
}
