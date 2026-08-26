import { BillingStatusBadge } from "@/components/billing/BillingStatusBadge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { CustomerBillingOverview } from "@/features/billing/types";
import { Link } from "@/i18n/navigation";
import { formatCurrency } from "@/lib/number-format";

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value));
}

export function CustomerBillingSection({ customerId, locale, overview, text }: {
  customerId: string;
  locale: string;
  overview: CustomerBillingOverview;
  text: Record<string, string>;
}) {
  return (
    <section className="space-y-4" aria-labelledby="customer-billing">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">{text.eyebrow}</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground" id="customer-billing">{text.title}</h2><p className="mt-1 text-sm text-muted">{text.description}</p></div>
        {overview.eligibleOrderCount > 0 ? <Link href={`/app/billing/new?customerId=${customerId}`} locale={locale}><Button>{text.create}</Button></Link> : null}
      </div>
      {overview.summaries.length > 0 ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{overview.summaries.flatMap((summary) => [
        [text.count, String(summary.invoiceCount)],
        [text.issued, formatCurrency(summary.issuedTotal, summary.currency, locale)],
        [text.paid, formatCurrency(summary.paidTotal, summary.currency, locale)],
        [text.outstanding, formatCurrency(summary.outstanding, summary.currency, locale)],
      ].map(([label, value]) => <Card className="bg-white p-4 sm:p-4" key={`${summary.currency}-${label}`}><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</p><p className="mt-2 text-xl font-semibold tabular-nums text-primary">{value}</p></Card>))}</div> : null}
      {overview.recentInvoices.length === 0 ? <Card className="border-dashed bg-[#fafbfa] text-center text-sm text-muted">{text.empty}</Card> : <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-white shadow-card">{overview.recentInvoices.map((invoice) => <article className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center" key={invoice.id}><div><Link className="font-semibold text-primary hover:underline" href={`/app/billing/${invoice.id}`} locale={locale}>{invoice.invoiceNumber ?? text.draft}</Link><p className="mt-1 text-xs text-muted">{formatDate(invoice.issueDate, locale)} · {invoice.orderNumbers.join(", ")}</p></div><div className="sm:text-right"><p className="font-semibold tabular-nums">{formatCurrency(invoice.total, invoice.currency, locale)}</p><p className="text-xs text-muted">{text.outstanding}: {formatCurrency(invoice.outstanding, invoice.currency, locale)}</p></div><BillingStatusBadge label={text[`status_${invoice.paymentStatus}`]} status={invoice.paymentStatus} /></article>)}</div>}
      {overview.eligibleOrderCount === 0 ? <p className="text-xs text-muted">{text.noEligible}</p> : null}
    </section>
  );
}
