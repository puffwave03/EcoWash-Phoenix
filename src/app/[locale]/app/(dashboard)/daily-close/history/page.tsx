import { getTranslations } from "next-intl/server";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/operational/OperationalUi";
import { listPersistedDailyCloses } from "@/features/daily-close/server/persisted-queries";
import { Link } from "@/i18n/navigation";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function formatDateTime(value: string, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

export default async function DailyCloseHistoryPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string; scope?: string }>;
}) {
  const { locale } = await params;
  const [query, t] = await Promise.all([
    searchParams,
    getTranslations({ locale, namespace: "common.dailyClose.history" }),
  ]);
  const businessDate = DATE_PATTERN.test(query.date ?? "") ? query.date : undefined;
  const locationId = query.scope === "organization" || UUID_PATTERN.test(query.scope ?? "")
    ? query.scope as string
    : undefined;
  const history = await listPersistedDailyCloses(locale, { businessDate, locationId });

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
            <input className="min-h-12 w-full rounded-control border border-border bg-white px-3" defaultValue={businessDate} name="date" type="date" />
          </label>
          <label className="space-y-2 text-sm font-semibold text-primary">
            <span>{t("scope")}</span>
            <select className="min-h-12 w-full rounded-control border border-border bg-white px-3" defaultValue={locationId ?? ""} name="scope">
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
    </div>
  );
}
