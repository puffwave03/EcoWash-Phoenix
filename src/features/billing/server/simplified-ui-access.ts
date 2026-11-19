import "server-only";

import { readFile, realpath } from "node:fs/promises";
import { FEATURES } from "@/features/entitlements/feature-catalog";
import { requireEntitlement } from "@/features/entitlements/server/resolver";
import { requirePosAccess } from "@/features/pos/server/access";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { getSupabaseConfig } from "@/lib/supabase/env";

const LAB = "phoenix-local-baseline-001";
const ROOT = "/Volumes/DEV/Phoenix-Local-Baseline-001";
const SYNTHETIC_TENANTS = new Set([
  "5a5a6393-7366-5506-9527-8c9da2c11884", // EcoWash Demo
  "b4e08840-0912-5db1-ad22-c0291af2abdd", // Phoenix Test B
]);

// Opt-in is server-only, off by default, and insufficient on its own: the
// actual Supabase client endpoint, runtime path, project and tenant must match.
// Set PHOENIX_BILLING_SIMPLIFIED_UI=phoenix-local-baseline-001 only after review.
export async function billingSimplifiedUiEnabled(organizationId?: string): Promise<boolean> {
  if (process.env.PHOENIX_BILLING_SIMPLIFIED_UI !== LAB || process.env.VERCEL || process.env.VERCEL_ENV
    || (organizationId !== undefined && !SYNTHETIC_TENANTS.has(organizationId))) return false;
  try {
    if (getSupabaseConfig().url !== "http://127.0.0.1:58321"
      || await realpath(process.cwd()) !== `${ROOT}/runtime/web`) return false;
    const config = await readFile(`${ROOT}/runtime/supabase/config.toml`, "utf8");
    return /^project_id\s*=\s*"phoenix-local-baseline-001"\s*$/m.test(config);
  } catch {
    return false;
  }
}

export async function requireBillingSimplifiedUiAccess(locale: string) {
  if (!await billingSimplifiedUiEnabled()) throw new Error("billing_simplified_ui_disabled");
  const access = await requireOwnerOrManager(locale);
  const organizationId = access.membership.organization.id;
  if (!SYNTHETIC_TENANTS.has(organizationId)) throw new Error("billing_simplified_ui_tenant_denied");
  await requireEntitlement(locale, FEATURES.billingInvoicing);
  const pos = await requirePosAccess(locale);
  if (pos.membership.organization.id !== organizationId) throw new Error("billing_simplified_ui_tenant_denied");
  return access;
}
