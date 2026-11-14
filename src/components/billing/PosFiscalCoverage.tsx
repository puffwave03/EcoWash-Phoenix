import type { FiscalCoverage } from "@/features/billing/fiscal-coverage";
import { fiscalCoverageMessages } from "@/features/billing/fiscal-coverage-messages";
import { formatCurrency } from "@/lib/number-format";

// Separate from the customer ticket: never renders or generates a second document.
export function PosFiscalCoverage({ data, locale }: { data: FiscalCoverage; locale: string }) {
  const text = fiscalCoverageMessages(locale);
  return <section aria-label={text.title} className="space-y-3 rounded-control border border-border bg-white p-4">
    <h2 className="text-lg font-semibold text-primary">{text.title}</h2>
    <p className="text-sm text-muted">{text.disclaimer}</p>
    {data.state === "unavailable" ? <p role="alert">{text.unavailable}</p> : <ul className="divide-y divide-border">
      {data.payments.map(p => <li key={p.paymentId} className="space-y-1 py-3 text-sm">
        <p>{formatCurrency(p.amount, p.currency, locale)} · <strong>{text[p.status]}</strong></p>
        <a className="font-semibold text-primary underline" href={`/${locale}/app/orders/${p.orderId}`}>{p.paymentId}</a>
        {p.document ? <p>{p.document.number ?? "—"} · {p.document.issuedAt ? new Date(p.document.issuedAt).toLocaleString(locale, { timeZone: data.timezone }) : "—"}</p> : null}
        {p.evidence ? <p>{text.evidence}: {p.evidence.servicePerformedOn}</p> : null}
      </li>)}
    </ul>}
  </section>;
}
