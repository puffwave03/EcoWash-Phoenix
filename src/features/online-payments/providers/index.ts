import "server-only";

import type { OnlinePaymentProvider } from "@/features/online-payments/providers/provider";
import { TestOnlinePaymentProvider } from "@/features/online-payments/providers/test";
import { UnconfiguredOnlinePaymentProvider } from "@/features/online-payments/providers/unconfigured";

export function getOnlinePaymentProvider(providerName: string | null): OnlinePaymentProvider {
  const normalized = providerName?.trim().toLowerCase() || "unconfigured";

  if (normalized === "test") {
    if (process.env.NODE_ENV !== "test") {
      return new UnconfiguredOnlinePaymentProvider(normalized);
    }
    return new TestOnlinePaymentProvider(process.env.ONLINE_PAYMENT_TEST_WEBHOOK_SECRET ?? "");
  }

  // A real adapter is intentionally not guessed. Add it here only together
  // with official sandbox credentials and provider-specific verification.
  return new UnconfiguredOnlinePaymentProvider(normalized);
}

export type {
  CreateCheckoutInput,
  HostedCheckoutSession,
  OnlinePaymentProvider,
  VerifiedOnlinePaymentEvent,
} from "@/features/online-payments/providers/provider";
