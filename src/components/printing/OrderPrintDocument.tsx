import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { PrintButton } from "@/components/printing/PrintButton";
import { buildPrintLabels } from "@/features/printing/labels";
import type { PrintOrderContext } from "@/features/printing/types";
import type { PaymentMethod } from "@/features/payments/types";
import { Link } from "@/i18n/navigation";
import { formatCurrency, formatQuantity } from "@/lib/number-format";

export type OrderPrintMode = "labels" | "receipt" | "ticket";

function formatDate(value: string | null, locale: string, timezone: string, includeTime = false) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
    timeZone: timezone,
  }).format(new Date(value));
}

function paymentMethodTotals(context: PrintOrderContext) {
  const totals = new Map<PaymentMethod, number>();
  for (const payment of context.payments) {
    if (payment.status !== "confirmed" && payment.status !== "refunded") continue;
    const direction = payment.status === "refunded" ? -1 : 1;
    totals.set(payment.method, (totals.get(payment.method) ?? 0) + direction * Number(payment.amount));
  }
  return Array.from(totals.entries()).filter(([, amount]) => amount !== 0);
}

function BrandHeader({ context, compact = false }: { context: PrintOrderContext; compact?: boolean }) {
  const name = context.branding.brand.name ?? context.organizationName;
  return (
    <header className={`print-brand-header ${compact ? "print-brand-header-compact" : ""}`}>
      {context.branding.brand.logoPath ? (
        <Image alt={context.branding.brand.logoAlt ?? name} className="print-brand-logo" height={64} src={context.branding.brand.logoPath} unoptimized width={160} />
      ) : null}
      <div>
        <h1>{name}</h1>
        {context.locationName ? <p>{context.locationName}</p> : null}
        {!compact ? <p>{[context.branding.support.address, context.branding.support.phone, context.branding.support.email].filter(Boolean).join(" · ")}</p> : null}
      </div>
    </header>
  );
}

async function Receipt({ context, locale }: { context: PrintOrderContext; locale: string }) {
  const t = await getTranslations({ locale, namespace: "common.print" });
  const methods = paymentMethodTotals(context);
  return (
    <article className="print-sheet print-receipt-sheet">
      <BrandHeader context={context} />
      <section className="print-title-block">
        <p className="print-document-kind">{t("receipt.operationalReceipt")}</p>
        <h2>{context.order.orderNumber}</h2>
        <p>{formatDate(context.order.createdAt, locale, context.timezone, true)}</p>
      </section>
      <dl className="print-key-values">
        <div><dt>{t("fields.customer")}</dt><dd>{context.order.customerName}</dd></div>
        {context.order.dueAt ? <div><dt>{t("fields.expectedReady")}</dt><dd>{formatDate(context.order.dueAt, locale, context.timezone, true)}</dd></div> : null}
      </dl>
      <table className="print-items-table">
        <thead><tr><th>{t("fields.service")}</th><th>{t("fields.quantity")}</th><th>{t("fields.price")}</th><th>{t("fields.lineTotal")}</th></tr></thead>
        <tbody>{context.items.map((item) => <tr key={item.id}><td>{item.description}</td><td>{formatQuantity(item.quantity, locale)} {t(`units.${item.unitType}`)}</td><td>{formatCurrency(item.unitPrice, context.order.currency, locale)}</td><td>{formatCurrency(item.lineTotal, context.order.currency, locale)}</td></tr>)}</tbody>
      </table>
      <dl className="print-totals">
        <div><dt>{t("fields.subtotal")}</dt><dd>{formatCurrency(context.order.subtotal, context.order.currency, locale)}</dd></div>
        <div><dt>{t("fields.discount")}</dt><dd>−{formatCurrency(context.order.discountAmount, context.order.currency, locale)}</dd></div>
        <div className="print-total-strong"><dt>{t("fields.total")}</dt><dd>{formatCurrency(context.order.total, context.order.currency, locale)}</dd></div>
        <div><dt>{t("fields.paid")}</dt><dd>{formatCurrency(context.paymentSummary.totalPaid, context.order.currency, locale)}</dd></div>
        <div><dt>{t("fields.outstanding")}</dt><dd>{formatCurrency(context.paymentSummary.balanceDue, context.order.currency, locale)}</dd></div>
      </dl>
      {methods.length ? <section className="print-payment-methods"><h3>{t("fields.paymentMethods")}</h3>{methods.map(([method, amount]) => <p key={method}>{t(`paymentMethods.${method}`)} <strong>{formatCurrency(amount, context.order.currency, locale)}</strong></p>)}</section> : null}
      {context.order.customerNotes ? <section className="print-notes"><h3>{t("fields.notes")}</h3><p>{context.order.customerNotes}</p></section> : null}
      <footer><p>{t("receipt.thanks")}</p><p className="print-legal-boundary">{t("receipt.notFiscal")}</p></footer>
    </article>
  );
}

async function Ticket({ context, locale }: { context: PrintOrderContext; locale: string }) {
  const t = await getTranslations({ locale, namespace: "common.print" });
  const logistics = [["pickup", context.logistics.pickup], ["delivery", context.logistics.delivery]] as const;
  return (
    <article className="print-sheet print-ticket-sheet">
      <BrandHeader compact context={context} />
      <section className="print-ticket-number"><p>{t("ticket.internalTicket")}</p><h2>{context.order.orderNumber}</h2></section>
      <dl className="print-ticket-grid">
        <div><dt>{t("fields.customer")}</dt><dd>{context.order.customerName}</dd></div>
        {context.customerPhone ? <div><dt>{t("fields.phone")}</dt><dd>{context.customerPhone}</dd></div> : null}
        <div><dt>{t("fields.created")}</dt><dd>{formatDate(context.order.createdAt, locale, context.timezone, true)}</dd></div>
        <div><dt>{t("fields.expectedReady")}</dt><dd>{formatDate(context.order.dueAt, locale, context.timezone, true)}</dd></div>
        {context.createdByName ? <div><dt>{t("fields.operator")}</dt><dd>{context.createdByName}</dd></div> : null}
        <div><dt>{t("fields.paymentStatus")}</dt><dd>{t(`paymentStatuses.${context.paymentSummary.paymentStatus}`)}</dd></div>
      </dl>
      <table className="print-items-table print-ticket-items"><thead><tr><th>{t("fields.service")}</th><th>{t("fields.quantity")}</th><th>{t("fields.unit")}</th><th>{t("fields.itemNotes")}</th></tr></thead><tbody>{context.items.map((item) => <tr key={item.id}><td>{item.description}</td><td>{formatQuantity(item.quantity, locale)}</td><td>{t(`units.${item.unitType}`)}</td><td>{item.notes || "—"}</td></tr>)}</tbody></table>
      {(context.order.customerNotes || context.order.internalNotes) ? <section className="print-ticket-notes"><h3>{t("fields.treatmentNotes")}</h3>{context.order.customerNotes ? <p>{context.order.customerNotes}</p> : null}{context.order.internalNotes ? <p>{context.order.internalNotes}</p> : null}</section> : null}
      {logistics.some(([, record]) => record) ? <section className="print-logistics"><h3>{t("fields.logistics")}</h3>{logistics.map(([kind, record]) => record ? <p key={kind}><strong>{t(`logistics.${kind}`)}</strong>: {t(`logistics.${record.status}`)}{record.scheduledAt ? ` · ${formatDate(record.scheduledAt, locale, context.timezone, true)}` : ""}</p> : null)}</section> : null}
    </article>
  );
}

async function Labels({ context, locale }: { context: PrintOrderContext; locale: string }) {
  const t = await getTranslations({ locale, namespace: "common.print" });
  const labels = buildPrintLabels(context);
  return <div className="print-label-grid">{labels.map((label) => <article className="print-label" key={`${label.index}-${label.serviceName}`}><div className="print-label-position">{label.index}/{label.total}</div><p className="print-label-org">{context.branding.brand.name ?? context.organizationName}{label.locationName ? ` · ${label.locationName}` : ""}</p><h2>{label.orderNumber}</h2><h3>{label.customerName}</h3><p className="print-label-service">{label.serviceName}{label.unitLabel ? ` · ${label.unitLabel}` : ""}</p>{label.dueAt ? <p>{t("fields.expectedReady")}: <strong>{formatDate(label.dueAt, locale, context.timezone)}</strong></p> : null}<div aria-label={t("labels.codeAreaAria")} className="print-code-area">{t("labels.codeArea")}</div></article>)}</div>;
}

export async function OrderPrintDocument({ context, locale, mode }: { context: PrintOrderContext; locale: string; mode: OrderPrintMode }) {
  const t = await getTranslations({ locale, namespace: "common.print" });
  return (
    <div className={`order-print-document order-print-${mode}`}>
      <div className="print-preview-actions print:hidden">
        <Link className="inline-flex min-h-11 items-center font-bold !text-primary" href={`/app/orders/${context.order.id}`} locale={locale}>← {t("actions.back")}</Link>
        <PrintButton label={t("actions.print")} />
      </div>
      {mode === "receipt" ? <Receipt context={context} locale={locale} /> : mode === "ticket" ? <Ticket context={context} locale={locale} /> : <Labels context={context} locale={locale} />}
    </div>
  );
}
