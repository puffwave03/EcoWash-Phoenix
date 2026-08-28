import "server-only";

import type {
  HostedCheckoutSession,
  OnlinePaymentProvider,
  VerifiedOnlinePaymentEvent,
} from "@/features/online-payments/providers/provider";

export class UnconfiguredOnlinePaymentProvider implements OnlinePaymentProvider {
  readonly configured = false;

  constructor(readonly name: string) {}

  async createCheckout(): Promise<HostedCheckoutSession> {
    throw new Error("online_payment_provider_not_configured");
  }

  async validateWebhook(): Promise<VerifiedOnlinePaymentEvent> {
    throw new Error("online_payment_provider_not_configured");
  }

  async verifyPayment(): Promise<VerifiedOnlinePaymentEvent> {
    throw new Error("online_payment_provider_not_configured");
  }
}
