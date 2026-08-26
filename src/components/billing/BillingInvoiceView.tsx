import { getTranslations } from "next-intl/server";
import { Button } from "@/components/Button";
import { BillingStatusBadge } from "@/components/billing/BillingStatusBadge";
import { PrintInvoiceButton } from "@/components/billing/PrintInvoiceButton";
import { Card } from "@/components/Card";
import {
  cancelBillingInvoiceAction,
  deleteBillingDraftAction,
  issueBillingInvoiceAction,
  updateBillingDraftAction,
} from "@/features/billing/server/actions";
import type { BillingInvoiceDetail } from "@/features/billing/types";
import { Link } from "@/i18n/navigation";
import { formatCurrency, formatQuantity } from "@/lib/number-format";
import { formatTaxRate, taxRateInputValue } from "@/features/billing/tax-rate";

function formatDate(value: string | null, locale: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value));
}

function address(parts: Array<string | null>) {
  return parts.filter(Boolean).join(", ");
}

export async function BillingInvoiceView({ detail, locale, printMode = false }: {
  detail: BillingInvoiceDetail;
  locale: string;
  printMode?: boolean;
}) {
  const t = await getTranslations({ locale, namespace: "common.billing" });
  const { invoice, items, payments } = detail;
  const statusLabel = t(`statuses.${invoice.paymentStatus}`);
  const taxRate = items[0]?.taxRate ?? 0;
  const issuerAddress = address([invoice.issuerAddressLine1, invoice.issuerAddressLine2, invoice.issuerPostalCode, invoice.issuerCity, invoice.issuerRegion, invoice.issuerCountryCode]);
  const customerAddress = address([invoice.customerAddressLine1, invoice.customerAddressLine2, invoice.customerPostalCode, invoice.customerCity, invoice.customerCountryCode]);

  return (
    <div className={printMode ? "invoice-print-document mx-auto max-w-5xl bg-white p-5 sm:p-10" : "space-y-6"}>
      {!printMode ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link className="text-sm font-semibold text-primary hover:underline" href="/app/billing" locale={locale}>← {t("detail.back")}</Link>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{invoice.invoiceNumber ?? t("draftNumber")}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <BillingStatusBadge label={statusLabel} status={invoice.paymentStatus} />
            <Link href={`/app/billing/${invoice.id}/print`} locale={locale}><Button variant="secondary">{t("actions.printView")}</Button></Link>
          </div>
        </div>
      ) : (
        <div className="mb-6 flex justify-end print:hidden"><PrintInvoiceButton label={t("actions.print")} /></div>
      )}

      <article className="overflow-hidden rounded-[1.25rem] border border-border bg-white shadow-card print:rounded-none print:border-0 print:shadow-none">
        <div className="h-1.5 bg-gradient-to-r from-primary via-secondary to-primary/20 print:bg-primary" />
        <div className="p-5 sm:p-8">
          <header className="grid gap-6 border-b border-border pb-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">{t("document.invoice")}</p>
              <h2 className="mt-2 text-3xl font-semibold text-primary">{invoice.invoiceNumber ?? t("draftNumber")}</h2>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-muted">{t("fields.issueDate")}</dt><dd className="font-semibold">{formatDate(invoice.issueDate, locale)}</dd></div>
                <div><dt className="text-muted">{t("fields.dueDate")}</dt><dd className="font-semibold">{formatDate(invoice.dueDate, locale)}</dd></div>
                <div><dt className="text-muted">{t("fields.series")}</dt><dd className="font-semibold">{invoice.series}</dd></div>
                <div><dt className="text-muted">{t("fields.status")}</dt><dd className="font-semibold">{statusLabel}</dd></div>
              </dl>
            </div>
            <div className="text-sm sm:text-right">
              <h3 className="text-lg font-semibold text-primary">{invoice.issuerLegalName || t("document.issuerPending")}</h3>
              {invoice.issuerTaxId ? <p className="mt-1">{t("fields.taxId")}: {invoice.issuerTaxId}</p> : null}
              <p className="mt-1 text-muted">{issuerAddress || t("document.addressPending")}</p>
              <p className="mt-1 text-muted">{[invoice.issuerEmail, invoice.issuerPhone].filter(Boolean).join(" · ")}</p>
            </div>
          </header>

          <section className="grid gap-5 border-b border-border py-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">{t("document.billTo")}</p>
              <h3 className="mt-2 text-lg font-semibold text-primary">{invoice.customerName}</h3>
              {invoice.customerTaxId ? <p className="mt-1 text-sm">{t("fields.taxId")}: {invoice.customerTaxId}</p> : null}
              <p className="mt-1 text-sm text-muted">{customerAddress || t("document.addressPending")}</p>
              {invoice.customerEmail ? <p className="mt-1 text-sm text-muted">{invoice.customerEmail}</p> : null}
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">{t("document.linkedOrders")}</p>
              <div className="mt-2 flex flex-wrap gap-2 sm:justify-end">
                {invoice.orderIds.map((orderId, index) => (
                  <Link className="rounded-full border border-primary/15 bg-primary-soft px-3 py-1 text-sm font-semibold text-primary" href={`/app/orders/${orderId}`} key={orderId} locale={locale}>{invoice.orderNumbers[index]}</Link>
                ))}
              </div>
            </div>
          </section>

          <div className="overflow-x-auto py-6">
            <table className="w-full min-w-[44rem] border-collapse text-sm">
              <thead><tr className="border-b border-border text-left text-xs uppercase tracking-[0.08em] text-muted"><th className="pb-3 pr-4">{t("items.description")}</th><th className="pb-3 text-right">{t("items.quantity")}</th><th className="pb-3 text-right">{t("items.unitPrice")}</th><th className="pb-3 text-right">{t("items.discount")}</th><th className="pb-3 text-right">{t("items.tax")}</th><th className="pb-3 text-right">{t("items.total")}</th></tr></thead>
              <tbody>{items.map((item) => <tr className="border-b border-border/70" key={item.id}><td className="py-3 pr-4 font-medium text-primary">{item.description}</td><td className="py-3 text-right tabular-nums">{formatQuantity(item.quantity, locale)} {t(`units.${item.unitType}`)}</td><td className="py-3 text-right tabular-nums">{formatCurrency(item.unitPrice, invoice.currency, locale)}</td><td className="py-3 text-right tabular-nums">{formatCurrency(item.discountAmount, invoice.currency, locale)}</td><td className="py-3 text-right tabular-nums">{item.taxRate}% · {formatCurrency(item.taxAmount, invoice.currency, locale)}</td><td className="py-3 text-right font-semibold tabular-nums">{formatCurrency(item.lineTotal, invoice.currency, locale)}</td></tr>)}</tbody>
            </table>
          </div>

          <section className="grid gap-6 border-t border-border pt-6 sm:grid-cols-[1fr_20rem]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">{t("fields.notes")}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">{invoice.notes || t("document.noNotes")}</p>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">{t("totals.subtotal")}</dt><dd className="font-semibold tabular-nums">{formatCurrency(invoice.subtotal, invoice.currency, locale)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">{t("totals.discount")}</dt><dd className="font-semibold tabular-nums">−{formatCurrency(invoice.discountTotal, invoice.currency, locale)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">{t("totals.taxable")}</dt><dd className="font-semibold tabular-nums">{formatCurrency(invoice.taxableBase, invoice.currency, locale)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">{t("totals.tax")} ({formatTaxRate(taxRate, locale)}%)</dt><dd className="font-semibold tabular-nums">{formatCurrency(invoice.taxTotal, invoice.currency, locale)}</dd></div>
              <div className="flex justify-between border-t border-primary/15 pt-3 text-base"><dt className="font-semibold text-primary">{t("totals.total")}</dt><dd className="text-xl font-semibold tabular-nums text-primary">{formatCurrency(invoice.total, invoice.currency, locale)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">{t("totals.paid")}</dt><dd className="font-semibold tabular-nums text-emerald-700">{formatCurrency(invoice.paidTotal, invoice.currency, locale)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">{t("totals.outstanding")}</dt><dd className="font-semibold tabular-nums text-amber-800">{formatCurrency(invoice.outstanding, invoice.currency, locale)}</dd></div>
            </dl>
          </section>
        </div>
      </article>

      {!printMode && invoice.documentStatus === "draft" ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
          <Card className="bg-white">
            <h2 className="text-xl font-semibold text-primary">{t("draftEdit.title")}</h2>
            <p className="mt-1 text-sm text-muted">{t("draftEdit.description")}</p>
            <form action={updateBillingDraftAction.bind(null, locale, invoice.id, invoice.customerId)} className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-semibold text-primary"><span>{t("fields.issueDate")}</span><input className="min-h-11 w-full rounded-control border border-border px-3" defaultValue={invoice.issueDate} name="issueDate" required type="date" /></label>
              <label className="space-y-2 text-sm font-semibold text-primary"><span>{t("fields.dueDate")}</span><input className="min-h-11 w-full rounded-control border border-border px-3" defaultValue={invoice.dueDate ?? ""} name="dueDate" type="date" /></label>
              <label className="space-y-2 text-sm font-semibold text-primary"><span>{t("fields.series")}</span><input className="min-h-11 w-full rounded-control border border-border px-3" defaultValue={invoice.series} name="series" required /></label>
              <label className="space-y-2 text-sm font-semibold text-primary"><span>{t("fields.taxRate")}</span><input className="min-h-11 w-full rounded-control border border-border px-3" defaultValue={taxRateInputValue(taxRate)} inputMode="decimal" max="100" min="0" name="taxRate" required step="0.01" type="number" /></label>
              <label className="space-y-2 text-sm font-semibold text-primary sm:col-span-2"><span>{t("fields.notes")}</span><textarea className="min-h-28 w-full rounded-control border border-border p-3" defaultValue={invoice.notes ?? ""} name="notes" /></label>
              <div className="sm:col-span-2"><Button type="submit" variant="secondary">{t("actions.saveDraft")}</Button></div>
            </form>
          </Card>
          <Card className="space-y-4 bg-white">
            <h2 className="text-xl font-semibold text-primary">{t("issue.title")}</h2>
            <p className="text-sm leading-6 text-muted">{t("issue.description")}</p>
            <form action={issueBillingInvoiceAction.bind(null, locale, invoice.id, invoice.customerId)}><Button className="w-full" type="submit">{t("actions.issue")}</Button></form>
            <form action={deleteBillingDraftAction.bind(null, locale, invoice.id, invoice.customerId)}><Button className="w-full" type="submit" variant="danger">{t("actions.deleteDraft")}</Button></form>
          </Card>
        </div>
      ) : null}

      {!printMode && invoice.documentStatus === "issued" ? (
        <Card className="border-red-100 bg-white">
          <h2 className="text-xl font-semibold text-primary">{t("cancel.title")}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">{t("cancel.description")}</p>
          <form action={cancelBillingInvoiceAction.bind(null, locale, invoice.id, invoice.customerId)} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input className="min-h-11 flex-1 rounded-control border border-border px-3 text-sm" name="reason" placeholder={t("cancel.reason")} required />
            <Button type="submit" variant="danger">{t("actions.cancel")}</Button>
          </form>
        </Card>
      ) : null}

      {!printMode && payments.length > 0 ? (
        <Card className="bg-white">
          <h2 className="text-xl font-semibold text-primary">{t("payments.title")}</h2>
          <div className="mt-4 divide-y divide-border">{payments.map((payment) => <div className="grid gap-2 py-3 text-sm sm:grid-cols-4" key={payment.id}><span>{formatDate(payment.paidAt, locale)}</span><span>{t(`paymentMethods.${payment.method}`)}</span><span>{t(`paymentRecords.${payment.status}`)}</span><strong className="sm:text-right">{payment.status === "refunded" ? "−" : ""}{formatCurrency(payment.amount, invoice.currency, locale)}</strong></div>)}</div>
        </Card>
      ) : null}
    </div>
  );
}
