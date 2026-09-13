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
export type DailyCloseSource = "locations" | "logistics" | "orders" | "payments" | "pos";
export type DailyCloseBlockerKey =
  | "cash_without_session"
  | "future_business_date"
  | "invalid_location"
  | "open_pos_session"
  | "source_unavailable"
  | "unassigned_location";

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

export type DailyCloseOrderSummary = {
  cancelled: number;
  created: number;
  finalFulfillmentCompleted: number | null;
  late: number;
  onHold: number;
  open: number;
  productionCompleted: number;
};

export type DailyCloseLogisticsSummary = {
  deliveriesDueOpen: number;
  inProgress: number;
  overdueDeliveries: number;
  overduePickups: number;
  pickupsDueOpen: number;
};

export type DailyClosePaymentSummary = {
  bankTransferCollected: number;
  cardCollected: number;
  cashCollected: number;
  collectedGross: number;
  collectedNet: number;
  confirmedPaymentCount: number;
  currency: string;
  onlineCollected: number;
  otherCollected: number;
  outstanding: number;
  outstandingOrderCount: number;
  refundCount: number;
  refunds: number;
};

export type DailyClosePosCurrencySummary = {
  countedCash: number;
  currency: string;
  expectedCash: number;
  variance: number;
};

export type DailyClosePosReadiness = {
  cashPaymentsWithoutSession: number;
  closedSessions: number;
  currencies: DailyClosePosCurrencySummary[];
  openSessions: number;
};

export type DailyCloseLocation = { id: string; name: string };

export type DailyCloseBlocker = {
  count?: number;
  key: DailyCloseBlockerKey;
  sources?: DailyCloseSource[];
};

export type DailyCloseData = {
  blockers: DailyCloseBlocker[];
  businessDate: string;
  complete: boolean;
  currentBusinessDate: string;
  failedSources: DailyCloseSource[];
  groups: Record<DailyCloseGroupKey, DailyCloseItem[]>;
  isFutureBusinessDate: boolean;
  locations: DailyCloseLocation[];
  logistics: DailyCloseLogisticsSummary | null;
  orders: DailyCloseOrderSummary | null;
  payments: DailyClosePaymentSummary[] | null;
  pos: DailyClosePosReadiness | null;
  selectedLocationId: string | null;
  timeZone: string;
  unassignedLocationFacts: number;
};
