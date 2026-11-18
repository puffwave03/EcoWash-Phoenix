import type { BillingSimplifiedPosBridgeResult } from "@/features/billing/server/simplified-pos-bridge";
import { BillingSimplifiedTicket } from "./BillingSimplifiedTicket";

// No route, checkout hook, emission action or print-history write is exposed.
// The caller supplies localized blocked-state copy; technical reasons remain
// available on the typed read result for the surrounding operational UI.
export function BillingSimplifiedPosPreview({ result, blockedLabel }: {
  result: BillingSimplifiedPosBridgeResult;
  blockedLabel: string;
}) {
  if (result.status === "blocked") return <p role="alert">{blockedLabel}</p>;
  return <BillingSimplifiedTicket {...result.ticket} />;
}
