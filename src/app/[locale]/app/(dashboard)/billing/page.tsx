import { getTranslations } from "next-intl/server";
import { BillingSettingsPanel } from "@/components/billing/BillingSettingsPanel";
import { BillingStatusBadge } from "@/components/billing/BillingStatusBadge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PageHeader, SummaryCard } from "@/components/operational/OperationalUi";
import { getBillingHistorySummary, getBillingSettings, listBillingInvoices } from "@/features/billing/server/queries";
import { billingHistoryHref, normalizeBillingFilters } from "@/features/billing/pagination";
import type { BillingPaymentStatus } from "@/features/billing/types";
import { Link } from "@/i18n/navigation";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { formatCurrency } from "@/lib/number-format";

const issuerFieldLabelKeys = {
  issuerAddressLine1: "addressLine1",
  issuerCity: "city",
  issuerCountryCode: "countryCode",
  issuerLegalName: "legalName",
  issuerPostalCode: "postalCode",
  issuerTaxId: "taxId",
} as const;

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value));
}

export default async function BillingPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ cursor?: string; error?: string; q?: string; saved?: string; status?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const filters = normalizeBillingFilters(query.q, query.status);
  const [access, history, summary, settings, t] = await Promise.all([
    requireOwnerOrManager(locale),
    listBillingInvoices(locale, filters, query.cursor),
    getBillingHistorySummary(locale),
    getBillingSettings(locale),
    getTranslations({ locale, namespace: "common.billing" }),
  ]);
  const status = filters.status;
  const primaryCurrency = summary.currency;

  return (
    <div className="space-y-6">
      <PageHeader action={<Link href="/app/billing/new" locale={locale}><Button>{t("actions.create")}</Button></Link>} description={t("description")} eyebrow={t("eyebrow")} title={t("title")} />
      {query.error ? <p className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{t(`errors.${query.error}`)}</p> : null}
      {query.saved ? <p className="rounded-control border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{t("saved")}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label={t("summary.invoices")} value={summary.invoiceCount} />
        <SummaryCard label={t("summary.drafts")} value={summary.draftCount} />
        <SummaryCard label={t("summary.issued")} value={formatCurrency(summary.issuedTotal, primaryCurrency, locale)} />
        <SummaryCard label={t("summary.outstanding")} tone={summary.outstanding > 0 ? "warning" : "success"} value={formatCurrency(summary.outstanding, primaryCurrency, locale)} />
      </div>
      {access.membership.role === "owner" ? <BillingSettingsPanel locale={locale} settings={settings} text={t.raw("settings") as Record<string, string>} /> : !settings.isIssueReady ? <p className="rounded-control border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{t("settings.managerMissing")}{settings.missingRequiredFields.length ? ` ${t("settings.missingFields")}: ${settings.missingRequiredFields.map((field) => t(`settings.${issuerFieldLabelKeys[field]}`)).join(", ")}.` : ""}</p> : null}
      <Card className="bg-white">
        <form className="grid gap-4 sm:grid-cols-[1fr_13rem_auto]">
          <label className="space-y-2 text-sm font-semibold text-primary"><span>{t("filters.search")}</span><input className="min-h-11 w-full rounded-control border border-border px-3" defaultValue={query.q} name="q" placeholder={t("filters.placeholder")} /></label>
          <label className="space-y-2 text-sm font-semibold text-primary"><span>{t("fields.status")}</span><select className="min-h-11 w-full rounded-control border border-border px-3" defaultValue={status} name="status"><option value="all">{t("filters.all")}</option>{(["draft", "unpaid", "partially_paid", "paid", "cancelled"] as BillingPaymentStatus[]).map((value) => <option key={value} value={value}>{t(`statuses.${value}`)}</option>)}</select></label>
          <div className="flex items-end"><Button type="submit" variant="secondary">{t("filters.apply")}</Button></div>
        </form>
      </Card>
      {history.items.length === 0 ? <Card className="border-dashed bg-[#fafbfa] text-center text-sm text-muted">{t("empty")}</Card> : (
        <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-white shadow-card">
          {history.items.map((invoice) => <article className="grid gap-4 p-4 sm:grid-cols-[1.2fr_1fr_auto_auto] sm:items-center sm:p-5" key={invoice.id}>
            <div><Link className="text-lg font-semibold text-primary hover:underline" href={`/app/billing/${invoice.id}`} locale={locale}>{invoice.invoiceNumber ?? t("draftNumber")}</Link><p className="mt-1 text-xs text-muted">{invoice.orderNumbers.join(", ")}</p></div>
            <div><p className="font-semibold text-foreground">{invoice.customerName}</p><p className="mt-1 text-xs text-muted">{formatDate(invoice.issueDate, locale)}</p></div>
            <div className="sm:text-right"><p className="font-semibold tabular-nums text-primary">{formatCurrency(invoice.total, invoice.currency, locale)}</p><p className="mt-1 text-xs text-muted">{t("totals.outstanding")}: {formatCurrency(invoice.outstanding, invoice.currency, locale)}</p></div>
            <BillingStatusBadge label={t(`statuses.${invoice.paymentStatus}`)} status={invoice.paymentStatus} />
          </article>)}
        </div>
      )}
      <nav aria-label={t("pagination.label")} className="flex flex-wrap gap-3">
        {history.newerCursor ? <Link className="inline-flex min-h-11 items-center rounded-control border border-border px-4 text-sm font-semibold" href={billingHistoryHref(filters, history.newerCursor)} locale={locale}>{t("pagination.newer")}</Link> : null}
        {history.olderCursor ? <Link className="inline-flex min-h-11 items-center rounded-control border border-border px-4 text-sm font-semibold" href={billingHistoryHref(filters, history.olderCursor)} locale={locale}>{t("pagination.older")}</Link> : null}
        {query.cursor ? <Link className="inline-flex min-h-11 items-center px-4 text-sm font-semibold underline" href={billingHistoryHref(filters)} locale={locale}>{t("pagination.latest")}</Link> : null}
      </nav>
    </div>
  );
}
