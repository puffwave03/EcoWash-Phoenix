import type { PaymentMethod, PaymentRecordStatus } from "@/features/payments/types";

export type PosSessionStatus = "open" | "closed";

export type PosSession = {
  closedAt: string | null;
  countedCash: number | null;
  difference: number | null;
  expectedCash: number | null;
  id: string;
  locationId: string | null;
  locationName: string | null;
  openedAt: string;
  openedByName: string | null;
  openingCash: number;
  status: PosSessionStatus;
};

export type PosSessionSummary = {
  cashPayments: number;
  cashRefunds: number;
  expectedCash: number;
  openingCash: number;
  transactionCount: number;
};

export type PosOrderDue = {
  currency: string;
  customerName: string;
  id: string;
  locationId: string | null;
  orderNumber: string;
  outstanding: number;
  productionStatus: string;
  total: number;
  totalPaid: number;
};

export type PosPayment = {
  amount: number;
  id: string;
  method: PaymentMethod;
  orderId: string;
  orderNumber: string;
  paidAt: string;
  provider: string | null;
  recordedByName: string | null;
  refundedFromPaymentId: string | null;
  status: PaymentRecordStatus;
};

export type PosLocation = { id: string; name: string };

export type PosActionState = {
  fieldErrors: Record<string, string>;
  formError: string | null;
  success: boolean;
};
