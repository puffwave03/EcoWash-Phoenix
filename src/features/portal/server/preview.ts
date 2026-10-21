import "server-only";

// Keep the customer-page call compatible while preview is unconditionally disabled.
export function createStagingCustomerPreviewPath(locale: string, customerId: string): string | null {
  void locale;
  void customerId;
  return null;
}
