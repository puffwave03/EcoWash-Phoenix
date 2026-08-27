import "server-only";

import { notFound } from "next/navigation";
import type {
  PlatformAuditEntry,
  PlatformEntitlement,
  PlatformOrganization,
  PlatformOrganizationSummary,
  PlatformOverview,
} from "@/features/platform-admin/types";
import type { FeatureKey } from "@/features/entitlements/feature-catalog";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type OverviewRow = {
  active_organizations: number;
  advanced_branding_organizations: number;
  billing_organizations: number;
  segment_pricing_organizations: number;
  suspended_organizations: number;
  total_organizations: number;
};

type OrganizationRow = {
  commercial_plan_label: string | null;
  created_at: string;
  enabled_feature_count: number;
  id: string;
  location_count: number;
  member_count: number;
  name: string;
  service_status: "active" | "suspended";
};

type SummaryRow = {
  branding_commercial_name: string | null;
  branding_has_logo: boolean;
  commercial_plan_label: string | null;
  created_at: string;
  customer_count: number;
  id: string;
  location_count: number;
  member_count: number;
  name: string;
  order_count: number;
  service_status: "active" | "suspended";
  tenant_status: "active" | "inactive";
};

type EntitlementRow = {
  category: string;
  configured_enabled: boolean;
  description: string;
  effective_enabled: boolean;
  feature_key: FeatureKey;
  limit_value: number | null;
  source: string | null;
  valid_from: string | null;
  valid_until: string | null;
};

type AuditRow = {
  action: string;
  actor_display_name: string;
  after_state: Record<string, unknown>;
  before_state: Record<string, unknown>;
  created_at: string;
  id: string;
  target: string;
};

function mapOrganization(row: OrganizationRow): PlatformOrganization {
  return {
    commercialPlanLabel: row.commercial_plan_label,
    createdAt: row.created_at,
    enabledFeatureCount: Number(row.enabled_feature_count),
    id: row.id,
    locationCount: Number(row.location_count),
    memberCount: Number(row.member_count),
    name: row.name,
    serviceStatus: row.service_status,
  };
}

export async function getPlatformOverview(locale: string): Promise<PlatformOverview> {
  await requirePlatformAdmin(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("platform_get_overview").single<OverviewRow>();
  if (error || !data) throw new Error("platform_overview_unavailable");
  return {
    activeOrganizations: Number(data.active_organizations),
    advancedBrandingOrganizations: Number(data.advanced_branding_organizations),
    billingOrganizations: Number(data.billing_organizations),
    segmentPricingOrganizations: Number(data.segment_pricing_organizations),
    suspendedOrganizations: Number(data.suspended_organizations),
    totalOrganizations: Number(data.total_organizations),
  };
}

export async function listPlatformOrganizations(locale: string, options: {
  search?: string;
  status?: "active" | "suspended";
}): Promise<PlatformOrganization[]> {
  await requirePlatformAdmin(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("platform_list_organizations", {
    target_limit: 50,
    target_offset: 0,
    target_search: options.search?.trim() || null,
    target_status: options.status ?? null,
  }).returns<OrganizationRow[]>();
  if (error) throw new Error("platform_organizations_unavailable");
  return ((data ?? []) as OrganizationRow[]).map(mapOrganization);
}

export async function getPlatformOrganizationDetail(locale: string, organizationId: string) {
  await requirePlatformAdmin(locale);
  const supabase = await createSupabaseServerClient();
  const [summaryResult, entitlementResult, auditResult] = await Promise.all([
    supabase.rpc("platform_get_organization_summary", {
      target_organization_id: organizationId,
    }).maybeSingle<SummaryRow>(),
    supabase.rpc("platform_list_organization_entitlements", {
      target_organization_id: organizationId,
    }).returns<EntitlementRow[]>(),
    supabase.rpc("platform_list_organization_audit", {
      target_limit: 25,
      target_organization_id: organizationId,
    }).returns<AuditRow[]>(),
  ]);

  if (summaryResult.error || !summaryResult.data) notFound();
  if (entitlementResult.error || auditResult.error) throw new Error("platform_organization_detail_unavailable");
  const row = summaryResult.data;
  const summary: PlatformOrganizationSummary = {
    brandingCommercialName: row.branding_commercial_name,
    brandingHasLogo: row.branding_has_logo,
    commercialPlanLabel: row.commercial_plan_label,
    createdAt: row.created_at,
    customerCount: Number(row.customer_count),
    id: row.id,
    locationCount: Number(row.location_count),
    memberCount: Number(row.member_count),
    name: row.name,
    orderCount: Number(row.order_count),
    serviceStatus: row.service_status,
    tenantStatus: row.tenant_status,
  };
  const entitlements: PlatformEntitlement[] = ((entitlementResult.data ?? []) as EntitlementRow[]).map((item) => ({
    category: item.category,
    configuredEnabled: item.configured_enabled,
    description: item.description,
    effectiveEnabled: item.effective_enabled,
    featureKey: item.feature_key,
    limitValue: item.limit_value === null ? null : Number(item.limit_value),
    source: item.source,
    validFrom: item.valid_from,
    validUntil: item.valid_until,
  }));
  const audit: PlatformAuditEntry[] = ((auditResult.data ?? []) as AuditRow[]).map((item) => ({
    action: item.action,
    actorDisplayName: item.actor_display_name,
    afterState: item.after_state,
    beforeState: item.before_state,
    createdAt: item.created_at,
    id: item.id,
    target: item.target,
  }));
  return { audit, entitlements, summary };
}
