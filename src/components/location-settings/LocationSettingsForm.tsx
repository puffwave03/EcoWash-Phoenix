"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button";
import type { LocationSettingsState } from "@/features/location-settings/server/actions";
import type { LocationSettingsRow } from "@/features/location-settings/server/queries";

type Text = {
  name: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  phone: string;
  save: string;
  saving: string;
  saved: string;
  invalid: string;
  unavailable: string;
  failure: string;
};

const initialState: LocationSettingsState = { status: "idle" };
const inputClass = "min-h-11 w-full rounded-control border border-border bg-white px-3 text-sm text-foreground";

export function LocationSettingsForm({ action, location, text }: {
  action: (state: LocationSettingsState, formData: FormData) => Promise<LocationSettingsState>;
  location: LocationSettingsRow;
  text: Text;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const fields = [
    ["addressLine1", text.addressLine1, location.address_line1, 320],
    ["addressLine2", text.addressLine2, location.address_line2, 320],
    ["city", text.city, location.city, 160],
    ["region", text.region, location.region, 160],
    ["postalCode", text.postalCode, location.postal_code, 32],
    ["countryCode", text.countryCode, location.country_code, 2],
    ["phone", text.phone, location.phone, 40],
  ] as const;
  return <form action={formAction} className="space-y-5 rounded-card border border-border bg-white p-5 shadow-sm">
    {state.status !== "idle" ? <p className={`text-sm ${state.status === "saved" ? "text-green-800" : "text-red-700"}`} role={state.status === "saved" ? "status" : "alert"}>{text[state.status]}</p> : null}
    <div className="grid gap-4 md:grid-cols-2">
      <label className="space-y-2 text-sm font-semibold text-primary"><span>{text.name}</span><input className={inputClass} defaultValue={location.name} maxLength={160} name="name" required /></label>
      {fields.map(([name, label, value, maxLength]) => <label className="space-y-2 text-sm font-semibold text-primary" key={name}>
        <span>{label}</span><input className={inputClass} defaultValue={value ?? ""} maxLength={maxLength} name={name} />
      </label>)}
    </div>
    <Button disabled={pending} type="submit">{pending ? text.saving : text.save}</Button>
  </form>;
}
