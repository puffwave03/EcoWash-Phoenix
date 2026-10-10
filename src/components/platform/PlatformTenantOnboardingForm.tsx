"use client";

import { startTransition, useActionState, useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Link } from "@/i18n/navigation";
import { suggestTenantSlug } from "@/features/platform-admin/tenant-onboarding-validation";
import type { TenantOnboardingField, TenantOnboardingFieldErrors } from "@/features/platform-admin/tenant-onboarding-validation";
import type { TenantOnboardingError, TenantOnboardingState } from "@/features/platform-admin/types-onboarding";

type Text = {
  title: string; description: string; back: string;
  fields: Record<"name" | "slug" | "currency" | "timezone" | "locale" | "country" | "location" | "ownerEmail" | "ownerId", string>;
  helpers: Record<"slug" | "defaults" | "owner" | "recovery", string>;
  modes: Record<"invite" | "existing", string>;
  placeholders: Record<"currency" | "timezone" | "country", string>;
  actions: Record<"submit" | "pending" | "useRecovery" | "detail", string>;
  results: Record<"success" | "failed" | "unconfirmed" | "prepared" | "replayLabel" | "yes" | "no" | "requested" | "existing" | "organizationId" | "slug" | "ownerId" | "ownerEmail" | "location" | "invitation", string>;
  errors: Record<TenantOnboardingError | NonNullable<TenantOnboardingFieldErrors[TenantOnboardingField]>, string>;
};

const inputClass = "min-h-11 w-full rounded-control border border-border bg-white px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function PlatformTenantOnboardingForm({ action, initialKey, locale, text }: {
  action: (state: TenantOnboardingState, formData: FormData) => Promise<TenantOnboardingState>;
  initialKey: string;
  locale: string;
  text: Text;
}) {
  const [state, formAction, pending] = useActionState(action, {
    key: initialKey, fingerprint: null, ownerMode: "invite", fieldErrors: {}, error: null, preparedOwner: null, success: null,
  } satisfies TenantOnboardingState);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [modeOverride, setModeOverride] = useState<"invite" | "existing" | null>(null);
  const [ownerIdOverride, setOwnerIdOverride] = useState<string | null>(null);
  const [ownerEmailOverride, setOwnerEmailOverride] = useState<string | null>(null);
  const mode = modeOverride ?? state.ownerMode;
  const ownerId = ownerIdOverride ?? (state.ownerMode === "existing" ? state.preparedOwner?.id ?? "" : "");
  const ownerEmail = ownerEmailOverride ?? state.preparedOwner?.email ?? "";
  const [currency, setCurrency] = useState("");
  const [timezone, setTimezone] = useState("");
  const [defaultLocale, setDefaultLocale] = useState("");
  const [country, setCountry] = useState("");
  const [location, setLocation] = useState("");
  const fieldError = (field: TenantOnboardingField) => {
    const code = state.fieldErrors[field];
    return code ? <span className="text-xs font-medium text-red-700">{text.errors[code]}</span> : null;
  };
  return (
    <Card className="bg-white">
      {state.error !== "platformAdminRequired" ? <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(() => {
            formAction(formData);
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-semibold text-primary">
            <span>{text.fields.name}</span>
            <input className={inputClass} maxLength={160} name="name" onChange={(event) => {
              setName(event.target.value);
              if (!slugEdited) setSlug(suggestTenantSlug(event.target.value));
            }} required value={name} />
            {fieldError("name")}
          </label>
          <label className="space-y-1 text-sm font-semibold text-primary">
            <span>{text.fields.slug}</span>
            <input className={inputClass} maxLength={80} name="slug" onChange={(event) => { setSlugEdited(true); setSlug(event.target.value); }} required value={slug} />
            <span className="block text-xs font-normal text-muted">{text.helpers.slug}</span>
            {fieldError("slug")}
          </label>
          <label className="space-y-1 text-sm font-semibold text-primary">
            <span>{text.fields.currency}</span>
            <input className={inputClass} maxLength={3} name="currency" onChange={(event) => setCurrency(event.target.value)} placeholder={text.placeholders.currency} required value={currency} />
            {fieldError("currency")}
          </label>
          <label className="space-y-1 text-sm font-semibold text-primary">
            <span>{text.fields.timezone}</span>
            <input className={inputClass} name="timezone" onChange={(event) => setTimezone(event.target.value)} placeholder={text.placeholders.timezone} required value={timezone} />
            {fieldError("timezone")}
          </label>
          <label className="space-y-1 text-sm font-semibold text-primary">
            <span>{text.fields.locale}</span>
            <select className={inputClass} name="locale" onChange={(event) => setDefaultLocale(event.target.value)} required value={defaultLocale}>
              <option disabled value="">{text.fields.locale}</option>
              {(["en", "it", "es", "fr", "de"] as const).map((value) => <option key={value} value={value}>{value.toUpperCase()}</option>)}
            </select>
            {fieldError("locale")}
          </label>
          <label className="space-y-1 text-sm font-semibold text-primary">
            <span>{text.fields.country}</span>
            <input className={inputClass} maxLength={2} name="country" onChange={(event) => setCountry(event.target.value)} placeholder={text.placeholders.country} required value={country} />
            {fieldError("country")}
          </label>
          <label className="space-y-1 text-sm font-semibold text-primary sm:col-span-2">
            <span>{text.fields.location}</span>
            <input className={inputClass} maxLength={160} name="location" onChange={(event) => setLocation(event.target.value)} required value={location} />
            {fieldError("location")}
          </label>
        </div>
        <p className="text-xs text-muted">{text.helpers.defaults}</p>
        <fieldset className="space-y-3 border-t border-border pt-5">
          <legend className="text-sm font-semibold text-primary">{text.helpers.owner}</legend>
          <div className="flex flex-wrap gap-5 text-sm text-primary">
            <label className="flex items-center gap-2"><input checked={mode === "invite"} name="ownerMode" onChange={() => setModeOverride("invite")} type="radio" value="invite" />{text.modes.invite}</label>
            <label className="flex items-center gap-2"><input checked={mode === "existing"} name="ownerMode" onChange={() => setModeOverride("existing")} type="radio" value="existing" />{text.modes.existing}</label>
          </div>
          <label className="block space-y-1 text-sm font-semibold text-primary">
            <span>{text.fields.ownerEmail}</span>
            <input className={inputClass} name="ownerEmail" onChange={(event) => setOwnerEmailOverride(event.target.value)} required type="email" value={ownerEmail} />
            {fieldError("ownerEmail")}
          </label>
          {mode === "existing" ? <label className="block space-y-1 text-sm font-semibold text-primary">
            <span>{text.fields.ownerId}</span>
            <input className={inputClass} name="ownerId" onChange={(event) => setOwnerIdOverride(event.target.value)} required value={ownerId} />
            <span className="block text-xs font-normal text-muted">{text.helpers.recovery}</span>
            {fieldError("ownerId")}
          </label> : null}
        </fieldset>
        <Button disabled={pending} type="submit">{pending ? text.actions.pending : text.actions.submit}</Button>
      </form> : null}
      {state.error ? <div aria-live="polite" className="mt-6 rounded-control border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p className="font-semibold">{state.error === "unknown" ? text.results.unconfirmed : text.results.failed}</p>
        <p className="mt-1">{text.errors[state.error]}</p>
        {state.preparedOwner ? <div className="mt-3 space-y-1">
          {state.error !== "unknown" ? <p>{text.results.prepared}</p> : null}
          <p>{text.results.ownerEmail}: {state.preparedOwner.email}</p>
          <p>{text.results.ownerId}: <span className="break-all font-mono">{state.preparedOwner.id}</span></p>
          {state.error !== "unknown" ? <Button className="mt-2" onClick={() => {
            setModeOverride("existing"); setOwnerIdOverride(state.preparedOwner!.id); setOwnerEmailOverride(state.preparedOwner!.email);
          }} type="button" variant="secondary">{text.actions.useRecovery}</Button> : null}
        </div> : null}
      </div> : null}
      {state.success ? <div aria-live="polite" className="mt-6 rounded-control border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <p className="font-semibold">{text.results.success}</p>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          <div><dt>{text.fields.name}</dt><dd className="font-semibold">{state.success.name}</dd></div>
          <div><dt>{text.results.organizationId}</dt><dd className="break-all font-mono">{state.success.organizationId}</dd></div>
          <div><dt>{text.results.slug}</dt><dd>{state.success.slug}</dd></div>
          <div><dt>{text.results.ownerEmail}</dt><dd>{state.success.ownerEmail}</dd></div>
          <div><dt>{text.results.ownerId}</dt><dd className="break-all font-mono">{state.success.ownerId}</dd></div>
          <div><dt>{text.results.location}</dt><dd>{state.success.location}</dd></div>
          <div><dt>{text.results.invitation}</dt><dd>{state.success.invitation === "requested" ? text.results.requested : text.results.existing}</dd></div>
          <div><dt>{text.results.replayLabel}</dt><dd>{state.success.replayed ? text.results.yes : text.results.no}</dd></div>
        </dl>
        <Link className="mt-4 inline-block font-semibold underline" href={`/platform/organizations/${state.success.organizationId}`} locale={locale}>{text.actions.detail}</Link>
      </div> : null}
    </Card>
  );
}
