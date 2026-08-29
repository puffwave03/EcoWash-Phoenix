import { getTranslations } from "next-intl/server";
import { BillingSettingsPanel } from "@/components/billing/BillingSettingsPanel";
import { BillingStatusBadge } from "@/components/billing/BillingStatusBadge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PageHeader, SummaryCard } from "@/components/operational/OperationalUi";
import { getBillingSettings, listBillingInvoices } from "@/features/billing/server/queries";
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
  searchParams: Promise<{ error?: string; q?: string; saved?: string; status?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const [access, invoices, settings, t] = await Promise.all([
    requireOwnerOrManager(locale),
    listBillingInvoices(locale),
    getBillingSettings(locale),
    getTranslations({ locale, namespace: "common.billing" }),
  ]);
  const status = ["all", "draft", "unpaid", "partially_paid", "paid", "cancelled"].includes(query.status ?? "") ? query.status ?? "all" : "all";
  const search = (query.q ?? "").trim().toLowerCase();
  const filtered = invoices.filter((invoice) => (status === "all" || invoice.paymentStatus === status) && (!search || `${invoice.invoiceNumber ?? ""} ${invoice.customerName} ${invoice.orderNumbers.join(" ")}`.toLowerCase().includes(search)));
  const issued = invoices.filter((invoice) => invoice.documentStatus === "issued");
  const primaryCurrency = issued[0]?.currency ?? "EUR";
  const sameCurrencyIssued = issued.filter((invoice) => invoice.currency === primaryCurrency);

  return (
    <div className="space-y-6">
      <PageHeader action={<Link href="/app/billing/new" locale={locale}><Button>{t("actions.create")}</Button></Link>} description={t("description")} eyebrow={t("eyebrow")} title={t("title")} />
      {query.error ? <p className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{t(`errors.${query.error}`)}</p> : null}
      {query.saved ? <p className="rounded-control border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{t("saved")}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label={t("summary.invoices")} value={invoices.length} />
        <SummaryCard label={t("summary.drafts")} value={invoices.filter((invoice) => invoice.documentStatus === "draft").length} />
        <SummaryCard label={t("summary.issued")} value={formatCurrency(sameCurrencyIssued.reduce((sum, invoice) => sum + invoice.total, 0), primaryCurrency, locale)} />
        <SummaryCard label={t("summary.outstanding")} tone={sameCurrencyIssued.some((invoice) => invoice.outstanding > 0) ? "warning" : "success"} value={formatCurrency(sameCurrencyIssued.reduce((sum, invoice) => sum + invoice.outstanding, 0), primaryCurrency, locale)} />
      </div>
      {access.membership.role === "owner" ? <BillingSettingsPanel locale={locale} settings={settings} text={t.raw("settings") as Record<string, string>} /> : !settings.isIssueReady ? <p className="rounded-control border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{t("settings.managerMissing")}{settings.missingRequiredFields.length ? ` ${t("settings.missingFields")}: ${settings.missingRequiredFields.map((field) => t(`settings.${issuerFieldLabelKeys[field]}`)).join(", ")}.` : ""}</p> : null}
      <Card className="bg-white">
        <form className="grid gap-4 sm:grid-cols-[1fr_13rem_auto]">
          <label className="space-y-2 text-sm font-semibold text-primary"><span>{t("filters.search")}</span><input className="min-h-11 w-full rounded-control border border-border px-3" defaultValue={query.q} name="q" placeholder={t("filters.placeholder")} /></label>
          <label className="space-y-2 text-sm font-semibold text-primary"><span>{t("fields.status")}</span><select className="min-h-11 w-full rounded-control border border-border px-3" defaultValue={status} name="status"><option value="all">{t("filters.all")}</option>{(["draft", "unpaid", "partially_paid", "paid", "cancelled"] as BillingPaymentStatus[]).map((value) => <option key={value} value={value}>{t(`statuses.${value}`)}</option>)}</select></label>
          <div className="flex items-end"><Button type="submit" variant="secondary">{t("filters.apply")}</Button></div>
        </form>
      </Card>
      {filtered.length === 0 ? <Card className="border-dashed bg-[#fafbfa] text-center text-sm text-muted">{t("empty")}</Card> : (
        <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-white shadow-card">
          {filtered.map((invoice) => <article className="grid gap-4 p-4 sm:grid-cols-[1.2fr_1fr_auto_auto] sm:items-center sm:p-5" key={invoice.id}>
            <div><Link className="text-lg font-semibold text-primary hover:underline" href={`/app/billing/${invoice.id}`} locale={locale}>{invoice.invoiceNumber ?? t("draftNumber")}</Link><p className="mt-1 text-xs text-muted">{invoice.orderNumbers.join(", ")}</p></div>
            <div><p className="font-semibold text-foreground">{invoice.customerName}</p><p className="mt-1 text-xs text-muted">{formatDate(invoice.issueDate, locale)}</p></div>
            <div className="sm:text-right"><p className="font-semibold tabular-nums text-primary">{formatCurrency(invoice.total, invoice.currency, locale)}</p><p className="mt-1 text-xs text-muted">{t("totals.outstanding")}: {formatCurrency(invoice.outstanding, invoice.currency, locale)}</p></div>
            <BillingStatusBadge label={t(`statuses.${invoice.paymentStatus}`)} status={invoice.paymentStatus} />
          </article>)}
        </div>
      )}
    </div>
  );
}
