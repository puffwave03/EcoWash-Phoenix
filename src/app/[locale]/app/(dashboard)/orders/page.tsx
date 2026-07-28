import { getTranslations } from "next-intl/server";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { OrderList } from "@/components/orders/OrderList";
import { Link } from "@/i18n/navigation";
import { listOrders } from "@/features/orders/server/queries";
import { parseOrderFilters } from "@/features/orders/validation";

type OrdersPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ active?: string; priority?: string; q?: string; status?: string }>;
};

export default async function OrdersPage({ params, searchParams }: OrdersPageProps) {
  const { locale } = await params;
  const rawFilters = await searchParams;
  const filters = parseOrderFilters(rawFilters);
  const [orders, t] = await Promise.all([
    listOrders(locale, filters),
    getTranslations({ locale, namespace: "common.orders" }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-primary">{t("title")}</h2>
          <p className="mt-2 text-sm text-muted">{t("description")}</p>
        </div>
        <Link href="/app/orders/new" locale={locale}>
          <Button>{t("newOrder")}</Button>
        </Link>
      </div>

      <Card>
        <form className="grid gap-4 md:grid-cols-[1fr_12rem_12rem_12rem_auto]">
          <label className="space-y-2 text-sm font-semibold text-primary">
            <span>{t("search")}</span>
            <input className="min-h-11 w-full rounded-control border border-border px-3 text-sm" defaultValue={filters.query} name="q" placeholder={t("searchPlaceholder")} />
          </label>
          <label className="space-y-2 text-sm font-semibold text-primary">
            <span>{t("status")}</span>
            <select className="min-h-11 w-full rounded-control border border-border px-3 text-sm" defaultValue={filters.status} name="status">
              <option value="all">{t("all")}</option>
              {Object.entries(t.raw("statuses") as Record<string, string>).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label className="space-y-2 text-sm font-semibold text-primary">
            <span>{t("priority")}</span>
            <select className="min-h-11 w-full rounded-control border border-border px-3 text-sm" defaultValue={filters.priority} name="priority">
              <option value="all">{t("all")}</option>
              <option value="normal">{t("priorities.normal")}</option>
              <option value="express">{t("priorities.express")}</option>
            </select>
          </label>
          <label className="space-y-2 text-sm font-semibold text-primary">
            <span>{t("activeState")}</span>
            <select className="min-h-11 w-full rounded-control border border-border px-3 text-sm" defaultValue={filters.active} name="active">
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
        orders={orders}
        text={{
          created: t("created"),
          customer: t("customer"),
          due: t("due"),
          empty: t("empty"),
          order: t("order"),
          priority: t("priority"),
          property: t("property"),
          status: t("status"),
          total: t("total"),
          view: t("view"),
        }}
      />
    </div>
  );
}
