"use client";

import { useActionState, useState } from "react";
import type {
  PrinterConnectionMode,
  PrinterLocation,
  PrinterOrientation,
  PrinterPaperFormat,
  PrinterProfile,
  PrinterPurpose,
  PrinterSettingsActionState,
} from "@/features/printer-settings/types";

export type PrinterSettingsText = {
  browserFallback: string;
  browserFunctional: string;
  configured: string;
  connectionMode: string;
  connectionModes: Record<PrinterConnectionMode, string>;
  copies: string;
  default: string;
  description: string;
  deviceHelp: string;
  deviceIdentifier: string;
  disabled: string;
  displayName: string;
  edit: string;
  enabled: string;
  eyebrow: string;
  gap: string;
  genericError: string;
  height: string;
  labelLayout: string;
  location: string;
  makeDefault: string;
  margin: string;
  newProfile: string;
  noLocations: string;
  noProfiles: string;
  orientation: string;
  orientations: Record<PrinterOrientation, string>;
  paperFormat: string;
  paperFormats: Record<PrinterPaperFormat, string>;
  purpose: string;
  purposes: Record<PrinterPurpose, string>;
  save: string;
  saving: string;
  success: string;
  title: string;
  validationError: string;
  width: string;
};

type Props = {
  action: (state: PrinterSettingsActionState, formData: FormData) => Promise<PrinterSettingsActionState>;
  locations: PrinterLocation[];
  profiles: PrinterProfile[];
  text: PrinterSettingsText;
};

const initialState: PrinterSettingsActionState = { error: null, savedProfileId: null, success: false };

function fieldClass() {
  return "mt-1 min-h-11 w-full rounded-control border border-border bg-white px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";
}

function initialPaperFormat(purpose: PrinterPurpose): PrinterPaperFormat {
  if (purpose === "label") return "label_custom";
  if (purpose === "ticket") return "ticket_a4";
  return "receipt_80mm";
}

function formatsFor(purpose: PrinterPurpose): PrinterPaperFormat[] {
  if (purpose === "label") return ["label_custom", "browser_pdf"];
  if (purpose === "ticket") return ["ticket_a4", "browser_pdf"];
  return ["receipt_58mm", "receipt_80mm", "browser_pdf"];
}

export function PrinterSettingsWorkspace({ action, locations, profiles, text }: Props) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [editing, setEditing] = useState<PrinterProfile | null>(null);
  const [purpose, setPurpose] = useState<PrinterPurpose>("receipt");
  const [paperFormat, setPaperFormat] = useState<PrinterPaperFormat>("receipt_80mm");
  const [enabled, setEnabled] = useState(true);
  const [isDefault, setIsDefault] = useState(true);

  function editProfile(profile: PrinterProfile | null) {
    setEditing(profile);
    setPurpose(profile?.purpose ?? "receipt");
    setPaperFormat(profile?.paperFormat ?? "receipt_80mm");
    setEnabled(profile?.enabled ?? true);
    setIsDefault(profile?.isDefault ?? true);
  }

  function changePurpose(next: PrinterPurpose) {
    setPurpose(next);
    setPaperFormat(initialPaperFormat(next));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-secondary">{text.configured}</p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">{text.browserFunctional}</p>
          </div>
          <button className="min-h-11 rounded-control border border-primary px-4 text-sm font-bold text-primary" onClick={() => editProfile(null)} type="button">+ {text.newProfile}</button>
        </div>

        {profiles.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {profiles.map((profile) => (
              <article className="border border-border bg-white p-4 shadow-card" key={profile.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.1em] text-secondary">{text.purposes[profile.purpose]}</p>
                    <h2 className="mt-1 truncate text-lg font-black text-primary">{profile.displayName}</h2>
                    <p className="mt-1 text-sm text-muted">{profile.locationName}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-[0.7rem] font-black uppercase">
                    {profile.isDefault ? <span className="rounded-full bg-primary-soft px-2 py-1 text-primary">{text.default}</span> : null}
                    {!profile.enabled ? <span className="rounded-full bg-neutral-100 px-2 py-1 text-muted">{text.disabled}</span> : null}
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs">
                  <div><dt className="text-muted">{text.connectionMode}</dt><dd className="mt-1 font-bold text-primary">{text.connectionModes[profile.connectionMode]}</dd></div>
                  <div><dt className="text-muted">{text.paperFormat}</dt><dd className="mt-1 font-bold text-primary">{text.paperFormats[profile.paperFormat]}</dd></div>
                </dl>
                {profile.connectionMode !== "browser" ? <p className="mt-3 rounded-control bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">{text.browserFallback}</p> : null}
                <button className="mt-4 min-h-11 w-full rounded-control border border-border text-sm font-bold text-primary" onClick={() => editProfile(profile)} type="button">{text.edit}</button>
              </article>
            ))}
          </div>
        ) : <p className="border-2 border-dashed border-border bg-white p-8 text-center text-muted">{text.noProfiles}</p>}
      </section>

      <aside className="xl:sticky xl:top-6 xl:self-start">
        <form action={formAction} className="space-y-4 border-t-4 border-primary bg-white p-5 shadow-card" key={editing?.id ?? "new"}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black text-primary">{editing ? text.edit : text.newProfile}</h2>
            {editing ? <button className="min-h-10 text-sm font-bold text-muted" onClick={() => editProfile(null)} type="button">{text.newProfile}</button> : null}
          </div>
          <input name="profileId" type="hidden" value={editing?.id ?? ""} />

          {state.success ? <p className="rounded-control bg-emerald-50 p-3 text-sm font-semibold text-emerald-800" role="status">{text.success}</p> : null}
          {state.error ? <p className="rounded-control bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">{state.error === "validation" ? text.validationError : text.genericError}</p> : null}
          {!locations.length ? <p className="rounded-control bg-amber-50 p-3 text-sm text-amber-900">{text.noLocations}</p> : null}

          <label className="block text-xs font-bold text-muted">{text.displayName}<input className={fieldClass()} defaultValue={editing?.displayName ?? ""} maxLength={120} name="displayName" required /></label>
          <label className="block text-xs font-bold text-muted">{text.location}<select className={fieldClass()} defaultValue={editing?.locationId ?? locations[0]?.id} name="locationId" required>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-bold text-muted">{text.purpose}<select className={fieldClass()} name="purpose" onChange={(event) => changePurpose(event.target.value as PrinterPurpose)} value={purpose}>{(["receipt", "label", "ticket"] as PrinterPurpose[]).map((value) => <option key={value} value={value}>{text.purposes[value]}</option>)}</select></label>
            <label className="block text-xs font-bold text-muted">{text.connectionMode}<select className={fieldClass()} defaultValue={editing?.connectionMode ?? "browser"} name="connectionMode">{(["browser", "network", "local_bridge", "vendor_adapter"] as PrinterConnectionMode[]).map((value) => <option key={value} value={value}>{text.connectionModes[value]}</option>)}</select></label>
          </div>
          <label className="block text-xs font-bold text-muted">{text.paperFormat}<select className={fieldClass()} name="paperFormat" onChange={(event) => setPaperFormat(event.target.value as PrinterPaperFormat)} value={paperFormat}>{formatsFor(purpose).map((value) => <option key={value} value={value}>{text.paperFormats[value]}</option>)}</select></label>
          <label className="block text-xs font-bold text-muted">{text.deviceIdentifier}<input className={fieldClass()} defaultValue={editing?.deviceIdentifier ?? ""} maxLength={240} name="deviceIdentifier" /><span className="mt-1 block font-normal leading-5">{text.deviceHelp}</span></label>

          {purpose === "label" && paperFormat === "label_custom" ? (
            <fieldset className="grid grid-cols-2 gap-3 border-l-4 border-primary bg-primary-soft p-3">
              <legend className="col-span-2 px-1 text-xs font-black uppercase tracking-[0.1em] text-primary">{text.labelLayout}</legend>
              <label className="text-xs font-bold text-muted">{text.width}<input className={fieldClass()} defaultValue={editing?.labelWidthMm ?? 50} max="200" min="10" name="labelWidthMm" step="0.1" type="number" /></label>
              <label className="text-xs font-bold text-muted">{text.height}<input className={fieldClass()} defaultValue={editing?.labelHeightMm ?? 30} max="300" min="10" name="labelHeightMm" step="0.1" type="number" /></label>
              <label className="text-xs font-bold text-muted">{text.orientation}<select className={fieldClass()} defaultValue={editing?.labelOrientation ?? "portrait"} name="labelOrientation">{(["portrait", "landscape"] as PrinterOrientation[]).map((value) => <option key={value} value={value}>{text.orientations[value]}</option>)}</select></label>
              <label className="text-xs font-bold text-muted">{text.copies}<input className={fieldClass()} defaultValue={editing?.labelCopies ?? 1} max="20" min="1" name="labelCopies" step="1" type="number" /></label>
              <label className="text-xs font-bold text-muted">{text.margin}<input className={fieldClass()} defaultValue={editing?.labelMarginMm ?? 2} max="20" min="0" name="labelMarginMm" step="0.1" type="number" /></label>
              <label className="text-xs font-bold text-muted">{text.gap}<input className={fieldClass()} defaultValue={editing?.labelGapMm ?? 3} max="20" min="0" name="labelGapMm" step="0.1" type="number" /></label>
            </fieldset>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-primary"><input checked={enabled} name="enabled" onChange={(event) => { setEnabled(event.target.checked); if (!event.target.checked) setIsDefault(false); }} type="checkbox" value="true" />{text.enabled}</label>
            <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-primary"><input checked={isDefault} disabled={!enabled} name="isDefault" onChange={(event) => setIsDefault(event.target.checked)} type="checkbox" value="true" />{text.makeDefault}</label>
          </div>
          <button className="min-h-12 w-full rounded-control bg-primary px-5 font-black text-white disabled:opacity-40" disabled={isPending || !locations.length} type="submit">{isPending ? text.saving : text.save}</button>
        </form>
      </aside>
    </div>
  );
}
