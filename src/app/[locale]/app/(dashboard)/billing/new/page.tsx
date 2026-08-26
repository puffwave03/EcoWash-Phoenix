import { getTranslations } from "next-intl/server";
import { BillingCreateForm } from "@/components/billing/BillingCreateForm";
import { PageHeader } from "@/components/operational/OperationalUi";
import { getBillingSettings, listEligibleBillingOrders } from "@/features/billing/server/queries";

export default async function NewBillingInvoicePage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ customerId?: string; error?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const [orders, settings, t] = await Promise.all([
    listEligibleBillingOrders(locale, query.customerId),
    getBillingSettings(locale),
    getTranslations({ locale, namespace: "common.billing" }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader description={t("create.description")} eyebrow={t("eyebrow")} title={t("create.title")} />
      {query.error ? <p className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{t(`errors.${query.error}`)}</p> : null}
      {!settings.isIssueReady ? <p className="rounded-control border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{t("create.settingsWarning")}</p> : null}
      <BillingCreateForm locale={locale} orders={orders} settings={settings} text={t.raw("create.form") as Record<string, string>} />
    </div>
  );
}
