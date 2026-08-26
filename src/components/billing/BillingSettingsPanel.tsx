import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
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
  return (
    <Card className="bg-white">
      <details open={!settings.isIssueReady}>
        <summary className="cursor-pointer list-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">{text.eyebrow}</p>
              <h2 className="mt-1 text-xl font-semibold text-primary">{text.title}</h2>
              <p className="mt-1 text-sm leading-6 text-muted">{text.description}</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${settings.isIssueReady ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
              {settings.isIssueReady ? text.ready : text.missing}
            </span>
          </div>
        </summary>
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
      </details>
    </Card>
  );
}
