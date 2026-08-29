import { Button } from "@/components/Button";
import { DisclosureSection } from "@/components/DisclosureSection";
import { saveBillingSettingsAction } from "@/features/billing/server/actions";
import type { BillingSettings } from "@/features/billing/types";
import { taxRateInputValue } from "@/features/billing/tax-rate";

const inputClass = "min-h-11 w-full rounded-control border border-border bg-white px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft";

export function BillingSettingsPanel({
  locale,
  settings,
  text,
}: {
  locale: string;
  settings: BillingSettings;
  text: Record<string, string>;
}) {
  const requiredLabels = {
    issuerAddressLine1: text.addressLine1,
    issuerCity: text.city,
    issuerCountryCode: text.countryCode,
    issuerLegalName: text.legalName,
    issuerPostalCode: text.postalCode,
    issuerTaxId: text.taxId,
  };
  const issuerSummary = [
    settings.issuerLegalName,
    settings.issuerTaxId,
    [
      settings.issuerAddressLine1,
      settings.issuerCity,
      settings.issuerPostalCode,
      settings.issuerCountryCode,
    ].filter(Boolean).join(", "),
  ].filter(Boolean).join(" · ");

  return (
    <DisclosureSection
      actionLabel={settings.isIssueReady ? text.edit : text.review}
      contentClassName="rounded-card border border-border bg-white p-4 shadow-card sm:p-6"
      defaultOpen={!settings.isIssueReady}
      id="issuer-settings"
      statusLabel={settings.isIssueReady ? text.ready : text.missing}
      statusTone={settings.isIssueReady ? "success" : "warning"}
      summary={settings.isIssueReady ? issuerSummary : `${settings.organizationName} · ${text.description}`}
      title={text.title}
    >
      {!settings.isIssueReady && settings.autofilledFields.length ? <p className="rounded-control bg-primary-soft px-3 py-2 text-sm leading-6 text-primary">{text.autofillNotice}</p> : null}
      {!settings.isIssueReady && settings.missingRequiredFields.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.08em] text-amber-900">{text.missingFields}</span>
          {settings.missingRequiredFields.map((field) => <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900" key={field}>{requiredLabels[field]}</span>)}
        </div>
      ) : null}
      <form action={saveBillingSettingsAction.bind(null, locale)} className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["issuerLegalName", text.legalName, settings.issuerLegalName, true],
            ["issuerTaxId", text.taxId, settings.issuerTaxId, true],
            ["issuerAddressLine1", text.addressLine1, settings.issuerAddressLine1, true],
            ["issuerAddressLine2", text.addressLine2, settings.issuerAddressLine2, false],
            ["issuerCity", text.city, settings.issuerCity, true],
            ["issuerRegion", text.region, settings.issuerRegion, false],
            ["issuerPostalCode", text.postalCode, settings.issuerPostalCode, true],
            ["issuerCountryCode", text.countryCode, settings.issuerCountryCode, true],
            ["issuerEmail", text.email, settings.issuerEmail, false],
            ["issuerPhone", text.phone, settings.issuerPhone, false],
            ["defaultSeries", text.defaultSeries, settings.defaultSeries, true],
          ].map(([name, label, defaultValue, required]) => (
            <label className="space-y-2 text-sm font-semibold text-primary" key={String(name)}>
              <span>{String(label)}</span>
              <input className={inputClass} defaultValue={String(defaultValue)} name={String(name)} required={Boolean(required)} />
            </label>
          ))}
          <label className="space-y-2 text-sm font-semibold text-primary">
            <span>{text.defaultTaxRate}</span>
            <input className={inputClass} defaultValue={taxRateInputValue(settings.defaultTaxRate)} inputMode="decimal" max="100" min="0" name="defaultTaxRate" required step="0.01" type="number" />
          </label>
          <div className="flex items-end sm:col-span-2 lg:col-span-3">
            <Button type="submit">{text.save}</Button>
          </div>
      </form>
    </DisclosureSection>
  );
}
