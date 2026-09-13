import type { FulfillmentStatus } from "@/features/logistics/types";
import type { Order, ProductionStatus } from "@/features/orders/types";

export type OrderDisplayStatus =
  | ProductionStatus
  | "delivery_in_progress"
  | "delivery_scheduled"
  | "pickup_in_progress"
  | "pickup_scheduled"
  | "ready_for_customer_pickup";

export type OrderListEntry = Order & {
  displayStatus: OrderDisplayStatus;
  hasLifecycleAnomaly: boolean;
};

export type OrderDisplayState = {
  deliveryStatus?: FulfillmentStatus | null;
  isActive?: boolean;
  pickupStatus?: FulfillmentStatus | null;
  productionStatus: ProductionStatus;
};

export const ACTUAL_PRODUCTION_STATUSES: ProductionStatus[] = [
  "washing",
  "drying",
  "ironing",
  "quality_check",
  "packing",
  "ready",
  "completed",
];

export function hasPendingInboundPickup(status: FulfillmentStatus | null | undefined) {
  return status === "scheduled" || status === "in_progress";
}

export function hasInboundPickupProductionAnomaly({
  isActive = true,
  pickupStatus,
  productionStatus,
}: Pick<OrderDisplayState, "isActive" | "pickupStatus" | "productionStatus">) {
  return isActive
    && productionStatus !== "cancelled"
    && hasPendingInboundPickup(pickupStatus)
    && ACTUAL_PRODUCTION_STATUSES.includes(productionStatus);
}

export function deriveOrderDisplayStatus({
  deliveryStatus,
  isActive = true,
  pickupStatus,
  productionStatus,
}: OrderDisplayState): OrderDisplayStatus {
  if (!isActive || productionStatus === "cancelled") return "cancelled";

  // Pickups are inbound collections from the customer and must be completed
  // before production. They are not evidence of final customer fulfillment.
  if (pickupStatus === "in_progress") return "pickup_in_progress";
  if (pickupStatus === "scheduled") return "pickup_scheduled";

  if (productionStatus !== "completed") return productionStatus;

  if (deliveryStatus === "in_progress") return "delivery_in_progress";
  if (deliveryStatus === "scheduled") return "delivery_scheduled";
  if (deliveryStatus === "completed") return "completed";

  return "ready_for_customer_pickup";
}
