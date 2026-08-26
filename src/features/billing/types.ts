export const BILLING_DOCUMENT_STATUSES = ["draft", "issued", "cancelled"] as const;
export const BILLING_PAYMENT_STATUSES = ["draft", "unpaid", "partially_paid", "paid", "cancelled"] as const;

export type BillingDocumentStatus = (typeof BILLING_DOCUMENT_STATUSES)[number];
export type BillingPaymentStatus = (typeof BILLING_PAYMENT_STATUSES)[number];

export type BillingSettings = {
  defaultSeries: string;
  defaultTaxRate: number;
  issuerAddressLine1: string;
  issuerAddressLine2: string;
  issuerCity: string;
  issuerCountryCode: string;
  issuerEmail: string;
  issuerLegalName: string;
  issuerPhone: string;
  issuerPostalCode: string;
  issuerRegion: string;
  issuerTaxId: string;
  isIssueReady: boolean;
};

export type BillingInvoice = {
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  currency: string;
  customerAddressLine1: string | null;
  customerAddressLine2: string | null;
  customerCity: string | null;
  customerCountryCode: string | null;
  customerEmail: string | null;
  customerId: string;
  customerName: string;
  customerPostalCode: string | null;
  customerTaxId: string | null;
  discountTotal: number;
  documentStatus: BillingDocumentStatus;
  dueDate: string | null;
  id: string;
  invoiceNumber: string | null;
  issueDate: string;
  issuedAt: string | null;
  issuerAddressLine1: string | null;
  issuerAddressLine2: string | null;
  issuerCity: string | null;
  issuerCountryCode: string | null;
  issuerEmail: string | null;
  issuerLegalName: string | null;
  issuerLogoPath: string | null;
  issuerPhone: string | null;
  issuerPostalCode: string | null;
  issuerRegion: string | null;
  issuerTaxId: string | null;
  notes: string | null;
  orderIds: string[];
  orderNumbers: string[];
  outstanding: number;
  paidTotal: number;
  paymentStatus: BillingPaymentStatus;
  sequenceNumber: number | null;
  series: string;
  subtotal: number;
  taxTotal: number;
  taxableBase: number;
  total: number;
};

export type BillingInvoiceItem = {
  description: string;
  discountAmount: number;
  displayOrder: number;
  id: string;
  lineSubtotal: number;
  lineTotal: number;
  quantity: number;
  sourceOrderId: string | null;
  taxAmount: number;
  taxableBase: number;
  taxRate: number;
  unitPrice: number;
  unitType: "piece" | "weight";
};

export type BillingPayment = {
  amount: number;
  id: string;
  method: "bank_transfer" | "cash" | "card" | "other";
  orderId: string;
  paidAt: string;
  status: "confirmed" | "pending" | "refunded" | "void";
};

export type BillingInvoiceDetail = {
  invoice: BillingInvoice;
  items: BillingInvoiceItem[];
  payments: BillingPayment[];
};

export type EligibleBillingOrder = {
  createdAt: string;
  currency: string;
  customerActive: boolean;
  customerId: string;
  customerName: string;
  id: string;
  orderNumber: string;
  total: number;
};

export type CustomerBillingSummary = {
  currency: string;
  invoiceCount: number;
  issuedTotal: number;
  outstanding: number;
  paidTotal: number;
};

export type CustomerBillingOverview = {
  eligibleOrderCount: number;
  recentInvoices: BillingInvoice[];
  summaries: CustomerBillingSummary[];
};
