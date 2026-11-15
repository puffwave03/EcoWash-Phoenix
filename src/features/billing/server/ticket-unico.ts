import "server-only";
import { requireMembership } from "@/lib/auth/require-membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TICKET_UNICO_PILOT_ID } from "@/features/billing/ticket-unico";

// UUID alone never enables the workflow. SQL resolves the current authenticated
// tenant, its explicit flag, Billing entitlement and simplified-invoicing switch.
// Only a verified FALSE selects legacy actions for the pilot. An unknown state
// stops before a write, instead of discarding a previously selected ordinary request.
export async function ticketUnicoEnabled(locale: string): Promise<boolean> {
  const { membership } = await requireMembership(locale);
  if (membership.organization.id !== TICKET_UNICO_PILOT_ID) return false;
  try {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.rpc("get_ticket_unico_enabled");
    if (error || typeof data !== "boolean") throw new Error("ticket_unico_state_unavailable");
    return data;
  } catch {
    throw new Error("ticket_unico_state_unavailable");
  }
}
