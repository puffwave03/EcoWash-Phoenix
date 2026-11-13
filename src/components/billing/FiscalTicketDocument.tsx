import { getTranslations } from "next-intl/server";
import { PrintInvoiceButton } from "@/components/billing/PrintInvoiceButton";
import type { BillingInvoiceDetail } from "@/features/billing/types";
import type { FiscalTicketFormat, FiscalTicketOrderSnapshot } from "@/features/billing/fiscal-ticket";
import { formatCurrency, formatQuantity } from "@/lib/number-format";
import { formatOrganizationDateTime } from "@/lib/organization-timezone";
import { formatTaxRate } from "@/features/billing/tax-rate";
import styles from "./FiscalTicketDocument.module.css";

export async function FiscalTicketDocument({ detail, snapshot, locale, timezone, format, printRequestedAction }: {
  detail: BillingInvoiceDetail; snapshot: FiscalTicketOrderSnapshot; locale: string;
  timezone: string; format: FiscalTicketFormat; printRequestedAction?: () => Promise<void>;
}) {
  const t = await getTranslations({ locale, namespace: "common.billing.fiscalTicket" });
  const { invoice, items } = detail;
  const money = (amount: number) => formatCurrency(amount, invoice.currency, locale);
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
