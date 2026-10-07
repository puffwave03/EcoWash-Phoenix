"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button";
import type { OrganizationSettingsState } from "@/features/organization-settings/server/actions";

type Settings = {
  name: string;
  defaultCurrency: string;
  timezone: string;
  defaultLocale: string;
  defaultCountryCode: string | null;
};

type Text = {
  name: string;
  currency: string;
  currencyHelp: string;
  currencyLocked: string;
  timezone: string;
  timezoneLocked: string;
  locale: string;
  country: string;
  countryHelp: string;
  save: string;
  saving: string;
  saved: string;
  invalid: string;
  unavailable: string;
};

const initialState: OrganizationSettingsState = { error: null, saved: false };
const inputClass = "min-h-11 w-full rounded-control border border-border bg-white px-3 text-sm text-foreground";

export function OrganizationSettingsForm({ action, settings, text }: {
  action: (state: OrganizationSettingsState, formData: FormData) => Promise<OrganizationSettingsState>;
  settings: Settings;
  text: Text;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return <form action={formAction} className="space-y-5 rounded-card border border-border bg-white p-5 shadow-sm">
    {state.error ? <p className="text-sm text-red-700" role="alert">{text[state.error]}</p> : null}
    {state.saved ? <p className="text-sm text-green-800" role="status">{text.saved}</p> : null}
    <div className="grid gap-4 md:grid-cols-2">
      <label className="space-y-2 text-sm font-semibold text-primary"><span>{text.name}</span><input className={inputClass} defaultValue={settings.name} maxLength={160} name="name" required /></label>
      <label className="space-y-2 text-sm font-semibold text-primary"><span>{text.currency}</span><input className={inputClass} defaultValue={settings.defaultCurrency} maxLength={3} minLength={3} name="defaultCurrency" required /><span className="block text-xs font-normal text-muted">{text.currencyHelp}</span></label>
      <label className="space-y-2 text-sm font-semibold text-primary"><span>{text.timezone}</span><input className={inputClass} defaultValue={settings.timezone} name="timezone" required /></label>
      <label className="space-y-2 text-sm font-semibold text-primary"><span>{text.locale}</span><select className={inputClass} defaultValue={settings.defaultLocale} key={settings.defaultLocale} name="defaultLocale">
        <option value="en">English</option><option value="it">Italiano</option><option value="es">Español</option><option value="fr">Français</option><option value="de">Deutsch</option>
      </select></label>
      <label className="space-y-2 text-sm font-semibold text-primary"><span>{text.country}</span><input className={inputClass} defaultValue={settings.defaultCountryCode ?? ""} maxLength={2} name="defaultCountryCode" /><span className="block text-xs font-normal text-muted">{text.countryHelp}</span></label>
    </div>
    <Button disabled={pending} type="submit">{pending ? text.saving : text.save}</Button>
  </form>;
}
