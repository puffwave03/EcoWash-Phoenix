import { getTranslations } from "next-intl/server";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/operational/OperationalUi";
import { saveProductionDefaultAssigneeAction } from "@/features/production-default/server/actions";
import { getProductionDefaultSettings } from "@/features/production-default/server/queries";
import { Link } from "@/i18n/navigation";
import { requireOwnerOrManager } from "@/lib/auth/require-role";

type ProductionSettingsPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ state?: string }>;
};

export default async function ProductionSettingsPage({ params, searchParams }: ProductionSettingsPageProps) {
  const { locale } = await params;
  await requireOwnerOrManager(locale);
  const [{ locations, staff }, t, { state }] = await Promise.all([
    getProductionDefaultSettings(locale),
    getTranslations({ locale, namespace: "common.productionDefaultAssignee" }),
    searchParams,
  ]);
  const eligibleIds = new Set(staff.map((person) => person.id));
  const stateKey = state && ["saved", "invalid", "invalidAssignee", "invalidLocation", "error"].includes(state)
    ? state as "saved" | "invalid" | "invalidAssignee" | "invalidLocation" | "error"
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        action={<Link className="inline-flex min-h-11 items-center font-semibold !text-primary hover:underline" href="/app/settings" locale={locale}>← {t("back")}</Link>}
        description={t("description")}
        eyebrow={t("eyebrow")}
        title={t("title")}
      />
      {stateKey ? (
        <p className={`rounded-control border p-3 text-sm font-semibold ${stateKey === "saved" ? "border-green-300 bg-green-50 text-green-900" : "border-amber-300 bg-amber-50 text-amber-900"}`} role="status">
          {t(`states.${stateKey}`)}
        </p>
      ) : null}
      {locations.length === 0 ? <p className="text-sm text-muted">{t("noLocations")}</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {locations.map((location) => (
          <Card className="space-y-4 bg-white" key={location.id}>
            <h2 className="text-lg font-semibold text-primary">{location.name}</h2>
            {location.default_production_assignee_id && !eligibleIds.has(location.default_production_assignee_id) ? (
              <p className="text-sm text-amber-800" role="status">{t("staleAssignee")}</p>
            ) : null}
            <form action={saveProductionDefaultAssigneeAction.bind(null, locale)} className="space-y-3">
              <input name="locationId" type="hidden" value={location.id} />
              <label className="block text-sm font-semibold text-primary" htmlFor={`default-production-${location.id}`}>{t("label")}</label>
              <select
                className="min-h-11 w-full rounded-control border border-border bg-white px-3 text-sm text-foreground"
                defaultValue={location.default_production_assignee_id && eligibleIds.has(location.default_production_assignee_id)
                  ? location.default_production_assignee_id : ""}
                id={`default-production-${location.id}`}
                name="profileId"
              >
                <option value="">{t("none")}</option>
                {staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
              <button className="min-h-11 rounded-control bg-primary px-4 text-sm font-semibold text-white" type="submit">{t("save")}</button>
            </form>
          </Card>
        ))}
      </div>
    </div>
  );
}
