"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { routing } from "@/i18n/routing";

export type OrganizationSettingsState = {
  error: "invalid" | "unavailable" | "currencyLocked" | "timezoneLocked" | null;
  saved: boolean;
};

const CURRENCY = /^[A-Z]{3}$/;
const COUNTRY = /^[A-Z]{2}$/;

export async function saveOrganizationSettingsAction(
  locale: string,
  _state: OrganizationSettingsState,
  formData: FormData,
): Promise<OrganizationSettingsState> {
  const { membership } = await requireOwner(locale);
  const name = String(formData.get("name") ?? "").trim();
  const currency = String(formData.get("defaultCurrency") ?? "").trim().toUpperCase();
  const timezone = String(formData.get("timezone") ?? "").trim();
  const defaultLocale = String(formData.get("defaultLocale") ?? "").trim();
  const country = String(formData.get("defaultCountryCode") ?? "").trim().toUpperCase();
  let timezoneValid = false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
    timezoneValid = Boolean(timezone);
  } catch { /* The database also validates the exact timezone. */ }

  if (!name || name.length > 160 || !CURRENCY.test(currency) || !timezoneValid
    || !routing.locales.includes(defaultLocale as (typeof routing.locales)[number])
    || (country && !COUNTRY.test(country))) {
    return { error: "invalid", saved: false };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_current_organization_settings", {
    target_name: name,
    target_default_currency: currency,
    target_timezone: timezone,
    target_default_locale: defaultLocale,
    target_default_country_code: country || null,
  });
  if (error) {
    console.error("Organization settings update failed", error.code);
    if (error.code === "22023" && error.message === "organization_currency_locked") {
      return { error: "currencyLocked", saved: false };
    }
    if (error.code === "22023" && error.message === "organization_timezone_locked") {
      return { error: "timezoneLocked", saved: false };
    }
    return { error: error.code === "22023" ? "invalid" : "unavailable", saved: false };
  }
  const { data: savedOrganization, error: readError } = await supabase
    .from("organizations")
    .select("default_locale")
    .eq("id", membership.organization.id)
    .single<{ default_locale: string }>();
  if (readError || savedOrganization?.default_locale !== defaultLocale) {
    console.error("Organization settings locale read-back failed", readError?.code ?? "mismatch");
    return { error: "unavailable", saved: false };
  }
  revalidatePath(`/${locale}/app/settings/organization`);
  revalidatePath(`/${locale}/app`, "layout");
  return { error: null, saved: true };
}
