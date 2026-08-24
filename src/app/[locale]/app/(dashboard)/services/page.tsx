import { getTranslations } from "next-intl/server";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ServiceList } from "@/components/services/ServiceList";
import { Link } from "@/i18n/navigation";
import { canEditCatalog } from "@/features/orders/workflow";
import { listServices } from "@/features/services/server/queries";
import { parseServiceStatusFilter } from "@/features/services/validation";
import { requireMembership } from "@/lib/auth/require-membership";

type ServicesPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; status?: string }>;
};

export default async function ServicesPage({ params, searchParams }: ServicesPageProps) {
  const { locale } = await params;
  const { q = "", status = "active" } = await searchParams;
  const [access, t, catalogT] = await Promise.all([
    requireMembership(locale),
    getTranslations({ locale, namespace: "common.services" }),
    getTranslations({ locale, namespace: "common.catalog" }),
  ]);
  const services = (await listServices(locale, parseServiceStatusFilter(status))).filter((service) => {
    const query = q.trim().toLocaleLowerCase(locale);
    return !query || [service.name, service.code, service.category].some((value) => value?.toLocaleLowerCase(locale).includes(query));
  });
  const canManage = canEditCatalog(access.membership.role);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-primary">{t("title")}</h2>
          <p className="mt-2 text-sm text-muted">{t("description")}</p>
        </div>
        {canManage ? (
          <Link href="/app/services/new" locale={locale}>
            <Button>{t("newService")}</Button>
          </Link>
        ) : null}
      </div>
      <Card>
        <form className="grid gap-4 md:grid-cols-[minmax(16rem,1fr)_12rem_auto]">
          <label className="space-y-2 text-sm font-semibold text-primary">
            <span>{catalogT("search")}</span>
            <input className="min-h-11 w-full rounded-control border border-border px-3 text-sm" defaultValue={q} name="q" placeholder={catalogT("searchPlaceholder")} />
          </label>
          <label className="space-y-2 text-sm font-semibold text-primary">
            <span>{t("status")}</span>
            <select className="min-h-11 w-full rounded-control border border-border px-3 text-sm" defaultValue={status} name="status">
              <option value="active">{t("active")}</option>
              <option value="inactive">{t("inactive")}</option>
              <option value="all">{t("all")}</option>
            </select>
          </label>
          <div className="flex items-end"><Button type="submit">{t("filter")}</Button></div>
        </form>
      </Card>
      <ServiceList
        canManage={canManage}
        locale={locale}
        services={services}
        text={{
          active: t("active"),
          edit: t("edit"),
          empty: t("empty"),
          inactive: t("inactive"),
          categoryLabels: catalogT.raw("categories") as Record<string, string>,
          fromPrice: catalogT("fromPrice"),
          price: t("price"),
          service: t("service"),
          unitTypes: catalogT.raw("unitTypes") as Record<import("@/features/services/types").ServiceUnitType, string>,
        }}
      />
    </div>
  );
}
