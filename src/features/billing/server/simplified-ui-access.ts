import "server-only";

import { readFile, realpath } from "node:fs/promises";
import { FEATURES } from "@/features/entitlements/feature-catalog";
import { requireEntitlement } from "@/features/entitlements/server/resolver";
import { requirePosAccess } from "@/features/pos/server/access";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { getSupabaseConfig } from "@/lib/supabase/env";

const LAB = "phoenix-local-baseline-001";
const ROOT = "/Volumes/DEV/Phoenix-Local-Baseline-001";
const STAGING_READ_ONLY = "phoenix-staging-readonly-001";
const STAGING_VERCEL_PROJECT = "prj_u7MwRwQOLyRSRvbuhRLdURx653aZ";
const STAGING_TENANT = "601a0b5c-cfff-413d-952c-63be6b5978e5"; // Phoenix Test Lab / Laboratorio
const SYNTHETIC_TENANTS = new Set([
  "5a5a6393-7366-5506-9527-8c9da2c11884", // EcoWash Demo
  "b4e08840-0912-5db1-ad22-c0291af2abdd", // Phoenix Test B
]);

// Opt-in is server-only, off by default, and insufficient on its own: the
// actual Supabase client endpoint, runtime path, project and tenant must match.
// Local opt-in stays unchanged. The separate staging opt-in grants reads only,
// including on the staging project's Vercel "production" deployment target.
async function billingSimplifiedUiMode(organizationId?: string): Promise<"local" | "staging-readonly" | null> {
  if (process.env.PHOENIX_BILLING_SIMPLIFIED_UI === STAGING_READ_ONLY) {
    if (process.env.VERCEL !== "1" || process.env.VERCEL_PROJECT_ID !== STAGING_VERCEL_PROJECT
      || !["preview", "production"].includes(process.env.VERCEL_ENV ?? "")
      || (organizationId !== undefined && organizationId !== STAGING_TENANT)) return null;
    try {
      return getSupabaseConfig().url === "https://exthnplfokcucaqydney.supabase.co" ? "staging-readonly" : null;
    } catch {
      return null;
    }
  }
  if (process.env.PHOENIX_BILLING_SIMPLIFIED_UI !== LAB || process.env.VERCEL || process.env.VERCEL_ENV
    || (organizationId !== undefined && !SYNTHETIC_TENANTS.has(organizationId))) return null;
  try {
    if (getSupabaseConfig().url !== "http://127.0.0.1:58321"
      || await realpath(process.cwd()) !== `${ROOT}/runtime/web`) return null;
    const config = await readFile(`${ROOT}/runtime/supabase/config.toml`, "utf8");
    return /^project_id\s*=\s*"phoenix-local-baseline-001"\s*$/m.test(config) ? "local" : null;
  } catch {
    return null;
  }
}

export async function billingSimplifiedUiEnabled(organizationId?: string): Promise<boolean> {
  return await billingSimplifiedUiMode(organizationId) !== null;
}

export async function billingSimplifiedUiMutationEnabled(organizationId?: string): Promise<boolean> {
  return await billingSimplifiedUiMode(organizationId) === "local";
}

export async function requireBillingSimplifiedUiAccess(locale: string) {
  if (!await billingSimplifiedUiEnabled()) throw new Error("billing_simplified_ui_disabled");
  const access = await requireOwnerOrManager(locale);
  const organizationId = access.membership.organization.id;
  if (!await billingSimplifiedUiEnabled(organizationId)) throw new Error("billing_simplified_ui_tenant_denied");
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  const pos = await requirePosAccess(locale);
  if (pos.membership.organization.id !== organizationId) throw new Error("billing_simplified_ui_tenant_denied");
  return access;
}

export async function requireBillingSimplifiedUiMutationAccess(locale: string) {
  const access = await requireBillingSimplifiedUiAccess(locale);
  if (!await billingSimplifiedUiMutationEnabled(access.membership.organization.id)) {
    throw new Error("billing_simplified_ui_read_only");
  }
  return access;
}
