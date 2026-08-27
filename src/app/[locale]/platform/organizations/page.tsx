import { getTranslations } from "next-intl/server";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { listPlatformOrganizations } from "@/features/platform-admin/server/queries";
import { Link } from "@/i18n/navigation";

export default async function PlatformOrganizationsPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ search?: string; status?: string }>;
}) {
  const [{ locale }, filters] = await Promise.all([params, searchParams]);
  const status = filters.status === "active" || filters.status === "suspended" ? filters.status : undefined;
  const [organizations, t] = await Promise.all([
    listPlatformOrganizations(locale, { search: filters.search, status }),
    getTranslations({ locale, namespace: "common.platform" }),
  ]);
  const formatDate = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value));
  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">{t("organizations.eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-semibold text-primary">{t("organizations.title")}</h1>
      </header>
      <Card className="bg-white">
        <form className="grid gap-3 sm:grid-cols-[1fr_220px_auto]" method="get">
          <input aria-label={t("organizations.search")} className="min-h-11 rounded-control border border-border px-3" defaultValue={filters.search ?? ""} name="search" placeholder={t("organizations.search")} />
          <select aria-label={t("organizations.filter")} className="min-h-11 rounded-control border border-border bg-white px-3" defaultValue={status ?? ""} name="status">
            <option value="">{t("organizations.all")}</option>
            <option value="active">{t("status.active")}</option>
            <option value="suspended">{t("status.suspended")}</option>
          </select>
          <Button type="submit">{t("organizations.apply")}</Button>
        </form>
      </Card>
      <div className="overflow-hidden rounded-card border border-border bg-white shadow-card">
        <div className="hidden grid-cols-[minmax(240px,1fr)_130px_140px_100px_120px] gap-4 border-b border-border bg-[#f8faf9] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted md:grid">
          <span>{t("organizations.columns.organization")}</span><span>{t("organizations.columns.status")}</span><span>{t("organizations.columns.plan")}</span><span>{t("organizations.columns.features")}</span><span>{t("organizations.columns.created")}</span>
        </div>
        {organizations.length === 0 ? <p className="p-8 text-center text-sm text-muted">{t("organizations.empty")}</p> : organizations.map((organization) => (
          <Link className="grid gap-3 border-b border-border px-5 py-4 last:border-b-0 hover:bg-primary-soft/40 md:grid-cols-[minmax(240px,1fr)_130px_140px_100px_120px] md:items-center" href={`/platform/organizations/${organization.id}`} key={organization.id} locale={locale}>
            <div><p className="font-semibold text-primary">{organization.name}</p><p className="mt-1 text-xs text-muted">{organization.memberCount} {t("organizations.members")} · {organization.locationCount} {t("organizations.locations")}</p></div>
            <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${organization.serviceStatus === "active" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{t(`status.${organization.serviceStatus}`)}</span>
            <span className="text-sm text-muted">{organization.commercialPlanLabel ?? t("organizations.noPlan")}</span>
            <span className="text-sm font-semibold tabular-nums text-primary">{organization.enabledFeatureCount}</span>
            <span className="text-sm text-muted">{formatDate(organization.createdAt)}</span>
          </Link>
        ))}
      </div>
      <p className="text-xs text-muted">{t("organizations.limitNote")}</p>
    </div>
  );
}
