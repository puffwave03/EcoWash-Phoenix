import type { FulfillmentStatus } from "@/features/logistics/types";
import type { Order, ProductionStatus } from "@/features/orders/types";

export type OrderDisplayStatus =
  | ProductionStatus
  | "delivery_in_progress"
  | "delivery_scheduled"
  | "ready_for_pickup";

export type OrderListEntry = Order & {
  displayStatus: OrderDisplayStatus;
};

type OrderDisplayState = {
  deliveryStatus?: FulfillmentStatus | null;
  pickupStatus?: FulfillmentStatus | null;
  productionStatus: ProductionStatus;
};

function requiresClosure(status: FulfillmentStatus | null | undefined) {
  return status !== null && status !== undefined && status !== "cancelled" && status !== "not_required";
}

export function deriveOrderDisplayStatus({
  deliveryStatus,
  pickupStatus,
  productionStatus,
}: OrderDisplayState): OrderDisplayStatus {
  if (productionStatus !== "completed") return productionStatus;

  if (deliveryStatus === "in_progress") return "delivery_in_progress";
  if (deliveryStatus === "scheduled") return "delivery_scheduled";

  if (pickupStatus === "scheduled" || pickupStatus === "in_progress") return "ready_for_pickup";

  const requiredStatuses = [pickupStatus, deliveryStatus].filter(requiresClosure);
  if (requiredStatuses.length > 0 && requiredStatuses.every((status) => status === "completed")) {
    return "completed";
  }

  return "ready_for_pickup";
}
