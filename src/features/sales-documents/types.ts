import type { PaymentMethod } from "@/features/payments/types";

export type SalesDocumentKind = "receipt" | "invoice";
export type SalesDocumentStatus = "issued" | "cancelled";
export type SalesDocumentEventType = "viewed" | "print_requested";

export type OperationalReceiptSnapshot = {
  customer: { displayName: string; email: string | null; id: string; phone: string | null };
  document: { issuedAt: string; receiptNumber: string; snapshotVersion: 1 };
  items: Array<{
    description: string;
    id: string;
    lineTotal: number;
    notes: string | null;
    quantity: number;
    sortOrder: number;
    unitPrice: number;
    unitType: string;
  }>;
  location: {
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    countryCode: string | null;
    id: string;
    name: string;
    phone: string | null;
    postalCode: string | null;
  } | null;
  order: {
    createdAt: string;
    currency: string;
    customerNotes: string | null;
    discountAmount: number;
    dueAt: string | null;
    id: string;
    orderNumber: string;
    subtotal: number;
    total: number;
  };
  organization: {
    address: string | null;
    displayName: string;
    email: string | null;
    logoAlt: string | null;
    logoPath: string | null;
    logoUrl?: string | null;
    name: string;
    phone: string | null;
  };
  payment: {
    methodTotals: Partial<Record<PaymentMethod, number>>;
    outstandingAmount: number;
    paidAmount: number;
  };
};

export type OperationalReceipt = {
  amount: number;
  cancellationReason: string | null;
  cancelledAt: string | null;
  currency: string;
  customerId: string;
  documentStatus: SalesDocumentStatus;
  id: string;
  issuedAt: string;
  orderId: string;
  receiptNumber: string;
  sequenceNumber: number;
  sequenceYear: number;
  series: string;
  snapshot: OperationalReceiptSnapshot;
  snapshotVersion: number;
  timeZone: string;
};

export type SalesDocument = {
  amount: number;
  currency: string;
  customer: string;
  documentNumber: string;
  id: string;
  issuedAt: string;
  kind: SalesDocumentKind;
  orderNumbers: string[];
  status: SalesDocumentStatus;
};
