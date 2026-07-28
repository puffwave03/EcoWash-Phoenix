import type { FulfillmentStatus } from "@/features/logistics/types";
import type { ProductionStatus } from "@/features/orders/types";
import type { DerivedPaymentStatus } from "@/features/payments/types";

export type CurrencyAmount = {
  amount: string;
  currency: string;
};

export type DashboardSummary = {
  balanceDueTotals: CurrencyAmount[] | null;
  expressOpenOrders: number;
  lateOpenOrders: number;
  onHoldOrders: number;
  openOrders: number;
  readyOrders: number;
};

export type DashboardOrderQueueItem = {
  balanceDue: string;
  currency: string;
  customerName: string;
  dueAt: string | null;
  id: string;
  isLate: boolean;
  orderNumber: string;
  priority: "normal" | "express";
  productionStatus: ProductionStatus;
  propertyName: string | null;
  readyAt: string | null;
  total: string;
};

export type DashboardHoldItem = {
  customerName: string;
  holdAt: string | null;
  id: string;
  orderNumber: string;
  reason: string | null;
};

export type DashboardLogisticsItem = {
  assignedToName: string | null;
  city: string | null;
  customerName: string;
  id: string;
  kind: "pickup" | "delivery";
  orderId: string;
  orderNumber: string;
  scheduledAt: string | null;
  status: FulfillmentStatus;
};

export type DashboardBalanceItem = {
  balanceDue: string;
  currency: string;
  customerName: string;
  dueAt: string | null;
  id: string;
  orderNumber: string;
  paymentStatus: DerivedPaymentStatus;
  productionStatus: ProductionStatus;
  total: string;
  totalPaid: string;
};

export type DashboardFinancialSummary = {
  partiallyPaidOrders: number;
  paymentsToday: number;
  recentCorrections: number;
  unpaidOrders: number;
};

export type DashboardActivityItem = {
  actorName: string | null;
  descriptionKey: "status" | "payment" | "pickup" | "delivery" | "photo";
  id: string;
  orderId: string;
  orderNumber: string;
  timestamp: string;
};

export type DashboardOverview = {
  activity: DashboardActivityItem[];
  financialSummary: DashboardFinancialSummary | null;
  logisticsAttention: DashboardLogisticsItem[];
  paymentBalances: DashboardBalanceItem[];
  productionQueue: DashboardOrderQueueItem[];
  readyQueue: DashboardOrderQueueItem[];
  summary: DashboardSummary;
  todayDeliveries: DashboardLogisticsItem[];
  todayPickups: DashboardLogisticsItem[];
  onHoldQueue: DashboardHoldItem[];
};
