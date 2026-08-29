import { getTranslations } from "next-intl/server";
import { BillingCreateForm } from "@/components/billing/BillingCreateForm";
import { BillingCustomerFiscalPanel } from "@/components/billing/BillingCustomerFiscalPanel";
import { PageHeader } from "@/components/operational/OperationalUi";
import { getBillingCustomerContext, getBillingSettings, listEligibleBillingOrders } from "@/features/billing/server/queries";

export default async function NewBillingInvoicePage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ customerId?: string; error?: string; orderId?: string; saved?: string; source?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const [orders, settings, customerContext, t] = await Promise.all([
    listEligibleBillingOrders(locale, query.customerId, query.orderId),
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
      {!customerContext || customerContext.isFiscalReady ? <BillingCreateForm locale={locale} orders={orders} selectedOrderId={query.orderId} settings={settings} text={t.raw("create.form") as Record<string, string>} /> : null}
    </div>
  );
}
