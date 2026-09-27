import { getTranslations } from "next-intl/server";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/operational/OperationalUi";
import { OrderList } from "@/components/orders/OrderList";
import { Link } from "@/i18n/navigation";
import { listOrders } from "@/features/orders/server/queries";
import type { OrderDisplayStatus } from "@/features/orders/display-status";
import { parseOrderFilters } from "@/features/orders/validation";
import { requireMembership } from "@/lib/auth/require-membership";

type OrdersPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ active?: string; priority?: string; q?: string; status?: string }>;
};

export default async function OrdersPage({ params, searchParams }: OrdersPageProps) {
  const { locale } = await params;
  const rawFilters = await searchParams;
  const filters = parseOrderFilters(rawFilters);
  const [orderData, t, navT, access] = await Promise.all([
    listOrders(locale, filters),
    getTranslations({ locale, namespace: "common.orders" }),
    getTranslations({ locale, namespace: "common.auth.dashboard" }),
    requireMembership(locale),
  ]);
  const canViewWarehouse = access.membership.role === "owner" || access.membership.role === "manager";

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        action={<div className="flex flex-wrap gap-2">
          {canViewWarehouse ? <Link className="inline-flex min-h-11 items-center rounded-control border border-primary px-4 font-semibold !text-primary" href="/app/warehouse" locale={locale}>{navT("warehouse")}</Link> : null}
          <Link href="/app/orders/new" locale={locale}><Button>{t("newOrder")}</Button></Link>
        </div>}
      />

      <Card className="bg-white/95">
        <form className="grid gap-4 md:grid-cols-[1fr_12rem_12rem_12rem_auto]">
          <label className="space-y-2 text-sm font-semibold text-primary">
            <span>{t("search")}</span>
            <input className="min-h-11 w-full rounded-control border border-border bg-white px-3 text-sm shadow-sm transition-standard focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft" defaultValue={filters.query} name="q" placeholder={t("searchPlaceholder")} />
          </label>
          <label className="space-y-2 text-sm font-semibold text-primary">
            <span>{t("productionStatus")}</span>
            <select className="min-h-11 w-full rounded-control border border-border bg-white px-3 text-sm shadow-sm transition-standard focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft" defaultValue={filters.status} name="status">
              <option value="all">{t("all")}</option>
              {Object.entries(t.raw("statuses") as Record<string, string>).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label className="space-y-2 text-sm font-semibold text-primary">
            <span>{t("priority")}</span>
            <select className="min-h-11 w-full rounded-control border border-border bg-white px-3 text-sm shadow-sm transition-standard focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft" defaultValue={filters.priority} name="priority">
              <option value="all">{t("all")}</option>
              <option value="normal">{t("priorities.normal")}</option>
              <option value="express">{t("priorities.express")}</option>
            </select>
          </label>
          <label className="space-y-2 text-sm font-semibold text-primary">
            <span>{t("activeState")}</span>
            <select className="min-h-11 w-full rounded-control border border-border bg-white px-3 text-sm shadow-sm transition-standard focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft" defaultValue={filters.active} name="active">
              <option value="active">{t("active")}</option>
              <option value="cancelled">{t("statuses.cancelled")}</option>
              <option value="all">{t("all")}</option>
            </select>
          </label>
          <div className="flex items-end"><Button type="submit">{t("filter")}</Button></div>
        </form>
      </Card>

      <OrderList
        locale={locale}
        orders={orderData.orders}
        text={{
          created: t("created"),
          customer: t("customer"),
          due: t("due"),
          empty: t("empty"),
          lifecycleAnomaly: t("lifecycleAnomaly"),
          order: t("order"),
          priority: t("priority"),
          property: t("property"),
          status: t("status"),
          statuses: {
            ...(t.raw("statuses") as Record<string, string>),
            ...(t.raw("displayStatuses") as Record<string, string>),
          } as Record<OrderDisplayStatus, string>,
          total: t("total"),
          view: t("view"),
        }}
        timeZone={orderData.timeZone}
      />
    </div>
  );
}
