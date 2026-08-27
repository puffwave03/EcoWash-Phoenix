export const FEATURES = {
  accounting: "accounting",
  advancedReports: "reports.advanced",
  barcode: "barcode",
  basicBranding: "branding.basic",
  billingInvoicing: "billing.invoicing",
  catalogManagement: "catalog.management",
  catalogSegments: "catalog.segments",
  coreCustomers: "core.customers",
  coreOperations: "core.operations",
  coreOrders: "core.orders",
  corePortal: "core.portal",
  customBrandColors: "branding.custom_colors",
  eInvoice: "e_invoice",
  fullWhiteLabel: "branding.full_white_label",
  multiLocation: "multi_location",
  pos: "pos",
  printing: "printing",
  segmentPriceOverrides: "pricing.segment_overrides",
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];

export type EntitlementAccess = Partial<Record<FeatureKey, {
  enabled: boolean;
  limit: number | null;
}>>;

export function entitlementEnabled(access: EntitlementAccess, feature: FeatureKey) {
  return access[feature]?.enabled === true;
}
