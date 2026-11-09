import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { CSSProperties } from "react";
import { PrintButton } from "@/components/printing/PrintButton";
import { buildPrintLabels } from "@/features/printing/labels";
import type { PrintOrderContext } from "@/features/printing/types";
import type { PrinterProfile } from "@/features/printer-settings/types";
import type { CustomerCopyFormat } from "@/features/printer-settings/document-preferences";
import type { PaymentMethod } from "@/features/payments/types";
import { Link } from "@/i18n/navigation";
import { formatCurrency, formatQuantity } from "@/lib/number-format";
import { ScannableQrCode } from "@/components/barcode/ScannableQrCode";
import { createOrderCode } from "@/features/barcode/payload";
import { formatOrganizationDateTime } from "@/lib/organization-timezone";

export type OrderPrintMode = "labels" | "receipt" | "ticket" | "customer-copy";
export type { CustomerCopyFormat } from "@/features/printer-settings/document-preferences";

function formatDate(value: string | null, locale: string, timezone: string, includeTime = false) {
  if (!value) return "—";
  return formatOrganizationDateTime(value, locale, timezone, {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
  });
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

function BrandHeader({ context, compact = false }: { context: Pick<PrintOrderContext, "branding" | "organizationName" | "locationName">; compact?: boolean }) {
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

async function Ticket({ context, locale, thermal = false }: { context: PrintOrderContext; locale: string; thermal?: boolean }) {
  const t = await getTranslations({ locale, namespace: "common.print" });
  const quickDropT = await getTranslations({ locale, namespace: "common.quickDrop" });
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
        <div><dt>{t("fields.paymentStatus")}</dt><dd>{context.quickDropFinancialState === "unpriced" ? quickDropT("unpriced") : t(`paymentStatuses.${context.paymentSummary.paymentStatus}`)}</dd></div>
      </dl>
      <table className="print-items-table print-ticket-items"><thead><tr><th>{t("fields.service")}</th><th>{t("fields.quantity")}</th><th>{t("fields.unit")}</th><th>{t("fields.itemNotes")}</th></tr></thead><tbody>{context.items.map((item) => <tr key={item.id}><td>{item.description}</td><td data-label={thermal ? t("fields.quantity") : undefined}>{formatQuantity(item.quantity, locale)}</td><td data-label={thermal ? t("fields.unit") : undefined}>{t(`units.${item.unitType}`)}</td><td data-label={thermal ? t("fields.itemNotes") : undefined}>{item.notes || "—"}</td></tr>)}</tbody></table>
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

// Customer output accepts only an explicit allowlist, never the full order or item.
async function CustomerCopy({ header, orderNumber, customerName, createdAt, dueAt, customerNotes, items, currency, subtotal, discountAmount, total, totalPaid, balanceDue, locale, timezone }: {
  header: Pick<PrintOrderContext, "branding" | "organizationName" | "locationName">;
  orderNumber: string; customerName: string; createdAt: string; dueAt: string | null;
  customerNotes: string | null; locale: string; timezone: string;
  currency: string; subtotal: number; discountAmount: number; total: number; totalPaid: number; balanceDue: number;
  items: Array<Pick<PrintOrderContext["items"][number], "id" | "description" | "quantity" | "unitType" | "unitPrice" | "lineTotal">>;
}) {
  const t = await getTranslations({ locale, namespace: "common.print" });
  return (
    <article className="print-sheet print-ticket-sheet">
      <BrandHeader compact context={header} />
      <section className="print-ticket-code-block">
        <div className="print-ticket-number"><p>{t("customerCopy.title")}</p><h2>{orderNumber}</h2></div>
      </section>
      <dl className="print-ticket-grid">
        <div><dt>{t("fields.customer")}</dt><dd>{customerName}</dd></div>
        <div><dt>{t("fields.created")}</dt><dd>{formatDate(createdAt, locale, timezone, true)}</dd></div>
        <div><dt>{t("fields.expectedReady")}</dt><dd>{formatDate(dueAt, locale, timezone, true)}</dd></div>
      </dl>
      <table className="print-items-table print-ticket-items">
        <thead><tr><th scope="col">{t("fields.service")}</th><th scope="col">{t("fields.quantity")}</th><th scope="col">{t("fields.unit")}</th><th scope="col">{t("customerCopy.unitPrice")}</th><th scope="col">{t("fields.lineTotal")}</th></tr></thead>
        <tbody>{items.map((item) => <tr key={item.id}><td>{item.description}</td><td data-label={t("fields.quantity")}>{formatQuantity(item.quantity, locale)}</td><td data-label={t("fields.unit")}>{t(`units.${item.unitType}`)}</td><td data-label={t("customerCopy.unitPrice")}>{formatCurrency(item.unitPrice, currency, locale)}</td><td data-label={t("fields.lineTotal")}>{formatCurrency(item.lineTotal, currency, locale)}</td></tr>)}</tbody>
      </table>
      <section>
        <h3>{t("customerCopy.currentSummary")}</h3>
        <dl className="print-totals">
          <div><dt>{t("fields.subtotal")}</dt><dd>{formatCurrency(subtotal, currency, locale)}</dd></div>
          <div><dt>{t("fields.discount")}</dt><dd>−{formatCurrency(discountAmount, currency, locale)}</dd></div>
          <div className="print-total-strong"><dt>{t("fields.total")}</dt><dd>{formatCurrency(total, currency, locale)}</dd></div>
          <div><dt>{t("fields.paid")}</dt><dd>{formatCurrency(totalPaid, currency, locale)}</dd></div>
          <div><dt>{t("fields.outstanding")}</dt><dd>{formatCurrency(balanceDue, currency, locale)}</dd></div>
        </dl>
      </section>
      {customerNotes ? <section className="print-ticket-notes"><h3>{t("customerCopy.notes")}</h3><p>{customerNotes}</p></section> : null}
      <footer><p className="print-legal-boundary">{t("customerCopy.notFiscal")}</p></footer>
    </article>
  );
}

export async function OrderPrintDocument({ context, customerCopyFormat = "a4", locale, mode }: { context: PrintOrderContext; customerCopyFormat?: CustomerCopyFormat; locale: string; mode: OrderPrintMode }) {
  const t = await getTranslations({ locale, namespace: "common.print" });
  const purpose = mode === "labels" ? "label" : mode === "customer-copy" ? "ticket" : mode;
  const selectedProfile = context.printerProfiles[purpose] ?? null;
  const profile = mode === "ticket" && selectedProfile && (
    selectedProfile.purpose !== "ticket" || !selectedProfile.enabled || !selectedProfile.isDefault
    || !["ticket_a4", "ticket_58mm", "ticket_80mm", "browser_pdf"].includes(selectedProfile.paperFormat)
  ) ? null : selectedProfile;
  const ticketThermal = mode === "ticket" && (profile?.paperFormat === "ticket_58mm" || profile?.paperFormat === "ticket_80mm");
  const profileClass = mode === "receipt"
    ? profile?.paperFormat === "receipt_58mm" ? "order-print-receipt-58mm" : profile?.paperFormat === "browser_pdf" ? "order-print-receipt-pdf" : "order-print-receipt-80mm"
    : mode === "labels" && profile?.paperFormat === "label_custom" ? "order-print-labels-custom"
      : ticketThermal ? `order-print-${profile.paperFormat.replace("_", "-")} order-print-ticket-thermal` : "";
  const customerCopyClass = mode === "customer-copy" ? `order-print-customer-copy order-print-customer-${customerCopyFormat}${customerCopyFormat === "a4" ? "" : " order-print-customer-thermal"}` : "";
  return (
    <div className={`order-print-document order-print-${mode === "customer-copy" ? "ticket" : mode} ${profileClass}${customerCopyClass ? ` ${customerCopyClass}` : ""}`}>
      <div className="print-preview-toolbar print:hidden">
        <div className="print-preview-actions">
          <Link className="inline-flex min-h-11 items-center font-bold !text-primary" href={`/app/orders/${context.order.id}`} locale={locale}>← {t("actions.back")}</Link>
          <PrintButton label={t("actions.print")} />
        </div>
        {mode === "customer-copy" ? (
          <nav aria-label={t("customerCopy.formatLabel")} className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold">{t("customerCopy.formatLabel")}</span>
            {(["a4", "58mm", "80mm"] as const).map((format) => (
              <Link
                aria-current={customerCopyFormat === format ? "page" : undefined}
                className={`inline-flex min-h-11 min-w-16 items-center justify-center rounded-control border px-3 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${customerCopyFormat === format ? "border-primary bg-primary !text-white" : "border-primary/20 bg-white !text-primary hover:bg-primary-soft"}`}
                href={`/app/orders/${context.order.id}/print/customer-copy?format=${format}`}
                key={format}
                locale={locale}
                prefetch={false}
              >
                {t(`customerCopy.formatOptions.${format}`)}
              </Link>
            ))}
          </nav>
        ) : null}
        <p className="print-profile-status">
          <strong>{mode === "customer-copy" ? t(`customerCopy.formats.${customerCopyFormat}`) : profile ? `${t("profile.selected")}: ${profile.displayName}` : t("profile.browserFallback")}</strong>
          <span>{mode === "customer-copy" ? t("customerCopy.paperHint") : profile && profile.connectionMode !== "browser" ? t("profile.adapterFallback") : t("profile.browserOnly")}</span>
        </p>
      </div>
      {mode === "customer-copy" ? <CustomerCopy
        header={{ branding: context.branding, organizationName: context.organizationName, locationName: context.locationName }}
        orderNumber={context.order.orderNumber} customerName={context.order.customerName}
        createdAt={context.order.createdAt} dueAt={context.order.dueAt} customerNotes={context.order.customerNotes}
        items={context.items.map(({ id, description, quantity, unitType, unitPrice, lineTotal }) => ({ id, description, quantity, unitType, unitPrice, lineTotal }))}
        currency={context.order.currency} subtotal={context.order.subtotal} discountAmount={context.order.discountAmount} total={context.order.total}
        totalPaid={context.paymentSummary.totalPaid} balanceDue={context.paymentSummary.balanceDue}
        locale={locale} timezone={context.timezone}
      /> : mode === "receipt" ? <Receipt context={context} locale={locale} profile={profile} /> : mode === "ticket" ? <Ticket context={context} locale={locale} thermal={ticketThermal} /> : <Labels context={context} locale={locale} profile={profile} />}
    </div>
  );
}
