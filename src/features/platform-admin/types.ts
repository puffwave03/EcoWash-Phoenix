import type { FeatureKey } from "@/features/entitlements/feature-catalog";

export type PlatformOverview = {
  activeOrganizations: number;
  advancedBrandingOrganizations: number;
  billingOrganizations: number;
  segmentPricingOrganizations: number;
  suspendedOrganizations: number;
  totalOrganizations: number;
};

export type PlatformOrganization = {
  commercialPlanLabel: string | null;
  createdAt: string;
  enabledFeatureCount: number;
  id: string;
  locationCount: number;
  memberCount: number;
  name: string;
  serviceStatus: "active" | "suspended";
};

export type PlatformOrganizationSummary = {
  brandingCommercialName: string | null;
  brandingHasLogo: boolean;
  commercialPlanLabel: string | null;
  createdAt: string;
  customerCount: number;
  id: string;
  locationCount: number;
  memberCount: number;
  name: string;
  orderCount: number;
  serviceStatus: "active" | "suspended";
  tenantStatus: "active" | "inactive";
};

export type PlatformEntitlement = {
  category: string;
  configuredEnabled: boolean;
  description: string;
  effectiveEnabled: boolean;
  featureKey: FeatureKey;
  limitValue: number | null;
  source: string | null;
  validFrom: string | null;
  validUntil: string | null;
};

export type PlatformAuditEntry = {
  action: string;
  actorDisplayName: string;
  afterState: Record<string, unknown>;
  beforeState: Record<string, unknown>;
  createdAt: string;
  id: string;
  target: string;
};
