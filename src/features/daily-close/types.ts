import type { FulfillmentStatus } from "@/features/logistics/types";
import type { ProductionStatus } from "@/features/orders/types";
import type { DerivedPaymentStatus } from "@/features/payments/types";

export type DailyCloseGroupKey =
  | "completedToday"
  | "openOrders"
  | "onHoldOrders"
  | "lateOrders"
  | "incompletePickups"
  | "incompleteDeliveries"
  | "paymentIssues"
  | "anomalies";

export type DailyCloseItemKind = "order" | "pickup" | "delivery" | "payment" | "anomaly";

export type DailyCloseItem = {
  assignedToName: string | null;
  customerName: string;
  id: string;
  isLate: boolean;
  kind: DailyCloseItemKind;
  missingAmount: string | null;
  orderId: string;
  orderNumber: string;
  paymentStatus: DerivedPaymentStatus | null;
  propertyName: string | null;
  status: FulfillmentStatus | ProductionStatus;
  timestamp: string | null;
};

export type DailyCloseSummary = Record<DailyCloseGroupKey, number>;

export type DailyCloseData = {
  groups: Record<DailyCloseGroupKey, DailyCloseItem[]>;
  summary: DailyCloseSummary;
  timeZone: string;
};
