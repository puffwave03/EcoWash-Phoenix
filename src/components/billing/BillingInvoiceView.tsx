import { getTranslations } from "next-intl/server";
import type { ReactElement } from "react";
import { Button } from "@/components/Button";
import { BillingStatusBadge } from "@/components/billing/BillingStatusBadge";
import { PrintInvoiceButton } from "@/components/billing/PrintInvoiceButton";
import { Card } from "@/components/Card";
import {
  cancelBillingInvoiceAction,
  deleteBillingDraftAction,
  issueBillingInvoiceAction,
  issueSimplifiedBillingInvoiceAction,
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

export async function BillingInvoiceView({ detail, locale, printRequestedAction, printMode = false, printCopy }: {
  detail: BillingInvoiceDetail;
  locale: string;
  printRequestedAction?: () => Promise<void>;
  printMode?: boolean;
  printCopy?: "customer" | "laundry";
}): Promise<ReactElement> {
  const t = await getTranslations({ locale, namespace: "common.billing" });
  const { invoice, items, payments } = detail;
  const statusLabel = t(`statuses.${invoice.paymentStatus}`);
  const taxRate = items[0]?.taxRate ?? 0;
  const issuerAddress = address([invoice.issuerAddressLine1, invoice.issuerAddressLine2, invoice.issuerPostalCode, invoice.issuerCity, invoice.issuerRegion, invoice.issuerCountryCode]);
  const customerAddress = address([invoice.customerAddressLine1, invoice.customerAddressLine2, invoice.customerPostalCode, invoice.customerCity, invoice.customerCountryCode]);

  // One persisted invoice, one print/history action, two presentation copies.
  // Never fetch, issue, allocate a number or alter a snapshot here. The ordinary
  // view/print path retains its original markup and behavior.
  const isSimplifiedCopy = printMode && invoice.fiscalDocumentType === "simplified" && invoice.documentStatus === "issued";
  if (isSimplifiedCopy && !printCopy) {
    const [customerCopy, laundryCopy] = await Promise.all([
      BillingInvoiceView({ detail, locale, printMode: true, printCopy: "customer" }),
      BillingInvoiceView({ detail, locale, printMode: true, printCopy: "laundry" }),
    ]);
    return <div className="invoice-print-document mx-auto max-w-5xl bg-white p-5 sm:p-10">
      <div className="mb-6 flex justify-end print:hidden"><PrintInvoiceButton label={t("actions.printTwoCopies")} printRequestedAction={printRequestedAction} /></div>
      {customerCopy}
      {laundryCopy}
    </div>;
  }
  const copyLabel = isSimplifiedCopy && printCopy ? t(`document.${printCopy}Copy`) : null;
  const showRecipient = !(invoice.fiscalDocumentType === "simplified") || Boolean((invoice.customerName ?? "").trim() || invoice.customerTaxId || customerAddress || invoice.customerEmail);
  const printHref = invoice.fiscalDocumentType === "simplified" && invoice.documentStatus === "issued" && invoice.orderIds.length === 1
    ? `/app/orders/${invoice.orderIds[0]}/print/receipt?document=fiscal`
    : `/app/billing/${invoice.id}/print`;

  return (
    <div className={copyLabel ? "billing-simplified-print-copy" : printMode ? "invoice-print-document mx-auto max-w-5xl bg-white p-5 sm:p-10" : "space-y-6"}>
      {!printMode ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link className="text-sm font-semibold text-primary hover:underline" href="/app/billing" locale={locale}>← {t("detail.back")}</Link>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{invoice.invoiceNumber ?? t("draftNumber")}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <BillingStatusBadge label={statusLabel} status={invoice.paymentStatus} />
            <Link href={printHref} locale={locale}><Button variant="secondary">{t("actions.printView")}</Button></Link>
          </div>
        </div>
      ) : !copyLabel ? (
        <div className="mb-6 flex justify-end print:hidden"><PrintInvoiceButton label={t("actions.print")} printRequestedAction={printRequestedAction} /></div>
      ) : null}

      {copyLabel ? <p className="mb-3 text-sm font-semibold text-primary">{copyLabel}</p> : null}

      <article className="overflow-hidden rounded-[1.25rem] border border-border bg-white shadow-card print:rounded-none print:border-0 print:shadow-none">
        <div className="h-1.5 bg-gradient-to-r from-primary via-secondary to-primary/20 print:bg-primary" />
        <div className="billing-invoice-content p-5 sm:p-8">
          <header className="grid gap-6 border-b border-border pb-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">{t(invoice.fiscalDocumentType === "simplified" ? "document.simplifiedInvoice" : "document.invoice")}</p>
              <h2 className="mt-2 text-3xl font-semibold text-primary">{invoice.invoiceNumber ?? t("draftNumber")}</h2>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-muted">{t("fields.issueDate")}</dt><dd className="font-semibold">{formatDate(invoice.issueDate, locale)}</dd></div>
                {invoice.fiscalDocumentType === "simplified" && invoice.servicePerformedOn ? <div><dt className="text-muted">{t("serviceIssue.date")}</dt><dd className="font-semibold">{formatDate(invoice.servicePerformedOn, locale)}</dd></div> : null}
                <div><dt className="text-muted">{t("fields.dueDate")}</dt><dd className="font-semibold">{formatDate(invoice.dueDate, locale)}</dd></div>
                <div><dt className="text-muted">{t("fields.series")}</dt><dd className="font-semibold">{invoice.series}</dd></div>
                {!isSimplifiedCopy ? <div><dt className="text-muted">{t("fields.status")}</dt><dd className="font-semibold">{statusLabel}</dd></div> : null}
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
            {showRecipient ? <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">{t("document.billTo")}</p>
              <h3 className="mt-2 text-lg font-semibold text-primary">{invoice.customerName}</h3>
              {invoice.customerTaxId ? <p className="mt-1 text-sm">{t("fields.taxId")}: {invoice.customerTaxId}</p> : null}
              <p className="mt-1 text-sm text-muted">{customerAddress || t("document.addressPending")}</p>
              {invoice.customerEmail ? <p className="mt-1 text-sm text-muted">{invoice.customerEmail}</p> : null}
            </div> : null}
            <div className="sm:text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">{t("document.linkedOrders")}</p>
              <div className="mt-2 flex flex-wrap gap-2 sm:justify-end">
                {invoice.orderIds.map((orderId, index) => (
                  <Link className="rounded-full border border-primary/15 bg-primary-soft px-3 py-1 text-sm font-semibold text-primary" href={`/app/orders/${orderId}`} key={orderId} locale={locale}>{invoice.orderNumbers[index]}</Link>
                ))}
              </div>
            </div>
          </section>

          <div className="billing-invoice-table-scroll py-6">
            <table className="billing-invoice-items w-full border-collapse text-sm">
              <colgroup><col className="billing-invoice-description" /><col className="billing-invoice-quantity" /><col className="billing-invoice-unit" /><col className="billing-invoice-discount" /><col className="billing-invoice-tax" /><col className="billing-invoice-total" /></colgroup>
              <thead><tr className="border-b border-border text-left text-xs text-muted"><th scope="col">{t("items.description")}</th><th scope="col">{t("items.quantity")}</th><th scope="col">{t("items.unitPrice")}<span className="block font-normal">{t("items.unitNet")}</span></th><th scope="col">{t("items.discount")}</th><th scope="col">{t(invoice.pricesIncludeTax ? "items.taxIncluded" : "items.tax")}</th><th scope="col">{t("items.total")}</th></tr></thead>
              <tbody>{items.map((item) => {
                // Presentation before discount only. Persisted line amounts remain authoritative.
                const taxFactor = 1 + item.taxRate / 100;
                const netUnitPrice = invoice.pricesIncludeTax ? item.unitPrice / taxFactor : item.unitPrice;

                return (
                  <tr className="border-b border-border/70" key={item.id}>
                    <td className="font-medium text-primary">{item.description}</td>
                    <td className="tabular-nums">{formatQuantity(item.quantity, locale)} <span className="billing-invoice-unit-label">{t(`units.${item.unitType}`)}</span></td>
                    <td className="tabular-nums"><span className="billing-invoice-amount">{formatCurrency(netUnitPrice, invoice.currency, locale)}</span></td>
                    <td className="tabular-nums"><span className="billing-invoice-amount">{formatCurrency(item.discountAmount, invoice.currency, locale)}</span></td>
                    <td className="tabular-nums"><p>{formatTaxRate(item.taxRate, locale)}%</p><p className="billing-invoice-amount">{formatCurrency(item.taxAmount, invoice.currency, locale)}</p></td>
                    <td className="tabular-nums">
                      <p className="billing-invoice-amount font-semibold">{formatCurrency(item.lineTotal, invoice.currency, locale)}</p>
                      <p className="mt-1 text-xs text-muted">{t("totals.taxable")}: <span className="billing-invoice-amount">{formatCurrency(item.taxableBase, invoice.currency, locale)}</span></p>
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
            <p className="mt-3 text-xs text-muted">{t("items.unitRoundingNote")}</p>
          </div>

          <section className="billing-invoice-summary grid gap-6 border-t border-border pt-6 sm:grid-cols-[1fr_20rem]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">{t("fields.notes")}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">{invoice.notes || t("document.noNotes")}</p>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">{t("totals.subtotal")}</dt><dd className="font-semibold tabular-nums">{formatCurrency(invoice.subtotal, invoice.currency, locale)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">{t("totals.discount")}</dt><dd className="font-semibold tabular-nums">−{formatCurrency(invoice.discountTotal, invoice.currency, locale)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">{t("totals.taxable")}</dt><dd className="font-semibold tabular-nums">{formatCurrency(invoice.taxableBase, invoice.currency, locale)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">{t(invoice.pricesIncludeTax ? "totals.taxIncluded" : "totals.tax")} ({formatTaxRate(taxRate, locale)}%)</dt><dd className="font-semibold tabular-nums">{formatCurrency(invoice.taxTotal, invoice.currency, locale)}</dd></div>
              <div className="flex justify-between border-t border-primary/15 pt-3 text-base"><dt className="font-semibold text-primary">{t("totals.total")}</dt><dd className="text-xl font-semibold tabular-nums text-primary">{formatCurrency(invoice.total, invoice.currency, locale)}</dd></div>
              {!isSimplifiedCopy ? <>
                <div className="flex justify-between"><dt className="text-muted">{t("totals.paid")}</dt><dd className="font-semibold tabular-nums text-emerald-700">{formatCurrency(invoice.paidTotal, invoice.currency, locale)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">{t("totals.outstanding")}</dt><dd className="font-semibold tabular-nums text-amber-800">{formatCurrency(invoice.outstanding, invoice.currency, locale)}</dd></div>
              </> : null}
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
              <label className="space-y-2 text-sm font-semibold text-primary"><span>{t("fields.series")}</span><input className="min-h-11 w-full rounded-control border border-border px-3" defaultValue={invoice.series} name="series" readOnly={invoice.fiscalDocumentType === "simplified"} required /></label>
              <label className="space-y-2 text-sm font-semibold text-primary"><span>{t("fields.taxRate")}</span><input className="min-h-11 w-full rounded-control border border-border px-3" defaultValue={taxRateInputValue(taxRate)} inputMode="decimal" max="100" min="0" name="taxRate" readOnly={invoice.fiscalDocumentType === "simplified"} required step="0.01" type="number" /></label>
              <label className="space-y-2 text-sm font-semibold text-primary sm:col-span-2"><span>{t("fields.notes")}</span><textarea className="min-h-28 w-full rounded-control border border-border p-3" defaultValue={invoice.notes ?? ""} name="notes" /></label>
              {invoice.fiscalDocumentType === "simplified" ? <fieldset className="space-y-3 sm:col-span-2">
                <legend className="text-sm font-semibold text-primary">{t("document.billTo")}</legend>
                <label className="block space-y-2 text-sm font-semibold text-primary">
                  <span>{t("document.recipientMode")}</span>
                  <select className="min-h-11 w-full rounded-control border border-border bg-white px-3" defaultValue={invoice.recipientSnapshotMode === "anonymous" ? "anonymous" : "identified"} name="recipientMode">
                    <option value="anonymous">{t("document.anonymousRecipient")}</option>
                    <option value="identified">{t("document.identifiedRecipient")}</option>
                  </select>
                </label>
                <p className="text-sm text-muted">{t("document.recipientHelp")}</p>
                <details open={invoice.recipientSnapshotMode !== "anonymous"}>
                  <summary className="cursor-pointer text-sm font-semibold text-primary">{t("document.identifiedRecipient")}</summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {[
                      ["recipientName", "document.recipientName", invoice.customerName, 180],
                      ["recipientTaxId", "fields.taxId", invoice.customerTaxId, 80],
                      ["recipientAddressLine1", "create.customerFiscal.addressLine1", invoice.customerAddressLine1, 180],
                      ["recipientCity", "create.customerFiscal.city", invoice.customerCity, 100],
                      ["recipientPostalCode", "create.customerFiscal.postalCode", invoice.customerPostalCode, 24],
                      ["recipientCountryCode", "create.customerFiscal.countryCode", invoice.customerCountryCode, 2],
                    ].map(([name, label, value, max]) => <label className="space-y-2 text-sm font-semibold text-primary" key={String(name)}>
                      <span>{t(String(label))}</span><input className="min-h-11 w-full rounded-control border border-border px-3" defaultValue={String(value ?? "")} maxLength={Number(max)} name={String(name)} />
                    </label>)}
                  </div>
                </details>
              </fieldset> : null}
              <div className="sm:col-span-2"><Button type="submit" variant="secondary">{t("actions.saveDraft")}</Button></div>
            </form>
          </Card>
          <Card className="space-y-4 bg-white">
            <h2 className="text-xl font-semibold text-primary">{t("issue.title")}</h2>
            <p className="text-sm leading-6 text-muted">{t("issue.description")}</p>
            {invoice.fiscalDocumentType === "ordinary" ? <form action={issueBillingInvoiceAction.bind(null, locale, invoice.id, invoice.customerId)}><Button className="w-full" type="submit">{t("actions.issue")}</Button></form>
              : detail.simplifiedIssuanceReady ? <form action={issueSimplifiedBillingInvoiceAction.bind(null, locale, invoice.id)} className="space-y-4">
                <p className="text-sm text-muted">{t("serviceIssue.help")}</p>
                {detail.operationalCompletedAt ? <p className="text-sm text-muted">{t("serviceIssue.reference")}: {formatDate(detail.operationalCompletedAt, locale)}</p> : null}
                <label className="block space-y-2 text-sm font-semibold"><span>{t("serviceIssue.date")}</span><input className="min-h-11 w-full rounded-control border border-border px-3" name="servicePerformedOn" required type="date" /></label>
                <label className="block space-y-2 text-sm font-semibold"><span>{t("serviceIssue.scope")}</span><select className="min-h-11 w-full rounded-control border border-border px-3" defaultValue="" name="operationScope" required><option disabled value="">{t("serviceIssue.choose")}</option><option value="local_laundry_dry_cleaning">{t("serviceIssue.localLaundry")}</option><option value="ordinary_required">{t("serviceIssue.otherOperation")}</option></select></label>
                <label className="block space-y-2 text-sm font-semibold"><span>{t("serviceIssue.recipient")}</span><select className="min-h-11 w-full rounded-control border border-border px-3" defaultValue="" name="fiscalRecipientRequirement" required><option disabled value="">{t("serviceIssue.choose")}</option><option value="consumer">{t("serviceIssue.consumer")}</option><option value="consumer_identified">{t("serviceIssue.consumerIdentified")}</option><option value="business">{t("serviceIssue.business")}</option><option value="ordinary_required">{t("serviceIssue.ordinaryRequired")}</option></select></label>
                <label className="flex gap-3 text-sm"><input className="mt-1" name="serviceConfirmed" required type="checkbox" value="confirmed" /><span>{t("serviceIssue.confirm")}</span></label>
                <Button className="w-full" type="submit">{t("actions.issue")}</Button>
              </form> : <p className="text-sm text-amber-800" role="status">{t("create.form.simplifiedUnavailable")}</p>}
            <form action={deleteBillingDraftAction.bind(null, locale, invoice.id, invoice.customerId)}><Button className="w-full" type="submit" variant="danger">{t("actions.deleteDraft")}</Button></form>
          </Card>
        </div>
      ) : null}

      {!printMode && invoice.documentStatus === "issued" && invoice.fiscalDocumentType !== "simplified" ? (
        <Card className="border-red-100 bg-white">
          <h2 className="text-xl font-semibold text-primary">{t("cancel.title")}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">{t("cancel.description")}</p>
          <form action={cancelBillingInvoiceAction.bind(null, locale, invoice.id, invoice.customerId)} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input className="min-h-11 flex-1 rounded-control border border-border px-3 text-sm" name="reason" placeholder={t("cancel.reason")} required />
            <Button type="submit" variant="danger">{t("actions.cancel")}</Button>
          </form>
        </Card>
      ) : null}

      {!printMode && invoice.documentStatus === "issued" && invoice.fiscalDocumentType === "simplified" ? <p className="text-sm text-muted">{t("document.simplifiedCorrectionBlocked")}</p> : null}

      {!printMode && payments.length > 0 ? (
        <Card className="bg-white">
          <h2 className="text-xl font-semibold text-primary">{t("payments.title")}</h2>
          <div className="mt-4 divide-y divide-border">{payments.map((payment) => <div className="grid gap-2 py-3 text-sm sm:grid-cols-4" key={payment.id}><span>{formatDate(payment.paidAt, locale)}</span><span>{t(`paymentMethods.${payment.method}`)}</span><span>{t(`paymentRecords.${payment.status}`)}</span><strong className="sm:text-right">{payment.status === "refunded" ? "−" : ""}{formatCurrency(payment.amount, invoice.currency, locale)}</strong></div>)}</div>
        </Card>
      ) : null}
    </div>
  );
}
