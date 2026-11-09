"use client";

import { useActionState, useState } from "react";
import {
  CUSTOMER_COPY_FORMATS, isCustomerCopyProfileCompatible, type CustomerCopyFormat,
  type DocumentPreferenceState, type DocumentPrintPreference,
} from "@/features/printer-settings/document-preferences";
import type { PrinterLocation, PrinterProfile } from "@/features/printer-settings/types";

export type DocumentPreferencesText = {
  title: string; description: string; customerCopy: string; location: string;
  format: string; formats: Record<CustomerCopyFormat, string>; profile: string;
  noProfile: string; browserHelp: string; otherDocuments: string; noLocations: string;
  save: string; saving: string; success: string; validation: string; generic: string; unavailable: string;
};
type Props = {
  action: (state: DocumentPreferenceState, data: FormData) => Promise<DocumentPreferenceState>;
  available: boolean; locations: PrinterLocation[]; preferences: DocumentPrintPreference[];
  profiles: PrinterProfile[]; text: DocumentPreferencesText;
};
const fieldClass = "min-h-12 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-base text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary";

export function DocumentPrintPreferences(props: Props) {
  const [locationId, setLocationId] = useState(props.locations[0]?.id ?? "");
  const preference = props.preferences.find((item) => item.locationId === locationId);
  return (
    <section className="space-y-5 rounded-3xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="document-preferences-title">
      <header className="space-y-2">
        <h2 id="document-preferences-title" className="text-xl font-bold text-primary">{props.text.title}</h2>
        <p className="text-sm leading-6 text-muted">{props.text.description}</p>
      </header>
      {!props.available && <p role="status" className="text-sm text-muted">{props.text.unavailable}</p>}
      {props.locations.length === 0 ? <p className="text-sm text-muted">{props.text.noLocations}</p> : <>
        <label className="block max-w-lg space-y-2 text-sm font-semibold text-primary">
          <span>{props.text.location}</span>
          <select className={fieldClass} value={locationId} onChange={(event) => setLocationId(event.target.value)}>
            {props.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
          </select>
        </label>
        <PreferenceForm {...props} locationId={locationId} preference={preference}
          key={`${locationId}:${preference?.paperFormat ?? "a4"}:${preference?.printerProfileId ?? ""}`} />
      </>}
      <p className="text-sm leading-6 text-muted">{props.text.otherDocuments}</p>
    </section>
  );
}

function PreferenceForm({ action, available, locationId, preference, profiles, text }: Props & {
  locationId: string; preference: DocumentPrintPreference | undefined;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null, success: false });
  const [format, setFormat] = useState<CustomerCopyFormat>(preference?.paperFormat ?? "a4");
  const compatible = profiles.filter((profile) => isCustomerCopyProfileCompatible(profile, locationId, format));
  const savedProfile = compatible.some((profile) => profile.id === preference?.printerProfileId) ? preference?.printerProfileId ?? "" : "";
  const [profileId, setProfileId] = useState(savedProfile);
  const selectedProfileId = compatible.some((profile) => profile.id === profileId) ? profileId : "";
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locationId" value={locationId} />
      <fieldset disabled={!available || pending} className="space-y-4 disabled:opacity-60">
        <legend className="mb-3 font-bold text-primary">{text.customerCopy}</legend>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-semibold text-primary">
            <span>{text.format}</span>
            <select className={fieldClass} name="paperFormat" value={format} onChange={(event) => {
              setFormat(event.target.value as CustomerCopyFormat); setProfileId("");
            }}>
              {CUSTOMER_COPY_FORMATS.map((value) => <option key={value} value={value}>{text.formats[value]}</option>)}
            </select>
          </label>
          <label className="space-y-2 text-sm font-semibold text-primary">
            <span>{text.profile}</span>
            <select className={fieldClass} name="printerProfileId" value={selectedProfileId} onChange={(event) => setProfileId(event.target.value)}>
              <option value="">{text.noProfile}</option>
              {compatible.map((profile) => <option key={profile.id} value={profile.id}>{profile.displayName}</option>)}
            </select>
          </label>
        </div>
        <p className="text-sm leading-6 text-muted">{text.browserHelp}</p>
        <button type="submit" className="min-h-12 rounded-2xl bg-primary px-5 py-3 font-bold text-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary">{pending ? text.saving : text.save}</button>
      </fieldset>
      <div role="status" aria-live="polite">
        {state.error && <p className="text-sm text-error">{text[state.error]}</p>}
        {state.success && <p className="text-sm text-primary">{text.success}</p>}
      </div>
    </form>
  );
}
