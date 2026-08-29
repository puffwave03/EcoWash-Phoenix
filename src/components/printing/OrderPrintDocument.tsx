import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { CSSProperties } from "react";
import { PrintButton } from "@/components/printing/PrintButton";
import { buildPrintLabels } from "@/features/printing/labels";
import type { PrintOrderContext } from "@/features/printing/types";
import type { PrinterProfile } from "@/features/printer-settings/types";
import type { PaymentMethod } from "@/features/payments/types";
import { Link } from "@/i18n/navigation";
import { formatCurrency, formatQuantity } from "@/lib/number-format";
import { ScannableQrCode } from "@/components/barcode/ScannableQrCode";
import { createOrderCode } from "@/features/barcode/payload";

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

async function Receipt({ context, locale, profile }: { context: PrintOrderContext; locale: string; profile: PrinterProfile | null }) {
  const t = await getTranslations({ locale, namespace: "common.print" });
  const methods = paymentMethodTotals(context);
  return (
    <article className={`print-sheet print-receipt-sheet ${profile?.paperFormat === "receipt_58mm" ? "print-receipt-sheet-58mm" : profile?.paperFormat === "browser_pdf" ? "print-receipt-sheet-pdf" : "print-receipt-sheet-80mm"}`}>
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
  const codeT = await getTranslations({ locale, namespace: "common.barcode.print" });
  const logistics = [["pickup", context.logistics.pickup], ["delivery", context.logistics.delivery]] as const;
  return (
    <article className="print-sheet print-ticket-sheet">
      <BrandHeader compact context={context} />
      <section className="print-ticket-code-block">
        <div className="print-ticket-number"><p>{t("ticket.internalTicket")}</p><h2>{context.order.orderNumber}</h2></div>
        {context.barcodeEnabled ? <div className="print-ticket-qr"><ScannableQrCode ariaLabel={codeT("orderAria")} payload={createOrderCode(context.order.id)} /><p>{codeT("scanOrder")}</p></div> : null}
      </section>
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

async function Labels({ context, locale, profile }: { context: PrintOrderContext; locale: string; profile: PrinterProfile | null }) {
  const t = await getTranslations({ locale, namespace: "common.print" });
  const codeT = await getTranslations({ locale, namespace: "common.barcode.print" });
  const sourceLabels = buildPrintLabels(context);
  const copies = profile?.paperFormat === "label_custom" ? profile.labelCopies ?? 1 : 1;
  const labels = Array.from({ length: copies }, (_, copyIndex) => sourceLabels.map((label) => ({ copyIndex, label }))).flat();
  const landscape = profile?.labelOrientation === "landscape";
  const labelWidth = profile?.labelWidthMm ?? 50;
  const labelHeight = profile?.labelHeightMm ?? 30;
  const customStyle = profile?.paperFormat === "label_custom" ? {
    "--print-label-gap": `${profile.labelGapMm ?? 3}mm`,
    "--print-label-height": `${landscape ? labelWidth : labelHeight}mm`,
    "--print-label-margin": `${profile.labelMarginMm ?? 2}mm`,
    "--print-label-width": `${landscape ? labelHeight : labelWidth}mm`,
  } as CSSProperties : undefined;
  return <div className={`print-label-grid ${customStyle ? "print-label-grid-custom" : ""}`} style={customStyle}>{labels.map(({ copyIndex, label }) => <article className="print-label" key={`${copyIndex}-${label.codePayload}`}><div className="print-label-position">{label.index}/{label.total}</div><p className="print-label-org">{context.branding.brand.name ?? context.organizationName}{label.locationName ? ` · ${label.locationName}` : ""}</p><h2>{label.orderNumber}</h2><h3>{label.customerName}</h3><p className="print-label-service">{label.serviceName}{label.unitLabel ? ` · ${label.unitLabel}` : ""}</p>{label.dueAt ? <p>{t("fields.expectedReady")}: <strong>{formatDate(label.dueAt, locale, context.timezone)}</strong></p> : null}{context.barcodeEnabled ? <div className="print-label-code"><ScannableQrCode ariaLabel={codeT("labelAria")} className="print-label-qr" payload={label.codePayload} /></div> : null}</article>)}</div>;
}

export async function OrderPrintDocument({ context, locale, mode }: { context: PrintOrderContext; locale: string; mode: OrderPrintMode }) {
  const t = await getTranslations({ locale, namespace: "common.print" });
  const purpose = mode === "labels" ? "label" : mode;
  const profile = context.printerProfiles[purpose] ?? null;
  const profileClass = mode === "receipt"
    ? profile?.paperFormat === "receipt_58mm" ? "order-print-receipt-58mm" : profile?.paperFormat === "browser_pdf" ? "order-print-receipt-pdf" : "order-print-receipt-80mm"
    : mode === "labels" && profile?.paperFormat === "label_custom" ? "order-print-labels-custom" : "";
  return (
    <div className={`order-print-document order-print-${mode} ${profileClass}`}>
      <div className="print-preview-toolbar print:hidden">
        <div className="print-preview-actions">
          <Link className="inline-flex min-h-11 items-center font-bold !text-primary" href={`/app/orders/${context.order.id}`} locale={locale}>← {t("actions.back")}</Link>
          <PrintButton label={t("actions.print")} />
        </div>
        <p className="print-profile-status">
          <strong>{profile ? `${t("profile.selected")}: ${profile.displayName}` : t("profile.browserFallback")}</strong>
          <span>{profile && profile.connectionMode !== "browser" ? t("profile.adapterFallback") : t("profile.browserOnly")}</span>
        </p>
      </div>
      {mode === "receipt" ? <Receipt context={context} locale={locale} profile={profile} /> : mode === "ticket" ? <Ticket context={context} locale={locale} /> : <Labels context={context} locale={locale} profile={profile} />}
    </div>
  );
}
