import type { FulfillmentStatus } from "@/features/logistics/types";
import type { ProductionStatus } from "@/features/orders/types";
import type { DerivedPaymentStatus } from "@/features/payments/types";

export type OperationalAlertSeverity = "critical" | "warning" | "info";

export type OperationalAlertType =
  | "late_order"
  | "on_hold_order"
  | "unassigned_order"
  | "pickup_due_soon"
  | "pickup_overdue"
  | "delivery_due_soon"
  | "delivery_overdue"
  | "payment_issue"
  | "operational_anomaly";

export type OperationalAlert = {
  assignedToName: string | null;
  customerName: string;
  id: string;
  missingAmount: string | null;
  orderId: string;
  orderNumber: string;
  paymentStatus: DerivedPaymentStatus | null;
  propertyName: string | null;
  severity: OperationalAlertSeverity;
  status: FulfillmentStatus | ProductionStatus;
  timestamp: string | null;
  type: OperationalAlertType;
};

export type OperationalAlertsSummary = {
  critical: number;
  info: number;
  total: number;
  warning: number;
};

export type OperationalAlertsData = {
  alerts: OperationalAlert[];
  summary: OperationalAlertsSummary;
  timeZone: string;
};
