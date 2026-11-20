"use server";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseTicketSettings, parseTicketSpecialMessage } from "../ticket-settings";
import { hasEntitlement } from "@/features/entitlements/server/resolver";
import { FEATURES } from "@/features/entitlements/feature-catalog";

export async function saveTicketSettingsAction(locale: string, _state: "idle" | "saved" | "error", form: FormData): Promise<"idle" | "saved" | "error"> {
  await requireOwner(locale);
  const intent = form.get("intent");
  if (intent === "specialMessage") {
    const parsed = parseTicketSpecialMessage(String(form.get("ticket_special_message") ?? ""));
    if (!parsed) return "error";
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("update_current_ticket_special_message", { target_message: parsed.specialMessage });
    if (error) return "error";
    revalidatePath(`/${locale}/app/settings/organization`);
    return "saved";
  }
  if (intent !== "footer" && intent !== "series") return "error";
  const updateSeries = intent === "series";
  if (updateSeries && !await hasEntitlement(locale, FEATURES.billingInvoicing)) return "error";
  const settings = parseTicketSettings(updateSeries ? "" : String(form.get("footer") ?? ""), updateSeries ? String(form.get("simplifiedSeries") ?? "") : "");
  if (!settings) return "error";
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_current_ticket_settings", {
    target_footer: settings.footer, target_simplified_series: settings.simplifiedSeries, target_update_series: updateSeries,
  });
  if (error) return "error";
  revalidatePath(`/${locale}/app/settings/organization`);
  return "saved";
}
