export const ONLINE_PAYMENT_STATUSES = [
  "pending",
  "confirmed",
  "failed",
  "cancelled",
  "expired",
  "reconciliation_required",
] as const;

export type OnlinePaymentStatus = (typeof ONLINE_PAYMENT_STATUSES)[number];

export type OnlinePaymentAvailability = {
  amount: number;
  currency: string;
  eligible: boolean;
  entitlementEnabled: boolean;
  provider: string | null;
  providerConfigured: boolean;
};

export type OnlinePaymentAttemptSummary = {
  amount: number;
  currency: string;
  status: OnlinePaymentStatus;
};

export type OnlinePaymentCheckout = {
  attemptId: string;
  amount: number;
  currency: string;
  provider: string;
  providerSessionId: string | null;
};
