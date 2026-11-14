import type { PrintOrderContext } from "@/features/printing/types";
import { getTranslations } from "next-intl/server";
import { PrintInvoiceButton } from "@/components/billing/PrintInvoiceButton";
import type { BillingInvoiceDetail } from "@/features/billing/types";
import type { FiscalTicketFormat, FiscalTicketOrderSnapshot } from "@/features/billing/fiscal-ticket";
import { formatCurrency, formatQuantity } from "@/lib/number-format";
import { formatOrganizationDateTime } from "@/lib/organization-timezone";
import { formatTaxRate } from "@/features/billing/tax-rate";
import styles from "./FiscalTicketDocument.module.css";

export async function FiscalTicketDocument({ detail, snapshot, locale, timezone, format, printRequestedAction, header, orderCreatedAt }: {
  detail: BillingInvoiceDetail; snapshot: FiscalTicketOrderSnapshot; locale: string;
  timezone: string; format: FiscalTicketFormat; printRequestedAction?: () => Promise<void>;
  header?: Pick<PrintOrderContext, "branding" | "organizationName" | "locationName">; orderCreatedAt?: string;
}) {
  const t = await getTranslations({ locale, namespace: "common.billing.fiscalTicket" });
  const { invoice, items } = detail;
  const money = (amount: number) => formatCurrency(amount, invoice.currency, locale);
  // Old snapshots retain the published layout and never acquire current notes.
  if (Object.hasOwn(snapshot, "customer_notes") && header) {
    const { CustomerCopy } = await import("@/components/printing/OrderPrintDocument");
    const fiscalDetails = <section className="print-ticket-notes">
      <h2>{t("documentTitle")} · {invoice.invoiceNumber}</h2>
      <p>{t("issued")}: {formatOrganizationDateTime(invoice.issuedAt ?? invoice.issueDate, locale, timezone)}</p>
      <p>{invoice.issuerLegalName} · {invoice.issuerTaxId}</p>
      <p>{[invoice.issuerAddressLine1, invoice.issuerAddressLine2, invoice.issuerCity, invoice.issuerPostalCode, invoice.issuerCountryCode].filter(Boolean).join(" · ")}</p>
      {invoice.customerName ? <p>{t("recipient")}: {invoice.customerName} · {invoice.customerTaxId} · {[invoice.customerAddressLine1, invoice.customerCity, invoice.customerPostalCode, invoice.customerCountryCode].filter(Boolean).join(" · ")}</p> : null}
      {items.map((item) => <p key={item.id}>{item.description} · {t("base")}: {money(item.taxableBase)} · IGIC {formatTaxRate(item.taxRate, locale)}%: {money(item.taxAmount)}</p>)}
      <dl className="print-totals"><div><dt>{t("base")}</dt><dd>{money(invoice.taxableBase)}</dd></div><div><dt>IGIC</dt><dd>{money(invoice.taxTotal)}</dd></div><div><dt>{t("documented")}</dt><dd>{money(invoice.total)}</dd></div></dl>
      <p>{t("noSecondPayment")}</p>
    </section>;
    return <div className={`order-print-document order-print-ticket order-print-customer-copy order-print-customer-${format}${format === "a4" ? "" : " order-print-customer-thermal"}`}>
      <div className="print-preview-toolbar print:hidden"><PrintInvoiceButton label={t("print")} printRequestedAction={printRequestedAction} /></div>
      {await CustomerCopy({ header, orderNumber: snapshot.order_number, customerName: invoice.customerName ?? t("consumer"),
        createdAt: orderCreatedAt ?? invoice.createdAt, dueAt: snapshot.due_at, customerNotes: snapshot.customer_notes ?? null,
        items: items.map(({ id, description, quantity, unitType, unitPrice, lineTotal }) => ({ id, description, quantity, unitType, unitPrice, lineTotal })),
        currency: invoice.currency, subtotal: invoice.subtotal, discountAmount: invoice.discountTotal, total: invoice.total,
        totalPaid: invoice.total, balanceDue: 0, locale, timezone, documentTitle: t("documentTitle"), summaryTitle: t("commercialAtIssue"), fiscalDetails })}
    </div>;
  }
  return <div className={`${styles.ticket} ${format === "a4" ? styles.a4 : format === "58mm" ? styles.roll58 : styles.roll80}`}>
    <div className={styles.controls}><PrintInvoiceButton label={t("print")} printRequestedAction={printRequestedAction} /></div>
    <article>
      <header>
        <h1>{invoice.issuerLegalName}</h1>
        <p>{invoice.issuerTaxId}</p>
        <p>{[invoice.issuerAddressLine1, invoice.issuerAddressLine2, invoice.issuerCity, invoice.issuerPostalCode, invoice.issuerCountryCode].filter(Boolean).join(" · ")}</p>
        <h2>{t("documentTitle")}</h2>
        <strong>{invoice.invoiceNumber}</strong>
        <p>{t("issued")}: {formatOrganizationDateTime(invoice.issuedAt ?? invoice.issueDate, locale, timezone)}</p>
        <p>{t("order")}: {snapshot.order_number}</p>
        {snapshot.due_at ? <p>{t("pickup")}: {formatOrganizationDateTime(snapshot.due_at, locale, timezone)}</p> : null}
      </header>
      {invoice.customerName ? <section><h2>{t("recipient")}</h2>
        <p>{invoice.customerName}</p><p>{invoice.customerTaxId}</p>
        <p>{[invoice.customerAddressLine1, invoice.customerCity, invoice.customerPostalCode, invoice.customerCountryCode].filter(Boolean).join(" · ")}</p>
      </section> : null}
      <section aria-label={t("services")}>
        {items.map((item) => <div className={styles.item} key={item.id}>
          <strong>{item.description}</strong>
          <p>{formatQuantity(item.quantity, locale)} × {money(item.unitPrice)} · {money(item.lineTotal)}</p>
          <p>{t("base")}: {money(item.taxableBase)} · IGIC {formatTaxRate(item.taxRate, locale)}%: {money(item.taxAmount)}</p>
        </div>)}
      </section>
      <dl>
        <div><dt>{t("base")}</dt><dd>{money(invoice.taxableBase)}</dd></div>
        <div><dt>IGIC</dt><dd>{money(invoice.taxTotal)}</dd></div>
        <div><dt>{t("documented")}</dt><dd>{money(invoice.total)}</dd></div>
      </dl>
      <section>
        <h2>{t("commercialAtIssue")}</h2>
        <dl>
          <div><dt>{t("commercialTotal")}</dt><dd>{money(invoice.total)}</dd></div>
          <div><dt>{t("paidAtIssue")}</dt><dd>{money(invoice.total)}</dd></div>
          <div><dt>{t("balanceAtIssue")}</dt><dd>{money(0)}</dd></div>
        </dl>
        <p>{t("noSecondPayment")}</p>
      </section>
    </article>
  </div>;
}
