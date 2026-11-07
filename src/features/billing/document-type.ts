type DocumentSelection =
  | { allowed: true; documentType: "ordinary" }
  | { allowed: false; reason: "documentType" };

// The operational management workflow creates ordinary invoices only.
// Existing simplified documents remain immutable historical Billing records.
export function validateBillingDocumentSelection(values: readonly unknown[]): DocumentSelection {
  if (values.length === 0 || (values.length === 1 && values[0] === "ordinary")) {
    return { allowed: true, documentType: "ordinary" };
  }
  return { allowed: false, reason: "documentType" };
}
