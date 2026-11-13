import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getFiscalTicketPreview } from "@/features/billing/server/fiscal-ticket-queries";
import { issueFullPrepaymentTicketAction } from "@/features/billing/server/fiscal-ticket-actions";
import { formatCurrency } from "@/lib/number-format";

export default async function FullPrepaymentPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ orderId?: string; result?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const [preview, t] = await Promise.all([
    getFiscalTicketPreview(locale, query.orderId ?? ""),
    getTranslations({ locale, namespace: "common.billing.fiscalTicket" }),
  ]);
  return <section className="mx-auto max-w-2xl space-y-5 rounded-control border border-border bg-white p-6">
    <h1 className="text-2xl font-bold">{t("title")}</h1>
    <p className="rounded-control border border-amber-300 bg-amber-50 p-3" role="note">{t("localOnly")}</p>
    {query.result ? <p role="alert">{t(query.result === "confirmation" ? "confirmationRequired" : "uncertain")}</p> : null}
    {preview.state === "issued" ? <Link className="font-semibold underline" locale={locale} href={`/app/billing/${preview.invoiceId}/ticket`}>{t("open")}</Link>
      : preview.state !== "ready" ? <p role="status">{t(preview.state)}</p>
      : <>
        <p className="font-semibold">{preview.order.order_number} · {formatCurrency(Number(preview.order.total), "EUR", locale)}</p>
        <p>{t("paymentPreserved")}</p>
        <form action={issueFullPrepaymentTicketAction.bind(null, locale, preview.order.id)} className="space-y-5">
          <input type="hidden" name="paymentId" value={preview.payment.id} />
          <label className="block space-y-2"><span>{t("recipient")}</span>
            <select name="recipient" className="block min-h-11 w-full rounded-control border border-border p-2" defaultValue={preview.customer.customer_type === "business" ? "business" : "consumer"}>
              {preview.customer.customer_type === "business" ? <option value="business">{t("business")}</option> : <>
                <option value="consumer">{t("consumer")}</option>
                <option value="consumer_identified">{t("identified")}</option>
              </>}
            </select>
          </label>
          <p className="text-sm">{t("recipientHelp")}</p>
          <label className="flex gap-3"><input type="checkbox" name="serviceNotPerformed" required /><span>{t("serviceConfirmation")}</span></label>
          <label className="flex gap-3"><input type="checkbox" name="laundryScope" required /><span>{t("scopeConfirmation")}</span></label>
          <button type="submit" className="min-h-11 rounded-control bg-primary px-5 py-3 font-bold text-white">{t("issue")}</button>
        </form>
      </>}
  </section>;
}
