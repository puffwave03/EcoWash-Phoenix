import { getTranslations } from "next-intl/server";
import { BillingCreateForm } from "@/components/billing/BillingCreateForm";
import { BillingCustomerFiscalPanel } from "@/components/billing/BillingCustomerFiscalPanel";
import { PageHeader } from "@/components/operational/OperationalUi";
import { getBillingCustomerContext, getBillingSettings, listEligibleBillingOrders } from "@/features/billing/server/queries";
import { Link } from "@/i18n/navigation";

export default async function NewBillingInvoicePage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ customerId?: string; error?: string; orderId?: string; q?: string; saved?: string; source?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const search = typeof query.q === "string" ? query.q.trim().slice(0, 100) : "";
  const [discovery, settings, customerContext, t] = await Promise.all([
    listEligibleBillingOrders(locale, query.customerId, query.orderId, search),
    getBillingSettings(locale),
    query.customerId ? getBillingCustomerContext(locale, query.customerId) : Promise.resolve(null),
    getTranslations({ locale, namespace: "common.billing" }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader description={t("create.description")} eyebrow={t("eyebrow")} title={t("create.title")} />
      {query.error ? <p className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{t(`errors.${query.error}`)}</p> : null}
      {query.saved === "customer" ? <p className="rounded-control border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{t("create.customerSaved")}</p> : null}
      {query.source === "shop" && query.orderId ? <p className="rounded-control border border-primary/20 bg-primary-soft px-4 py-3 text-sm font-semibold text-primary">{t("create.counterContext")}</p> : null}
      {!settings.isIssueReady ? <p className="rounded-control border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{t("create.settingsWarning")}</p> : null}
      {customerContext && query.orderId ? <BillingCustomerFiscalPanel context={customerContext} locale={locale} orderId={query.orderId} text={t.raw("create.customerFiscal") as Record<string, string>} /> : null}
      <form action={`/${locale}/app/billing/new`} className="flex flex-wrap items-end gap-3" method="get" role="search">
        {query.customerId ? <input name="customerId" type="hidden" value={query.customerId} /> : null}
        <label className="min-w-56 flex-1 space-y-2 text-sm font-semibold text-primary">
          <span>{t("create.search.label")}</span>
          <input className="min-h-11 w-full rounded-control border border-border px-3" defaultValue={search} maxLength={100} name="q" placeholder={t("create.search.placeholder")} type="search" />
        </label>
        <button className="min-h-11 rounded-control bg-primary px-4 text-sm font-semibold text-white" type="submit">{t("create.search.apply")}</button>
        {search ? <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline" href={query.customerId ? `/app/billing/new?customerId=${encodeURIComponent(query.customerId)}` : "/app/billing/new"} locale={locale}>{t("create.search.clear")}</Link> : null}
      </form>
      {discovery.hasMore ? <p className="rounded-control border border-border bg-primary-soft px-4 py-3 text-sm text-primary">{t("create.search.more")}</p> : null}
      {!customerContext || customerContext.isFiscalReady ? <BillingCreateForm emptyMessage={search ? t("create.search.empty") : undefined} hasMore={discovery.hasMore} locale={locale} orders={discovery.orders} selectedOrderId={query.orderId} settings={settings} text={t.raw("create.form") as Record<string, string>} /> : null}
    </div>
  );
}
