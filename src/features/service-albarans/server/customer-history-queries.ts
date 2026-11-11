import "server-only";

import { FEATURES } from "@/features/entitlements/feature-catalog";
import { hasEntitlement } from "@/features/entitlements/server/resolver";
import { readServiceAlbaranRegisterPage } from "@/features/service-albarans/server/register-queries";
import { hasOperationalCapability } from "@/lib/auth/capabilities";
import { requireMembership } from "@/lib/auth/require-membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getCustomerServiceAlbaranHistory(locale: string, customerId: string, page?: string) {
  const { membership } = await requireMembership(locale);
  // Customer detail remains Owner/Manager-only. Missing print access must not redirect
  // the otherwise accessible customer page or expose a document count.
  if (!UUID.test(customerId) || (membership.role !== "owner" && membership.role !== "manager")
    || !hasOperationalCapability(membership, "pos")) return { state: "hidden" } as const;

  try {
    if (!await hasEntitlement(locale, FEATURES.printing)) return { state: "hidden" } as const;
    const supabase = await createSupabaseServerClient();
    const customer = await supabase.from("customers").select("customer_type")
      .eq("organization_id", membership.organization.id).eq("id", customerId)
      .maybeSingle<{ customer_type: string }>();
    if (customer.error) {
      console.error("Customer service albaran access read failed", customer.error.code);
      return { state: "unavailable" } as const;
    }
    if (!customer.data || customer.data.customer_type !== "business") return { state: "hidden" } as const;
    // Scope by persisted identifiers, independent of historical/current customer names.
    return await readServiceAlbaranRegisterPage(membership.organization, { page }, customerId);
  } catch {
    console.error("Customer service albaran history transport failed");
    return { state: "unavailable" } as const;
  }
}
