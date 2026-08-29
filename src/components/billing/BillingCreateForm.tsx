import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { createBillingDraftAction } from "@/features/billing/server/actions";
import type { BillingSettings, EligibleBillingOrder } from "@/features/billing/types";
import { formatCurrency } from "@/lib/number-format";
import { taxRateInputValue } from "@/features/billing/tax-rate";

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value));
}

export function BillingCreateForm({ locale, orders, selectedOrderId, settings, text }: {
  locale: string;
  orders: EligibleBillingOrder[];
  selectedOrderId?: string;
  settings: BillingSettings;
  text: Record<string, string>;
}) {
  const groups = new Map<string, EligibleBillingOrder[]>();
  for (const order of orders) {
    const key = `${order.customerId}:${order.currency}`;
    groups.set(key, [...(groups.get(key) ?? []), order]);
  }

  if (groups.size === 0) {
    return <Card className="border-dashed bg-[#fafbfa] text-center text-sm text-muted">{text.empty}</Card>;
  }

  return (
    <div className="space-y-5">
      {[...groups.values()].map((group) => {
        const first = group[0];
        if (!first) return null;
        return (
          <form action={createBillingDraftAction.bind(null, locale, first.customerId)} key={`${first.customerId}:${first.currency}`}>
            <Card className="bg-white">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-secondary">{first.currency}</p>
                  <h2 className="mt-1 text-xl font-semibold text-primary">{first.customerName}</h2>
                  {!first.customerActive ? <p className="mt-1 text-sm font-semibold text-amber-800">{text.inactiveNote}</p> : null}
                </div>
                <span className="rounded-full border border-border bg-[#f7f9f7] px-3 py-1 text-xs font-semibold text-muted">{text.available.replace("{count}", String(group.length))}</span>
              </div>
              <div className="mt-5 divide-y divide-border overflow-hidden rounded-control border border-border">
                {group.map((order) => (
                  <label className="grid cursor-pointer gap-3 bg-white p-4 hover:bg-primary-soft/50 sm:grid-cols-[auto_1fr_auto] sm:items-center" key={order.id}>
                    <input className="h-5 w-5 accent-primary" defaultChecked={order.id === selectedOrderId} name="orderId" type="checkbox" value={order.id} />
                    <span><strong className="text-primary">{order.orderNumber}</strong><span className="mt-1 block text-xs text-muted">{formatDate(order.createdAt, locale)}</span></span>
                    <strong className="text-right text-primary">{formatCurrency(order.total, order.currency, locale)}</strong>
                  </label>
                ))}
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-[10rem_10rem_1fr_auto] lg:items-end">
                <label className="space-y-2 text-sm font-semibold text-primary"><span>{text.series}</span><input className="min-h-11 w-full rounded-control border border-border px-3" defaultValue={settings.defaultSeries} name="series" required /></label>
                <label className="space-y-2 text-sm font-semibold text-primary"><span>{text.taxRate}</span><input className="min-h-11 w-full rounded-control border border-border px-3" defaultValue={taxRateInputValue(settings.defaultTaxRate)} inputMode="decimal" max="100" min="0" name="taxRate" required step="0.01" type="number" /></label>
                <label className="space-y-2 text-sm font-semibold text-primary"><span>{text.notes}</span><input className="min-h-11 w-full rounded-control border border-border px-3" name="notes" /></label>
                <Button type="submit">{text.create}</Button>
              </div>
            </Card>
          </form>
        );
      })}
    </div>
  );
}
