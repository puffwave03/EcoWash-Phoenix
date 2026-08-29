import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { saveBillingCustomerFiscalAction } from "@/features/billing/server/actions";
import type { BillingCustomerContext, BillingCustomerFiscalField } from "@/features/billing/types";

const inputClass = "min-h-11 w-full rounded-control border border-border bg-white px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft";

export function BillingCustomerFiscalPanel({
  context,
  locale,
  orderId,
  text,
}: {
  context: BillingCustomerContext;
  locale: string;
  orderId: string;
  text: Record<string, string>;
}) {
  const labels: Record<BillingCustomerFiscalField, string> = {
    billingAddressLine1: text.addressLine1,
    billingCity: text.city,
    billingCountryCode: text.countryCode,
    billingPostalCode: text.postalCode,
    taxId: text.taxId,
  };

  if (context.isFiscalReady) {
    return (
      <Card className="border-emerald-200 bg-emerald-50">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[0.1em] text-emerald-700">{text.eyebrow}</p><h2 className="mt-1 text-lg font-semibold text-primary">{context.customerName}</h2></div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700">{text.ready}</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-amber-200 bg-amber-50/60">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-amber-800">{text.eyebrow}</p>
          <h2 className="mt-1 text-xl font-semibold text-primary">{context.customerName}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">{context.isWalkIn ? text.walkInDescription : text.description}</p>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">{text.missing}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {context.missingRequiredFields.map((field) => <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-amber-900" key={field}>{labels[field]}</span>)}
      </div>
      <form action={saveBillingCustomerFiscalAction.bind(null, locale, context.customerId, orderId)} className="mt-4 grid gap-4 border-t border-amber-200 pt-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        {context.missingRequiredFields.map((field) => (
          <label className="space-y-2 text-sm font-semibold text-primary" key={field}>
            <span>{labels[field]}</span>
            <input className={inputClass} maxLength={field === "billingAddressLine1" ? 180 : field === "billingCity" ? 100 : field === "billingPostalCode" ? 24 : field === "taxId" ? 80 : 2} name={field} required />
          </label>
        ))}
        <Button type="submit">{text.save}</Button>
      </form>
    </Card>
  );
}
