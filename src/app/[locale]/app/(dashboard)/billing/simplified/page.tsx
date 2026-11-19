import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { BillingSimplifiedTicket } from "@/components/billing/BillingSimplifiedTicket";
import { billingSimplifiedUiBlockedLabel, billingSimplifiedUiCopy } from "@/components/billing/simplified-ui-copy";
import { PrintInvoiceButton } from "@/components/billing/PrintInvoiceButton";
import { getBillingSimplifiedUiState } from "@/features/billing/server/simplified-ui";
import { billingSimplifiedUiEnabled, billingSimplifiedUiMutationEnabled } from "@/features/billing/server/simplified-ui-access";
import { prepareBillingSimplifiedUiAction, issueBillingSimplifiedUiAction } from "@/features/billing/server/simplified-ui-actions";
import { Link } from "@/i18n/navigation";

export default async function BillingSimplifiedPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ orderId?: string; orderNumber?: string; error?: string }>;
}) {
  if (!await billingSimplifiedUiEnabled()) notFound();
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const state = await getBillingSimplifiedUiState(locale, {
    orderId: typeof query.orderId === "string" ? query.orderId : undefined,
    orderNumber: typeof query.orderNumber === "string" ? query.orderNumber : undefined,
  });
  const text = billingSimplifiedUiCopy(locale);
  const mutationsEnabled = await billingSimplifiedUiMutationEnabled();
  const t = await getTranslations({ locale, namespace: "common.billing" });
  const order = "order" in state ? state.order : undefined;
  return (
    <div className="space-y-5">
      <div className="space-y-4 print:hidden">
        <nav aria-label={t("title")} className="flex flex-wrap gap-4 text-sm font-semibold text-primary">
          <Link className="underline" href="/app/billing" locale={locale}>{t("title")}</Link>
          <Link className="underline" href="/app/billing/new" locale={locale}>{text.ordinary}</Link>
          <span aria-current="page">{text.simplified}</span>
        </nav>
        <h1 className="text-2xl font-semibold text-primary">{text.simplified}</h1>
        <p className="text-sm text-muted">{text.description}</p>
        {!mutationsEnabled ? <p role="status">{text.readOnly}</p> : null}
        <form action={`/${locale}/app/billing/simplified`} className="flex flex-wrap items-end gap-3" method="get" role="search">
          <label className="space-y-2 text-sm font-semibold text-primary"><span>{text.order}</span><input className="block min-h-11 rounded-control border border-border px-3" defaultValue={order?.order_number ?? query.orderNumber} maxLength={80} name="orderNumber" required /></label>
          <Button type="submit" variant="secondary">{text.search}</Button>
        </form>
        {query.error && state.status !== "issued" && state.status !== "issued_unavailable" ? <p role="alert">{billingSimplifiedUiBlockedLabel(locale, query.error)}</p> : null}
        {state.status === "blocked" ? <p role="alert">{billingSimplifiedUiBlockedLabel(locale, state.reason)}</p> : null}
        {state.status === "ready" && mutationsEnabled ? (
          <Card>
            <p className="mb-4 font-semibold">{state.order.order_number}</p>
            <form action={prepareBillingSimplifiedUiAction.bind(null, locale)} className="flex flex-wrap items-end gap-3">
              <input name="orderId" type="hidden" value={state.order.id} />
              <label className="space-y-2 text-sm font-semibold"><span>{text.series}</span><input className="block min-h-11 rounded-control border border-border px-3 uppercase" maxLength={12} name="series" pattern="[A-Za-z0-9-]{1,12}" required /></label>
              <Button type="submit">{text.prepare}</Button>
            </form>
          </Card>
        ) : null}
        {state.status === "draft" && !mutationsEnabled ? <p className="font-semibold">{text.preview} · {state.order.order_number}</p> : null}
        {state.status === "draft" && mutationsEnabled ? (
          <form action={issueBillingSimplifiedUiAction.bind(null, locale)} className="space-y-4">
            <p className="font-semibold">{text.preview} · {state.order.order_number}</p>
            <input name="orderId" type="hidden" value={state.order.id} />
            <label className="flex items-start gap-2 text-sm"><input name="confirm" required type="checkbox" value="issue" /><span>{text.confirm}</span></label>
            <Button type="submit">{text.issue}</Button>
          </form>
        ) : null}
        {state.status === "issued" ? <div className="space-y-3"><p role="status">{text.issued}: {state.ticket.document.document.number}</p><PrintInvoiceButton label={t("actions.print")} /></div> : null}
        {state.status === "issued_unavailable" ? <p role="status">{text.unavailable}</p> : null}
        {state.status === "issued" || state.status === "issued_unavailable" ? <Link className="inline-block underline" href={`/app/billing/simplified?orderId=${state.order.id}`} locale={locale}>{text.refresh}</Link> : null}
      </div>
      {state.status === "draft" || state.status === "issued" ? <BillingSimplifiedTicket {...state.ticket} /> : null}
    </div>
  );
}
