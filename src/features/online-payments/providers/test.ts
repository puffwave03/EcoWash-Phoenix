import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  CreateCheckoutInput,
  HostedCheckoutSession,
  OnlinePaymentProvider,
  VerifiedOnlinePaymentEvent,
} from "@/features/online-payments/providers/provider";

function testOnly() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("test_online_payment_provider_forbidden");
  }
}

function safeSignatureEqual(expected: string, received: string) {
  const expectedBytes = Buffer.from(expected, "hex");
  const receivedBytes = Buffer.from(received, "hex");
  return expectedBytes.length === receivedBytes.length
    && timingSafeEqual(expectedBytes, receivedBytes);
}

export class TestOnlinePaymentProvider implements OnlinePaymentProvider {
  readonly configured = true;
  readonly name = "test";

  constructor(private readonly webhookSecret: string) {
    testOnly();
    if (!webhookSecret) throw new Error("test_webhook_secret_required");
  }

  async createCheckout(input: CreateCheckoutInput): Promise<HostedCheckoutSession> {
    testOnly();
    return {
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      id: `test_session_${input.attemptId}`,
      url: `https://payments.test.invalid/checkout/${input.attemptId}`,
    };
  }

  async validateWebhook(rawBody: string, headers: Headers): Promise<VerifiedOnlinePaymentEvent> {
    testOnly();
    const received = headers.get("x-phoenix-test-signature") ?? "";
    const expected = createHmac("sha256", this.webhookSecret).update(rawBody).digest("hex");
    if (!safeSignatureEqual(expected, received)) {
      throw new Error("online_payment_webhook_signature_invalid");
    }

    return JSON.parse(rawBody) as VerifiedOnlinePaymentEvent;
  }

  async verifyPayment(): Promise<VerifiedOnlinePaymentEvent> {
    testOnly();
    throw new Error("test_payment_requires_signed_webhook");
  }
}
