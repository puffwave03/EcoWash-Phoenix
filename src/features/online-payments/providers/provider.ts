import "server-only";

import type { OnlinePaymentStatus } from "@/features/online-payments/types";

export type CreateCheckoutInput = {
  amount: number;
  attemptId: string;
  cancelUrl: string;
  currency: string;
  customerReference: string;
  orderReference: string;
  successUrl: string;
};

export type HostedCheckoutSession = {
  expiresAt: string | null;
  id: string;
  url: string;
};

export type VerifiedOnlinePaymentEvent = {
  amount: number | null;
  currency: string | null;
  eventId: string;
  failureCode: string | null;
  paidAt: string | null;
  paymentReference: string | null;
  sessionId: string;
  status: Extract<OnlinePaymentStatus, "confirmed" | "failed" | "cancelled" | "expired">;
};

export interface OnlinePaymentProvider {
  readonly configured: boolean;
  readonly name: string;
  createCheckout(input: CreateCheckoutInput): Promise<HostedCheckoutSession>;
  validateWebhook(rawBody: string, headers: Headers): Promise<VerifiedOnlinePaymentEvent>;
  verifyPayment(sessionId: string): Promise<VerifiedOnlinePaymentEvent>;
}
