import { getTranslations } from "next-intl/server";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/operational/OperationalUi";
import { dailyCloseHistoryHref, normalizeDailyCloseHistoryFilters } from "@/features/daily-close/pagination";
import { listPersistedDailyCloses } from "@/features/daily-close/server/persisted-queries";
import { Link } from "@/i18n/navigation";

function formatDateTime(value: string, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

export default async function DailyCloseHistoryPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ cursor?: string; date?: string; scope?: string }>;
}) {
  const { locale } = await params;
  const [query, t] = await Promise.all([
    searchParams,
    getTranslations({ locale, namespace: "common.dailyClose.history" }),
  ]);
  const filters = normalizeDailyCloseHistoryFilters({ businessDate: query.date, locationId: query.scope });
  const history = await listPersistedDailyCloses(locale, filters, query.cursor);

  return (
    <div className="space-y-6">
      <PageHeader
        action={<Link className="inline-flex min-h-11 w-full items-center justify-center rounded-control border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary hover:text-white sm:w-auto" href="/app/daily-close" locale={locale}>{t("back")}</Link>}
        description={t("description")}
        title={t("title")}
      />
      <Card>
        <form className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end" method="get">
          <label className="space-y-2 text-sm font-semibold text-primary">
            <span>{t("businessDate")}</span>
            <input className="min-h-12 w-full rounded-control border border-border bg-white px-3" defaultValue={filters.businessDate} name="date" type="date" />
          </label>
          <label className="space-y-2 text-sm font-semibold text-primary">
            <span>{t("scope")}</span>
            <select className="min-h-12 w-full rounded-control border border-border bg-white px-3" defaultValue={filters.locationId ?? ""} name="scope">
              <option value="">{t("allScopes")}</option>
              {history.hasOrganizationScope ? <option value="organization">{t("organizationWide")}</option> : null}
              {history.scopes.map((scope) => <option key={scope.id} value={scope.id}>{scope.name}</option>)}
            </select>
          </label>
          <button className="min-h-12 rounded-control bg-primary px-5 text-sm font-semibold text-white" type="submit">{t("apply")}</button>
        </form>
      </Card>
      {history.closes.length === 0 ? (
        <Card className="border-dashed bg-[#fafbfa] text-center text-sm text-muted">{t("empty")}</Card>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-white shadow-card">
          {history.closes.map((close) => (
            <article className="grid gap-4 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-center sm:p-5" key={close.id}>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("businessDate")}</p>
                <p className="mt-1 text-lg font-semibold text-primary">{close.businessDate}</p>
                <p className="mt-1 truncate text-sm text-muted">{close.locationName ?? t("organizationWide")}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("closedAt")}</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{formatDateTime(close.closedAt, locale, close.tenantTimezone)}</p>
                <p className="mt-1 truncate text-sm text-muted">{close.closeNote || t("noNote")}</p>
              </div>
              <Link className="inline-flex min-h-11 w-full items-center justify-center rounded-control border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary hover:text-white sm:w-auto" href={`/app/daily-close/history/${close.id}`} locale={locale}>{t("view")}</Link>
            </article>
          ))}
        </div>
      )}
      <nav aria-label={t("navigation")} className="flex flex-wrap gap-3">
        {history.pagination.newerCursor ? <Link className="inline-flex min-h-11 items-center rounded-control border border-border px-4 text-sm font-semibold" href={dailyCloseHistoryHref(filters, history.pagination.newerCursor)} locale={locale}>{t("newer")}</Link> : null}
        {history.pagination.olderCursor ? <Link className="inline-flex min-h-11 items-center rounded-control border border-border px-4 text-sm font-semibold" href={dailyCloseHistoryHref(filters, history.pagination.olderCursor)} locale={locale}>{t("older")}</Link> : null}
        {query.cursor ? <Link className="inline-flex min-h-11 items-center px-4 text-sm font-semibold underline" href={dailyCloseHistoryHref(filters)} locale={locale}>{t("latest")}</Link> : null}
      </nav>
    </div>
  );
}
