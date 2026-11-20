import "server-only";
import { requireOwner } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasEntitlement } from "@/features/entitlements/server/resolver";
import { FEATURES } from "@/features/entitlements/feature-catalog";
import type { TicketSettings } from "../ticket-settings";

export async function getOwnerTicketSettings(locale: string): Promise<(TicketSettings & { canEditSeries: boolean }) | null> {
  const { membership } = await requireOwner(locale);
  const supabase = await createSupabaseServerClient();
  const orgId = membership.organization.id;
  const [org, entitled] = await Promise.all([
    supabase.from("organizations").select("ticket_footer, ticket_special_message").eq("id", orgId).single<{ ticket_footer: string | null; ticket_special_message: string | null }>(),
    hasEntitlement(locale, FEATURES.billingInvoicing),
  ]);
  if (org.error) return null;
  // A hidden/unavailable Billing row must never become an implicit clear.
  if (!entitled) return { footer: org.data.ticket_footer, specialMessage: org.data.ticket_special_message, simplifiedSeries: null, canEditSeries: false };
  const billing = await supabase.from("organization_billing_settings").select("simplified_series")
    .eq("organization_id", orgId).maybeSingle<{ simplified_series: string | null }>();
  return { footer: org.data.ticket_footer, specialMessage: org.data.ticket_special_message, simplifiedSeries: billing.data?.simplified_series ?? null, canEditSeries: !billing.error };
}
