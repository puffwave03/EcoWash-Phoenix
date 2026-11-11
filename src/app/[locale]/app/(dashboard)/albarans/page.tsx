import { getTranslations } from "next-intl/server";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState, PageHeader, StatusBadge } from "@/components/operational/OperationalUi";
import { albaranRegisterHref, type AlbaranRegisterParams } from "@/features/service-albarans/register";
import { listServiceAlbaranRegister } from "@/features/service-albarans/server/register-queries";
import { Link } from "@/i18n/navigation";
import { formatOrganizationDateTime } from "@/lib/organization-timezone";

export default async function ServiceAlbaranRegisterPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<AlbaranRegisterParams>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const [history, t] = await Promise.all([
    listServiceAlbaranRegister(locale, query),
    getTranslations({ locale, namespace: "common.serviceAlbarans" }),
  ]);
  const { filters } = history;
  const inputClass = "min-h-11 w-full min-w-0 rounded-control border border-border bg-white px-3";
  const linkClass = "inline-flex min-h-11 items-center justify-center rounded-control border border-border px-4 text-sm font-semibold !text-primary hover:bg-primary-soft";

  return <div className="space-y-6">
    <PageHeader title={t("register.title")} description={t("register.description")} />
    <Card>
      <form method="get" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_auto]">
        <label className="min-w-0 space-y-2 text-sm font-semibold text-primary"><span>{t("register.search")}</span><input className={inputClass} name="q" defaultValue={filters.query} maxLength={120} placeholder={t("register.searchPlaceholder")} /></label>
        <label className="space-y-2 text-sm font-semibold text-primary"><span>{t("register.status")}</span><select className={inputClass} name="status" defaultValue={filters.status}>
          <option value="all">{t("register.all")}</option><option value="issued">{t("issued")}</option><option value="cancelled">{t("cancelled")}</option>
        </select></label>
        <label className="space-y-2 text-sm font-semibold text-primary"><span>{t("register.from")}</span><input className={inputClass} type="date" name="from" defaultValue={filters.from} /></label>
        <label className="space-y-2 text-sm font-semibold text-primary"><span>{t("register.to")}</span><input className={inputClass} type="date" name="to" defaultValue={filters.to} /></label>
        <div className="flex flex-wrap items-end gap-3"><Button type="submit" variant="secondary">{t("register.apply")}</Button><Link href="/app/albarans" locale={locale} className={linkClass}>{t("register.clear")}</Link></div>
      </form>
      <p className="mt-3 text-xs text-muted">{t("register.timeZone", { timeZone: history.timeZone })}</p>
    </Card>
    {history.state !== "ready" ? <Card className="border-amber-200 bg-amber-50">
      <p role="alert" className="text-sm font-semibold text-amber-900">{t(history.state === "invalidFilters" ? "register.invalidDates" : "register.unavailable")}</p>
      <Link className={`${linkClass} mt-3`} href={albaranRegisterHref(filters)} locale={locale}>{t("register.reload")}</Link>
    </Card> : <>
      <p role="status" className="text-sm text-muted">{t("register.results", { count: history.count })}</p>
      {history.items.length === 0 ? <EmptyState>{t("register.empty")}</EmptyState> : <div className="space-y-3">
        {history.items.map((row) => <article key={row.id} className="grid gap-4 rounded-card border border-border bg-white p-4 shadow-card md:grid-cols-[1.2fr_1.2fr_1fr_auto] md:items-center sm:p-5">
          <div className="min-w-0">
            <Link className="break-words text-lg font-semibold !text-primary hover:underline" href={`/app/orders/${row.order_id}/albarans/${row.id}/print`} locale={locale}>{row.document_number}</Link>
            <p className="mt-1 text-sm text-muted">{t("issuedAt")}: {formatOrganizationDateTime(row.issued_at, locale, history.timeZone)}</p>
          </div>
          <dl className="min-w-0 space-y-1 text-sm">
            <div><dt className="text-xs text-muted">{t("customer")}</dt><dd className="break-words font-semibold">{row.customer_name}</dd></div>
            <div><dt className="text-xs text-muted">{t("property")}</dt><dd className="break-words">{row.property_name ?? "—"}</dd></div>
            <div><dt className="text-xs text-muted">{t("register.location")}</dt><dd className="break-words">{row.location_name}</dd></div>
          </dl>
          <div className="min-w-0 space-y-2">
            <Link className="break-words text-sm font-semibold !text-primary underline" href={`/app/orders/${row.order_id}`} locale={locale}>{t("order")}: {row.order_number}</Link>
            <div><StatusBadge tone={row.document_status === "issued" ? "success" : "neutral"}>{t(row.document_status)}</StatusBadge></div>
          </div>
          <Link className={linkClass} href={`/app/orders/${row.order_id}/albarans/${row.id}/print`} locale={locale}>{t("register.openA4")}</Link>
        </article>)}
      </div>}
      <nav aria-label={t("register.pagination")} className="flex flex-wrap items-center gap-3">
        {history.page > 1 ? <Link className={linkClass} href={albaranRegisterHref(filters, history.page - 1)} locale={locale}>{t("register.previous")}</Link> : null}
        <span className="text-sm text-muted">{t("register.page", { page: history.page, pages: history.pages })}</span>
        {history.page < history.pages ? <Link className={linkClass} href={albaranRegisterHref(filters, history.page + 1)} locale={locale}>{t("register.next")}</Link> : null}
      </nav>
    </>}
  </div>;
}
