export const PAYMENT_METHODS = ["cash", "card", "bank_transfer", "other"] as const;
export const PAYMENT_RECORD_STATUSES = ["pending", "confirmed", "void", "refunded"] as const;
export const DERIVED_PAYMENT_STATUSES = ["unpaid", "partially_paid", "paid", "refunded", "void"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type PaymentRecordStatus = (typeof PAYMENT_RECORD_STATUSES)[number];
export type DerivedPaymentStatus = (typeof DERIVED_PAYMENT_STATUSES)[number];

export type Payment = {
  amount: number;
  createdAt: string;
  id: string;
  method: PaymentMethod;
  paidAt: string;
  proofPhotoId: string | null;
  recordedByName: string | null;
  reference: string | null;
  refundedFromPaymentId: string | null;
  status: PaymentRecordStatus;
};

export type PaymentSummary = {
  balanceDue: number;
  paymentStatus: DerivedPaymentStatus;
  totalDue: number;
  totalPaid: number;
};

export type PaymentActionState = {
  fieldErrors: Record<string, string>;
  formError: string | null;
};
