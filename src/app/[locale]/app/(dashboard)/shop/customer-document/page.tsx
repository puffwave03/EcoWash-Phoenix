import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getTerminalCustomerDocument } from "@/features/shop-terminal/server/customer-document";
import { issueTerminalCustomerDocument } from "@/features/shop-terminal/server/customer-document-actions";
import { formatCurrency } from "@/lib/number-format";

export default async function TerminalCustomerDocument({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ orderId?: string; result?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const document = await getTerminalCustomerDocument(locale, query.orderId ?? "");
  if (document.state === "issued") redirect(`/${locale}/app/billing/${document.invoiceId}/ticket?format=80mm`);
  if (document.state === "operational" && !query.result) redirect(`/${locale}${document.copyHref}`);
  const t = await getTranslations({ locale, namespace: "common.billing.fiscalTicket" });
  return <section className="mx-auto max-w-2xl space-y-5 rounded-control border border-border bg-white p-6">
    <h1 className="text-2xl font-bold">{t("title")}</h1>
    <p role="status">{t("terminalSaved")}</p>
    <p className="rounded-control border border-amber-300 bg-amber-50 p-3">{t("localOnly")}</p>
    {query.result ? <p role="alert">{t(query.result === "uncertain" ? "uncertain" : "confirmationRequired")}</p> : null}
    {document.state === "ready" ? <>
      <p>{document.preview.order.order_number} · {formatCurrency(Number(document.preview.order.total), "EUR", locale)}</p>
      <p>{t("paymentPreserved")}</p>
      <form action={issueTerminalCustomerDocument.bind(null, locale, document.preview.order.id)} className="space-y-4">
        <label className="block">{t("recipient")}
          <select name="recipient" required defaultValue="" className="block min-h-11 w-full rounded-control border border-border p-2">
            <option value="" disabled>{t("chooseRecipient")}</option>
            {document.preview.customer.customer_type === "business" ? <option value="business">{t("business")}</option> : <>
              <option value="consumer">{t("consumer")}</option><option value="consumer_identified">{t("identified")}</option>
            </>}
          </select>
        </label>
        <p>{t("recipientHelp")}</p>
        <label className="flex gap-3"><input type="checkbox" name="serviceNotPerformed" required /><span>{t("serviceConfirmation")}</span></label>
        <label className="flex gap-3"><input type="checkbox" name="laundryScope" required /><span>{t("scopeConfirmation")}</span></label>
        <button className="min-h-11 rounded-control bg-primary px-5 py-3 font-bold text-white" type="submit">{t("issue")}</button>
      </form>
    </> : <p role="alert">{t(document.state === "unavailable" ? "unavailable" : "blocked")}</p>}
    <Link locale={locale} href={`/app/shop/customer-document?orderId=${encodeURIComponent(query.orderId ?? "")}`} prefetch={false} className="block underline">{t("recover")}</Link>
    <Link locale={locale} href={document.copyHref} prefetch={false} className="block underline">{t("operationalCopy")}</Link>
  </section>;
}
