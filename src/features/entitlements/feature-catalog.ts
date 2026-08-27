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

export const FEATURE_PRESENTATION: Record<FeatureKey, {
  group: "accounting" | "billing" | "branding" | "catalog" | "core" | "future" | "pricing";
  labelKey: string;
}> = {
  [FEATURES.coreOrders]: { group: "core", labelKey: "coreOrders" },
  [FEATURES.coreCustomers]: { group: "core", labelKey: "coreCustomers" },
  [FEATURES.coreOperations]: { group: "core", labelKey: "coreOperations" },
  [FEATURES.corePortal]: { group: "core", labelKey: "corePortal" },
  [FEATURES.catalogManagement]: { group: "catalog", labelKey: "catalogManagement" },
  [FEATURES.catalogSegments]: { group: "catalog", labelKey: "catalogSegments" },
  [FEATURES.segmentPriceOverrides]: { group: "pricing", labelKey: "segmentPriceOverrides" },
  [FEATURES.billingInvoicing]: { group: "billing", labelKey: "billingInvoicing" },
  [FEATURES.basicBranding]: { group: "branding", labelKey: "basicBranding" },
  [FEATURES.customBrandColors]: { group: "branding", labelKey: "customBrandColors" },
  [FEATURES.fullWhiteLabel]: { group: "branding", labelKey: "fullWhiteLabel" },
  [FEATURES.advancedReports]: { group: "future", labelKey: "advancedReports" },
  [FEATURES.pos]: { group: "future", labelKey: "pos" },
  [FEATURES.printing]: { group: "future", labelKey: "printing" },
  [FEATURES.barcode]: { group: "future", labelKey: "barcode" },
  [FEATURES.accounting]: { group: "accounting", labelKey: "accounting" },
  [FEATURES.eInvoice]: { group: "accounting", labelKey: "eInvoice" },
  [FEATURES.multiLocation]: { group: "future", labelKey: "multiLocation" },
};

export const FEATURE_GROUP_ORDER = [
  "core", "catalog", "pricing", "billing", "branding", "future", "accounting",
] as const;

export type EntitlementAccess = Partial<Record<FeatureKey, {
  enabled: boolean;
  limit: number | null;
}>>;

export function entitlementEnabled(access: EntitlementAccess, feature: FeatureKey) {
  return access[feature]?.enabled === true;
}
