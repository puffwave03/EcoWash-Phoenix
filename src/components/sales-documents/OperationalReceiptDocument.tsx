import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { PrintButton } from "@/components/printing/PrintButton";
import type { OperationalReceipt } from "@/features/sales-documents/types";
import { Link } from "@/i18n/navigation";
import { formatCurrency, formatQuantity } from "@/lib/number-format";

export async function OperationalReceiptDocument({ locale, printRequestedAction, receipt }: {
  locale: string;
  printRequestedAction: () => Promise<void>;
  receipt: OperationalReceipt;
}) {
  const t = await getTranslations({ locale, namespace: "common.salesDocuments" });
  const { document, items, location, order, organization, payment } = receipt.snapshot;
  const methods = Object.entries(payment.methodTotals).filter(([, amount]) => Number(amount) > 0);

  return <div className="order-print-document order-print-receipt order-print-receipt-80mm">
    <div className="print-preview-toolbar operational-receipt-toolbar print:hidden">
      <div className="print-preview-actions operational-receipt-actions">
        <Link className="inline-flex min-h-11 items-center font-bold !text-primary" href="/app/accounting/documents" locale={locale}>← {t("back")}</Link>
        <PrintButton label={t("print")} printRequestedAction={printRequestedAction} />
      </div>
    </div>
    <article className="print-sheet print-receipt-sheet print-receipt-sheet-80mm">
      <header className="print-brand-header">
        {organization.logoUrl ? <Image alt={organization.logoAlt ?? organization.displayName} className="print-brand-logo" height={64} src={organization.logoUrl} unoptimized width={160} /> : null}
        <div><h1>{organization.displayName}</h1>{location?.name ? <p>{location.name}</p> : null}<p>{[organization.address, organization.phone, organization.email].filter(Boolean).join(" · ")}</p></div>
      </header>
      <section className="print-title-block">
        <p className="print-document-kind">{t("receipt")}</p>
        <h2>{document.receiptNumber}</h2>
        <p>{new Date(document.issuedAt).toLocaleString(locale)}</p>
      </section>
      <dl className="print-key-values">
        <div><dt>{t("customer")}</dt><dd>{receipt.snapshot.customer.displayName}</dd></div>
        <div><dt>{t("order")}</dt><dd>{order.orderNumber}</dd></div>
      </dl>
      <table className="print-items-table operational-receipt-items">
        <thead><tr><th>{t("descriptionCompact")}</th><th>{t("quantityCompact")}</th><th>{t("unitPriceCompact")}</th><th>{t("totalCompact")}</th></tr></thead>
        <tbody>{items.map((item) => <tr key={item.id}><td>{item.description}</td><td>{formatQuantity(item.quantity, locale)}</td><td>{formatCurrency(item.unitPrice, order.currency, locale)}</td><td>{formatCurrency(item.lineTotal, order.currency, locale)}</td></tr>)}</tbody>
      </table>
      <dl className="print-totals">
        <div><dt>{t("subtotal")}</dt><dd>{formatCurrency(order.subtotal, order.currency, locale)}</dd></div>
        <div><dt>{t("discount")}</dt><dd>−{formatCurrency(order.discountAmount, order.currency, locale)}</dd></div>
        <div className="print-total-strong"><dt>{t("total")}</dt><dd>{formatCurrency(order.total, order.currency, locale)}</dd></div>
        <div><dt>{t("paid")}</dt><dd>{formatCurrency(payment.paidAmount, order.currency, locale)}</dd></div>
        <div><dt>{t("outstanding")}</dt><dd>{formatCurrency(payment.outstandingAmount, order.currency, locale)}</dd></div>
      </dl>
      {methods.length ? <section className="print-payment-methods"><h3>{t("paymentMethods")}</h3>{methods.map(([method, amount]) => <p key={method}>{t("methods." + method)} <strong>{formatCurrency(Number(amount), order.currency, locale)}</strong></p>)}</section> : null}
      {order.customerNotes ? <section className="print-notes"><h3>{t("notes")}</h3><p>{order.customerNotes}</p></section> : null}
      <footer><p>{t("thanks")}</p><p className="print-legal-boundary">{t("notFiscal")}</p></footer>
    </article>
  </div>;
}
