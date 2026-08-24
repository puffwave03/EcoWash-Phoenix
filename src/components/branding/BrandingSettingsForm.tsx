"use client";

/* eslint-disable @next/next/no-img-element */
import { useActionState, useState, type CSSProperties, type ChangeEvent } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type {
  BrandingActionState,
  BrandFocalPosition,
  OrganizationBrandingSettings,
} from "@/features/branding/types";
import { safeBrandPalette } from "@/features/branding/validation";

type BrandingSettingsText = {
  address: string;
  colors: string;
  colorsHelp: string;
  commercialName: string;
  contact: string;
  fileHelp: string;
  focalPosition: string;
  focalPositions: Record<BrandFocalPosition, string>;
  formError: string;
  hero: string;
  identity: string;
  logo: string;
  logoAlt: string;
  migrationRequired: string;
  portal: string;
  portalSubtitle: string;
  portalTitle: string;
  preview: string;
  primaryColor: string;
  promoBody: string;
  promoCtaHref: string;
  promoCtaLabel: string;
  promoEnabled: string;
  promoImage: string;
  promotion: string;
  promoTitle: string;
  removeHero: string;
  removeLogo: string;
  removePromoImage: string;
  save: string;
  saving: string;
  softColor: string;
  strongColor: string;
  success: string;
  supportEmail: string;
  supportPhone: string;
  supportWhatsapp: string;
  validationError: string;
  website: string;
};

type BrandingSettingsFormProps = {
  action: (state: BrandingActionState, formData: FormData) => Promise<BrandingActionState>;
  settings: OrganizationBrandingSettings;
  text: BrandingSettingsText;
};

const initialState: BrandingActionState = {
  fieldErrors: {},
  formError: null,
  success: false,
};

function fieldClass(hasError = false) {
  return `min-h-11 w-full rounded-control border bg-white px-3 text-sm text-foreground outline-none transition-standard focus:border-primary focus:ring-2 focus:ring-primary/20 ${
    hasError ? "border-red-300" : "border-border"
  }`;
}

function imagePreview(event: ChangeEvent<HTMLInputElement>, update: (value: string | null) => void) {
  const file = event.target.files?.[0];
  if (file) update(URL.createObjectURL(file));
}

export function BrandingSettingsForm({ action, settings, text }: BrandingSettingsFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [commercialName, setCommercialName] = useState(settings.commercialName);
  const [primaryColor, setPrimaryColor] = useState(settings.primaryColor);
  const [strongColor, setStrongColor] = useState(settings.strongColor);
  const [softColor, setSoftColor] = useState(settings.softColor);
  const [logoPreview, setLogoPreview] = useState(settings.logoUrl);
  const [heroPreview, setHeroPreview] = useState(settings.portalHeroUrl);
  const palette = safeBrandPalette(primaryColor, strongColor, softColor);
  const previewStyle = {
    ...(palette?.primary ? { "--color-primary": palette.primary } : {}),
    ...(palette?.soft ? { "--color-primary-soft": palette.soft } : {}),
    ...(palette?.strong ? { "--color-primary-strong": palette.strong } : {}),
  } as CSSProperties;
  const hasError = (field: string) => Boolean(state.fieldErrors[field]);

  if (!settings.available) {
    return (
      <p className="rounded-card border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
        {text.migrationRequired}
      </p>
    );
  }

  return (
    <form action={formAction} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        {state.success ? (
          <p className="rounded-control border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800" role="status">
            {text.success}
          </p>
        ) : null}
        {state.formError ? (
          <p className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {text.formError}
          </p>
        ) : null}
        {Object.keys(state.fieldErrors).length > 0 ? (
          <p className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {text.validationError}
          </p>
        ) : null}

        <Card className="space-y-5">
          <h2 className="text-xl font-semibold text-foreground">{text.identity}</h2>
          <label className="block space-y-2 text-sm font-semibold text-foreground">
            <span>{text.commercialName}</span>
            <input
              className={fieldClass(hasError("commercialName"))}
              defaultValue={settings.commercialName}
              maxLength={120}
              name="commercialName"
              onChange={(event) => setCommercialName(event.target.value)}
            />
          </label>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["primaryColor", text.primaryColor, settings.primaryColor, setPrimaryColor],
              ["strongColor", text.strongColor, settings.strongColor, setStrongColor],
              ["softColor", text.softColor, settings.softColor, setSoftColor],
            ].map(([name, label, value, update]) => (
              <label className="block space-y-2 text-sm font-semibold text-foreground" key={name as string}>
                <span>{label as string}</span>
                <input
                  className={fieldClass(hasError("colors"))}
                  defaultValue={value as string}
                  maxLength={7}
                  name={name as string}
                  onChange={(event) => (update as (next: string) => void)(event.target.value)}
                  placeholder="#0F3B2E"
                />
              </label>
            ))}
          </div>
          <p className="text-xs leading-5 text-muted">{text.colorsHelp}</p>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2 text-sm font-semibold text-foreground">
              <span>{text.logo}</span>
              <input accept="image/jpeg,image/png,image/webp" className={fieldClass(hasError("logo"))} name="logo" onChange={(event) => imagePreview(event, setLogoPreview)} type="file" />
              <span className="block text-xs font-normal text-muted">{text.fileHelp}</span>
            </label>
            <label className="block space-y-2 text-sm font-semibold text-foreground">
              <span>{text.logoAlt}</span>
              <input className={fieldClass()} defaultValue={settings.logoAlt} maxLength={180} name="logoAlt" />
            </label>
          </div>
          {settings.logoPath ? (
            <label className="flex min-h-11 items-center gap-2 text-sm text-muted">
              <input name="removeLogo" type="checkbox" value="true" /> {text.removeLogo}
            </label>
          ) : null}
        </Card>

        <Card className="space-y-5">
          <h2 className="text-xl font-semibold text-foreground">{text.portal}</h2>
          <label className="block space-y-2 text-sm font-semibold text-foreground">
            <span>{text.portalTitle}</span>
            <input className={fieldClass()} defaultValue={settings.portalTitle} maxLength={120} name="portalTitle" />
          </label>
          <label className="block space-y-2 text-sm font-semibold text-foreground">
            <span>{text.portalSubtitle}</span>
            <textarea className={`${fieldClass()} min-h-24 py-3`} defaultValue={settings.portalSubtitle} maxLength={320} name="portalSubtitle" />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2 text-sm font-semibold text-foreground">
              <span>{text.hero}</span>
              <input accept="image/jpeg,image/png,image/webp" className={fieldClass(hasError("hero"))} name="hero" onChange={(event) => imagePreview(event, setHeroPreview)} type="file" />
              <span className="block text-xs font-normal text-muted">{text.fileHelp}</span>
            </label>
            <label className="block space-y-2 text-sm font-semibold text-foreground">
              <span>{text.focalPosition}</span>
              <select className={fieldClass()} defaultValue={settings.portalHeroFocalPosition} name="portalHeroFocalPosition">
                {Object.entries(text.focalPositions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          {settings.portalHeroPath ? (
            <label className="flex min-h-11 items-center gap-2 text-sm text-muted">
              <input name="removeHero" type="checkbox" value="true" /> {text.removeHero}
            </label>
          ) : null}
        </Card>

        <Card className="space-y-5">
          <h2 className="text-xl font-semibold text-foreground">{text.contact}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2 text-sm font-semibold text-foreground"><span>{text.supportEmail}</span><input className={fieldClass(hasError("supportEmail"))} defaultValue={settings.supportEmail} name="supportEmail" type="email" /></label>
            <label className="block space-y-2 text-sm font-semibold text-foreground"><span>{text.supportPhone}</span><input className={fieldClass(hasError("supportPhone"))} defaultValue={settings.supportPhone} name="supportPhone" /></label>
            <label className="block space-y-2 text-sm font-semibold text-foreground"><span>{text.supportWhatsapp}</span><input className={fieldClass(hasError("supportWhatsapp"))} defaultValue={settings.supportWhatsapp} name="supportWhatsapp" /></label>
            <label className="block space-y-2 text-sm font-semibold text-foreground"><span>{text.website}</span><input className={fieldClass(hasError("websiteUrl"))} defaultValue={settings.websiteUrl} name="websiteUrl" type="url" /></label>
          </div>
          <label className="block space-y-2 text-sm font-semibold text-foreground"><span>{text.address}</span><textarea className={`${fieldClass()} min-h-20 py-3`} defaultValue={settings.businessAddress} maxLength={320} name="businessAddress" /></label>
        </Card>

        <Card className="space-y-5">
          <h2 className="text-xl font-semibold text-foreground">{text.promotion}</h2>
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-foreground"><input defaultChecked={settings.promoEnabled} name="promoEnabled" type="checkbox" value="true" /> {text.promoEnabled}</label>
          <label className="block space-y-2 text-sm font-semibold text-foreground"><span>{text.promoTitle}</span><input className={fieldClass(hasError("promoTitle"))} defaultValue={settings.promoTitle} maxLength={120} name="promoTitle" /></label>
          <label className="block space-y-2 text-sm font-semibold text-foreground"><span>{text.promoBody}</span><textarea className={`${fieldClass()} min-h-24 py-3`} defaultValue={settings.promoBody} maxLength={500} name="promoBody" /></label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2 text-sm font-semibold text-foreground"><span>{text.promoCtaLabel}</span><input className={fieldClass()} defaultValue={settings.promoCtaLabel} maxLength={80} name="promoCtaLabel" /></label>
            <label className="block space-y-2 text-sm font-semibold text-foreground"><span>{text.promoCtaHref}</span><input className={fieldClass(hasError("promoCtaHref"))} defaultValue={settings.promoCtaHref} name="promoCtaHref" type="url" /></label>
          </div>
          <label className="block space-y-2 text-sm font-semibold text-foreground"><span>{text.promoImage}</span><input accept="image/jpeg,image/png,image/webp" className={fieldClass(hasError("promoImage"))} name="promoImage" type="file" /><span className="block text-xs font-normal text-muted">{text.fileHelp}</span></label>
          {settings.promoImagePath ? <label className="flex min-h-11 items-center gap-2 text-sm text-muted"><input name="removePromoImage" type="checkbox" value="true" /> {text.removePromoImage}</label> : null}
        </Card>

        <Button className="w-full sm:w-auto sm:min-w-48" disabled={isPending} type="submit">{isPending ? text.saving : text.save}</Button>
      </div>

      <aside className="xl:sticky xl:top-6 xl:self-start" style={previewStyle}>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted">{text.preview}</p>
        <div className="overflow-hidden rounded-[1.5rem] border border-primary/15 bg-white shadow-luxury">
          <div className="flex min-h-16 items-center gap-3 border-b border-border px-4">
            <div className="flex h-10 w-16 items-center justify-center overflow-hidden rounded-logo bg-primary-soft text-primary">
              {logoPreview ? <img alt="" className="h-full w-full object-contain p-1" src={logoPreview} /> : <span className="text-sm font-bold">{(commercialName || settings.organizationName).slice(0, 2).toUpperCase()}</span>}
            </div>
            <p className="min-w-0 truncate font-semibold text-foreground">{commercialName || settings.organizationName}</p>
          </div>
          <div className="relative aspect-[16/10] bg-primary-soft">
            {heroPreview ? <img alt="" className="absolute inset-0 h-full w-full object-cover" src={heroPreview} /> : null}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary/75 to-transparent p-5 pt-12">
              <span className="inline-flex min-h-10 items-center rounded-control bg-primary px-4 text-sm font-semibold text-white">{commercialName || settings.organizationName}</span>
            </div>
          </div>
        </div>
      </aside>
    </form>
  );
}
