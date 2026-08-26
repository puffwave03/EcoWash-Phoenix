import type { ProductionStatus } from "@/features/orders/types";
import type {
  DerivedPaymentStatus,
  PaymentMethod,
  PaymentRecordStatus,
} from "@/features/payments/types";

export const CUSTOMER_ACCOUNT_PERIODS = ["recent", "year", "all"] as const;

export type CustomerAccountPeriod = (typeof CUSTOMER_ACCOUNT_PERIODS)[number];

export type CustomerAccountSummary = {
  averageOrderValue: number;
  confirmedPayments: number;
  currency: string;
  grossOrderValue: number;
  lastOrderAt: string | null;
  lastPaymentAt: string | null;
  netPaid: number;
  orderCount: number;
  outstandingBalance: number;
  outstandingOrderCount: number;
  outstandingOrderValue: number;
  refundedPayments: number;
};

export type CustomerAccountOrder = {
  balanceDue: number;
  createdAt: string;
  currency: string;
  id: string;
  orderNumber: string;
  paymentStatus: DerivedPaymentStatus;
  productionStatus: ProductionStatus;
  propertyId: string | null;
  propertyName: string | null;
  total: number;
  totalPaid: number;
};

export type CustomerAccountPayment = {
  amount: number;
  currency: string;
  id: string;
  method: PaymentMethod;
  orderId: string;
  orderNumber: string;
  paidAt: string;
  refundedFromPaymentId: string | null;
  status: PaymentRecordStatus;
};

export type CustomerAccountFinancials = {
  orders: CustomerAccountOrder[];
  payments: CustomerAccountPayment[];
  summaries: CustomerAccountSummary[];
};
