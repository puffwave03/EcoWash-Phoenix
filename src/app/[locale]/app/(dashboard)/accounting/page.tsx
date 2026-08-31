import { getTranslations } from "next-intl/server";
import { AccountingManagement, type AccountingManagementText } from "@/components/accounting/AccountingManagement";
import { Card } from "@/components/Card";
import { EmptyState, PageHeader, SummaryCard } from "@/components/operational/OperationalUi";
import { getAccountingPeriodContext, getAccountingWorkspace } from "@/features/accounting/server/workspace-queries";
import { resolveAccountingPeriod } from "@/features/accounting/workspace";
import { formatCurrency } from "@/lib/number-format";

type SearchValue = string | string[] | undefined;
const one = (value: SearchValue) => Array.isArray(value) ? value[0] : value;

function dateTime(value: string, locale: string, timezone: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(value));
}

export default async function AccountingPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, SearchValue>>;
}) {
  const [{ locale }, query, t] = await Promise.all([
    params,
    searchParams,
    params.then(({ locale: activeLocale }) => getTranslations({ locale: activeLocale, namespace: "common.accountingWorkspace" })),
  ]);
  let context: Awaited<ReturnType<typeof getAccountingPeriodContext>> | null = null;
  try {
    context = await getAccountingPeriodContext(locale);
  } catch (error) {
    console.error("Accounting workspace context failed", error instanceof Error ? error.message : "unknown");
  }
  if (!context) return <div className="space-y-6"><PageHeader description={t("description")} eyebrow={t("eyebrow")} title={t("title")} /><Card className="border-red-200 bg-red-50"><p className="text-sm text-red-800" role="alert">{t("queryError")}</p></Card></div>;
  let invalidPeriod = false;
  let selection;
  try {
    selection = resolveAccountingPeriod(one(query.preset), one(query.start), one(query.end), context.timezone);
  } catch {
    invalidPeriod = true;
    selection = resolveAccountingPeriod("month", undefined, undefined, context.timezone);
  }
  const requestedLocation = one(query.location) || null;
  const locationId = requestedLocation && context.locations.some((value) => value.id === requestedLocation) ? requestedLocation : null;
  let data: Awaited<ReturnType<typeof getAccountingWorkspace>> | null = null;
  try {
    data = await getAccountingWorkspace(locale, selection.period, locationId);
  } catch (error) {
    console.error("Accounting workspace query failed", error instanceof Error ? error.message : "unknown");
  }

  const exportQuery = new URLSearchParams({
    end: selection.endDate,
    preset: selection.preset,
    start: selection.period.startDate,
    ...(locationId ? { location: locationId } : {}),
  }).toString();
  const summaryText = t.raw("summary") as Record<string, string>;
  const sectionText = t.raw("sections") as Record<string, string>;
  const activityTypes = t.raw("activityTypes") as Record<string, string>;
  const methodText = t.raw("management.methods") as Record<string, string>;

  return <div className="space-y-6">
    <PageHeader description={t("description")} eyebrow={t("eyebrow")} title={t("title")} />

    <form className="rounded-card border border-border bg-white p-4 shadow-sm" method="get">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.3fr_1fr_1fr_1fr_auto] xl:items-end">
        <fieldset><legend className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted">{t("filters.period")}</legend><div className="flex flex-wrap gap-2">{["today", "week", "month", "previousMonth", "custom"].map((preset) => <button className={`min-h-11 rounded-control border px-3 text-sm font-semibold ${selection.preset === preset ? "border-primary bg-primary-soft text-primary" : "border-border bg-white text-muted"}`} key={preset} name="preset" type="submit" value={preset}>{t(`presets.${preset}`)}</button>)}</div></fieldset>
        <label className="space-y-1.5 text-sm font-semibold text-primary"><span>{t("filters.start")}</span><input className="min-h-11 w-full rounded-control border border-border px-3" defaultValue={selection.period.startDate} name="start" type="date" /></label>
        <label className="space-y-1.5 text-sm font-semibold text-primary"><span>{t("filters.end")}</span><input className="min-h-11 w-full rounded-control border border-border px-3" defaultValue={selection.endDate} name="end" type="date" /></label>
        <label className="space-y-1.5 text-sm font-semibold text-primary"><span>{t("filters.location")}</span><select className="min-h-11 w-full rounded-control border border-border bg-white px-3" defaultValue={locationId ?? ""} name="location"><option value="">{t("filters.allLocations")}</option>{context.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
        <button className="min-h-11 rounded-control bg-primary px-4 text-sm font-semibold text-white" name="preset" type="submit" value="custom">{t("filters.apply")}</button>
      </div>
      <p className="mt-3 text-xs text-muted">{selection.period.startDate} — {selection.endDate} · {context.timezone}</p>
      {invalidPeriod ? <p className="mt-2 text-sm text-amber-800" role="alert">{t("invalidPeriod")}</p> : null}
    </form>

    {!data ? <Card className="border-red-200 bg-red-50"><p className="text-sm text-red-800" role="alert">{t("queryError")}</p></Card> : <>
      <div className="flex flex-wrap gap-3">
        <a className="inline-flex min-h-11 items-center rounded-control border border-primary px-4 text-sm font-semibold !text-primary" href={`/${locale}/app/accounting/export/sales?${exportQuery}`}>{t("exports.sales")}</a>
        <a className="inline-flex min-h-11 items-center rounded-control border border-primary px-4 text-sm font-semibold !text-primary" href={`/${locale}/app/accounting/export/expenses?${exportQuery}`}>{t("exports.expenses")}</a>
        <p className="self-center text-xs text-muted">{t("exports.disclaimer")}</p>
      </div>

      {data.operational.length === 0 ? <EmptyState>{t("empty.summary")}</EmptyState> : data.operational.map((currency) => {
        const expense = data.expenseSummary.currencies.find((value) => value.currency === currency.currency);
        return <section className="space-y-4" key={currency.currency}>
          <div className="flex items-center justify-between gap-3"><h2 className="text-2xl font-semibold text-primary">{currency.currency}</h2>{data.operational.length > 1 ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{t("mixedCurrencies")}</span> : null}</div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <SummaryCard label={summaryText.netSales} value={formatCurrency(currency.salesNet, currency.currency, locale)} />
            <SummaryCard label={summaryText.collected} tone="success" value={formatCurrency(currency.collectedGross, currency.currency, locale)} />
            <SummaryCard label={summaryText.outstanding} tone="warning" value={formatCurrency(currency.outstanding, currency.currency, locale)} />
            <SummaryCard label={summaryText.refunds} tone="warning" value={formatCurrency(currency.refunds, currency.currency, locale)} />
            <SummaryCard label={summaryText.expenses} value={formatCurrency(currency.expensesTotal, currency.currency, locale)} />
            <SummaryCard label={summaryText.operationalResult} tone={currency.operationalResult >= 0 ? "success" : "critical"} value={formatCurrency(currency.operationalResult, currency.currency, locale)} />
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            <Card><h3 className="text-lg font-semibold text-primary">{sectionText.sales}</h3><dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between gap-3"><dt>{summaryText.netSales}</dt><dd>{formatCurrency(currency.salesNet, currency.currency, locale)}</dd></div><div className="flex justify-between gap-3"><dt>{summaryText.outstanding}</dt><dd>{formatCurrency(currency.outstanding, currency.currency, locale)}</dd></div></dl></Card>
            <Card><h3 className="text-lg font-semibold text-primary">{sectionText.cashflow}</h3><dl className="mt-3 space-y-2 text-sm">{[[summaryText.collected, currency.collectedGross], [summaryText.refunds, currency.refunds], [summaryText.netCollected, currency.collectedNet], [methodText.cash, currency.cashCollected], [methodText.card, currency.cardCollected], [summaryText.online, currency.onlineCollected], [methodText.bank_transfer, currency.bankTransferCollected], [methodText.other, currency.otherCollected]].map(([label, value]) => <div className="flex justify-between gap-3" key={String(label)}><dt>{label}</dt><dd>{formatCurrency(Number(value), currency.currency, locale)}</dd></div>)}</dl></Card>
            <Card><h3 className="text-lg font-semibold text-primary">{sectionText.expenses}</h3>{!expense ? <p className="mt-3 text-sm text-muted">{t("empty.expenses")}</p> : <div className="mt-3 space-y-4"><div><h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{sectionText.byCategory}</h4>{expense.byCategory.map((row) => <div className="mt-2 flex justify-between gap-3 text-sm" key={row.id ?? row.label}><span>{row.label}</span><span>{formatCurrency(row.totalGross, currency.currency, locale)}</span></div>)}</div><div><h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{sectionText.bySupplier}</h4>{expense.bySupplier.slice(0, 5).map((row) => <div className="mt-2 flex justify-between gap-3 text-sm" key={row.id ?? row.label}><span>{row.label}</span><span>{formatCurrency(row.totalGross, currency.currency, locale)}</span></div>)}</div><div><h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{sectionText.byLocation}</h4>{expense.byLocation.map((row) => <div className="mt-2 flex justify-between gap-3 text-sm" key={row.id ?? row.label}><span>{row.label}</span><span>{formatCurrency(row.totalGross, currency.currency, locale)}</span></div>)}</div></div>}</Card>
          </div>
        </section>;
      })}

      <section className="rounded-card border border-border bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold text-primary">{sectionText.activity}</h2><span className="rounded-full bg-primary-soft px-3 py-1 text-sm font-semibold text-primary">{data.activity.length}</span></div>{data.activity.length === 0 ? <div className="mt-4"><EmptyState>{t("empty.activity")}</EmptyState></div> : <div className="mt-4 divide-y divide-border">{data.activity.map((item) => <article className="grid gap-2 py-3 sm:grid-cols-[minmax(9rem,0.5fr)_minmax(12rem,1fr)_auto] sm:items-center" key={`${item.type}-${item.id}`}><div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">{activityTypes[item.type]}</p><p className="mt-1 text-xs text-muted">{dateTime(item.date, locale, data.timezone)}</p></div><div><p className="font-semibold">{item.reference}</p><p className="text-xs text-muted">{[item.customerName, item.locationName, item.paymentMethod ? methodText[item.paymentMethod] : null, item.expenseStatus].filter(Boolean).join(" · ") || "—"}</p></div><p className={`font-semibold tabular-nums sm:text-right ${item.type === "refund" || item.type === "expense" ? "text-amber-800" : "text-primary"}`}>{item.type === "refund" || item.type === "expense" ? "− " : ""}{formatCurrency(item.amount, item.currency, locale)}</p></article>)}</div>}</section>

      <AccountingManagement categories={data.categories} defaultCurrency={data.defaultCurrency} expenses={data.expenses} locale={locale} locations={data.locations} role={data.role as "owner" | "manager"} suppliers={data.suppliers} text={t.raw("management") as AccountingManagementText} />
      <p className="text-xs leading-5 text-muted">{t("boundary")}</p>
    </>}
  </div>;
}
