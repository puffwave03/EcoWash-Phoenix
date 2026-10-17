type DocumentSelection =
  | { allowed: true; documentType: "ordinary" | "simplified" }
  | { allowed: false; reason: "documentType" | "simplifiedUnavailable" };

// This is a workflow gate, not a fiscal eligibility engine. Neither a declared
// territory/regime, a customer name nor an amount establishes eligibility under
// RD 1619/2012 arts. 4/7 and its IGIC provisions. 001E assesses the operation,
// without a service-code whitelist. Assessment is not issuance authorization:
// the complete fiscal-date/advance workflow is still pending. Simplified draft
// persistence uses an explicit RPC overload; fiscal issuance remains blocked.
// No caller-supplied profile, rate, threshold or flag can enable simplified here.
export function validateBillingDocumentSelection(values: readonly unknown[]): DocumentSelection {
  // Preserve existing forms/callers, which implicitly prepare ordinary invoices.
  if (values.length === 0) return { allowed: true, documentType: "ordinary" };
  if (values.length !== 1 || typeof values[0] !== "string") {
    return { allowed: false, reason: "documentType" };
  }
  if (values[0] === "ordinary") return { allowed: true, documentType: "ordinary" };
  if (values[0] === "simplified") return { allowed: true, documentType: "simplified" };
  return { allowed: false, reason: "documentType" };
}
