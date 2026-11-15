import { ticketUnicoMessages } from "@/features/billing/ticket-unico";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CustomerCopy } from "@/components/printing/OrderPrintDocument";
import { PrintButton } from "@/components/printing/PrintButton";
import { formatCurrency } from "@/lib/number-format";
import { formatOrganizationDateTime } from "@/lib/organization-timezone";
import { issuePosBillingPaymentDocument } from "@/features/billing/server/payment-link-actions";
import { paymentLinkMessages } from "@/features/billing/payment-link-messages";
import type { PosBillingDocuments } from "@/features/billing/payment-link";
import type { PrintOrderContext } from "@/features/printing/types";
import type { CustomerCopyFormat } from "@/features/printer-settings/document-preferences";

export async function PosBillingCustomerCopy({ context, data, locale, format, result }: {
  context: PrintOrderContext; data: PosBillingDocuments; locale: string; format: CustomerCopyFormat; result?: string;
}) {
  const t = await getTranslations({ locale, namespace: "common.billing.fiscalTicket" });
  const print = await getTranslations({ locale, namespace: "common.print" });
  const m = paymentLinkMessages(locale);
  const href = `/app/orders/${context.order.id}/print/customer-copy?format=${format}`;
  // An unreadable fiscal history is not evidence that no invoice exists.
  // Do not render the printable customer document (including browser print).
  // Recovery is a GET of the same read-only route; never an issuer or POS retry.
  if (data.state === "unavailable") return <section role="alert" className="rounded-control border border-amber-300 p-4">
    <p>{t("unavailable")}</p>
    <a href={`/${locale}${href}`}>{m.recovery}</a>
    <Link href={`/app/orders/${context.order.id}`} locale={locale}>{print("actions.back")}</Link>
  </section>;
  const documents = data.documents;
  const snapshot = documents.find(d => d.snapshot?.order_id === context.order.id)?.snapshot;
  const documented = new Set(documents.flatMap(d => d.paymentIds ?? (d.paymentId ? [d.paymentId] : [])));
  const refunded = new Set(context.payments.filter(p => p.status === "refunded").map(p => p.refundedFromPaymentId));
  const pending = context.payments.filter(p => p.status === "confirmed" && p.channel === "pos" && !documented.has(p.id) && !refunded.has(p.id));
  const money = (value: number) => formatCurrency(value, context.order.currency, locale);
  const fiscalDetails = documents.length ? <section className="print-ticket-notes" aria-label={m.title}>
    <h3>{m.title}</h3>
    {documents.map(d => <div key={d.id}>
      {d.issuer ? <p>{d.issuer.name} · {d.issuer.taxId} · {d.issuer.address}</p> : null}
      <p>{d.type === "simplified" ? ticketUnicoMessages(locale).fiscal : ""} · {d.series}</p>
      <p><strong>{d.number}</strong> · {formatOrganizationDateTime(d.issuedAt, locale, context.timezone)}</p>
      <p>{t("documented")}: {money(d.total)} · {t("base")}: {money(d.base)} · IGIC {d.taxRates?.map(rate => `${rate}%`).join(" / ")}: {money(d.tax)}</p>
    </div>)}
    <p>{t("noSecondPayment")}</p>
  </section> : undefined;
  return <div className={`order-print-document order-print-ticket order-print-customer-copy order-print-customer-${format}${format === "a4" ? "" : " order-print-customer-thermal"}`}>
    <div className="print-preview-toolbar print:hidden">
      <Link href={`/app/orders/${context.order.id}`} locale={locale}>{print("actions.back")}</Link>
      <PrintButton label={print("actions.print")} />
      <nav aria-label={print("customerCopy.formatLabel")}>
        {(["a4", "58mm", "80mm"] as const).map(f => <Link key={f} locale={locale} prefetch={false} aria-current={format === f ? "page" : undefined} href={`/app/orders/${context.order.id}/print/customer-copy?format=${f}`}>{print(`customerCopy.formatOptions.${f}`)} </Link>)}
      </nav>
      {result === "uncertain" ? <p role="alert">{t("uncertain")}</p> : null}
      {result === "confirmation" ? <p role="alert">{t("confirmationRequired")}</p> : null}
      <a href={`/${locale}${href}`}>{m.recovery}</a>
      {data.state === "ready" && data.enabled && !data.automatic && pending.length ? <section>
        <h2>{m.pending}</h2><p>{t("localOnly")}</p><p>{m.review}</p>
        {pending.map(p => <form key={p.id} action={issuePosBillingPaymentDocument.bind(null, locale, context.order.id)} className="my-4 grid gap-3">
          <input name="paymentId" type="hidden" value={p.id} />
          <p>{formatOrganizationDateTime(p.paidAt, locale, context.timezone)} · {money(p.amount)}</p>
          <label>{m.event}<select name="event" defaultValue="" required>
            <option value="" disabled>{m.event}</option><option value="advance">{m.advance}</option><option value="final">{m.final}</option>
          </select></label>
          <label>{t("recipient")}<select name="recipient" defaultValue="" required>
            <option value="" disabled>{t("chooseRecipient")}</option>
            <option value="consumer">{t("consumer")}</option><option value="consumer_identified">{t("identified")}</option><option value="business">{t("business")}</option>
          </select></label>
          <label>{m.performed}<input type="date" name="servicePerformedOn" /></label>
          <label><input type="checkbox" name="confirmed" required /> {m.confirmation}</label>
          <label><input type="checkbox" name="laundryScope" required /> {t("scopeConfirmation")}</label>
          <button type="submit">{t("issue")}</button>
        </form>)}
      </section> : null}
    </div>
    {await CustomerCopy({ header: context, orderNumber: snapshot?.order_number ?? context.order.orderNumber,
      customerName: snapshot?.customer_name ?? context.order.customerName,
      createdAt: snapshot?.created_at ?? context.order.createdAt, dueAt: snapshot ? snapshot.due_at : context.order.dueAt,
      customerNotes: snapshot ? snapshot.customer_notes : context.order.customerNotes,
      items: snapshot?.items ?? context.items, currency: snapshot?.currency ?? context.order.currency,
      subtotal: snapshot?.subtotal ?? context.order.subtotal, discountAmount: snapshot?.discount ?? context.order.discountAmount,
      total: snapshot?.total ?? context.order.total, summaryTitle: documents.length ? ticketUnicoMessages(locale).financial : undefined, totalPaid: context.paymentSummary.totalPaid,
      balanceDue: context.paymentSummary.balanceDue, locale, timezone: context.timezone, fiscalDetails })}
  </div>;
}
