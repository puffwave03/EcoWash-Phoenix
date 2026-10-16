type DocumentSelection =
  | { allowed: true; documentType: "ordinary" }
  | { allowed: false; reason: "documentType" | "simplifiedUnavailable" };

// This is a workflow gate, not a fiscal eligibility engine. Neither a declared
// territory/regime, a customer name nor an amount establishes eligibility under
// RD 1619/2012 arts. 4/7 and its IGIC provisions. An approved operation/recipient
// policy and a verified separate series are still missing. Keep both DB guards.
// No caller-supplied profile, rate, threshold or flag can enable simplified here.
export function validateBillingDocumentSelection(values: readonly unknown[]): DocumentSelection {
  // Preserve existing forms/callers, which implicitly prepare ordinary invoices.
  if (values.length === 0) return { allowed: true, documentType: "ordinary" };
  if (values.length !== 1 || typeof values[0] !== "string") {
    return { allowed: false, reason: "documentType" };
  }
  if (values[0] === "ordinary") return { allowed: true, documentType: "ordinary" };
  if (values[0] === "simplified") return { allowed: false, reason: "simplifiedUnavailable" };
  return { allowed: false, reason: "documentType" };
}
