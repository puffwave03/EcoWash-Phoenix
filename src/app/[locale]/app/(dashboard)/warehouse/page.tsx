import { getTranslations } from "next-intl/server";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/operational/OperationalUi";
import { listCurrentWarehouseOverview } from "@/features/warehouse/server/overview-queries";
import { filterCurrentStoredOrders, POSITION_TYPES, STORAGE_MODES, summarizeCurrentWarehouse } from "@/features/warehouse/overview";
import type { ProductionStatus } from "@/features/orders/types";
import type { OrderStorageMode, WarehousePositionType } from "@/features/warehouse/types";
import { Link } from "@/i18n/navigation";
import { formatOrganizationDateTime } from "@/lib/organization-timezone";

type SearchParams = { q?: string; location?: string; position?: string; mode?: string };
type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
};

const controlClass = "min-h-11 w-full rounded-control border border-border bg-white px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft";

export default async function WarehouseOverviewPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const raw = await searchParams;
  const filters = {
    query: (raw.q ?? "").trim().slice(0, 120),
    locationId: raw.location ?? "",
    positionId: raw.position ?? "",
    storageMode: raw.mode ?? "",
  };
  const [data, t, ordersT] = await Promise.all([
    listCurrentWarehouseOverview(locale),
    getTranslations({ locale, namespace: "common.warehouseOverview" }),
    getTranslations({ locale, namespace: "common.orders" }),
  ]);
  const overview = summarizeCurrentWarehouse(data.positions, data.locations, data.orders);
  const filteredOrders = filterCurrentStoredOrders(data.orders, filters);
  const visiblePositions = overview.positions.filter((position) =>
    !filters.locationId || position.locationId === filters.locationId);
  const positionsById = new Map(overview.positions.map((position) => [position.id, position]));
  const typeLabels = t.raw("types") as Record<WarehousePositionType, string>;
  const modeLabels = t.raw("modes") as Record<OrderStorageMode, string>;
  const statusLabels = ordersT.raw("statuses") as Record<ProductionStatus, string>;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />

      <section aria-label={t("summary")} className="grid gap-3 sm:grid-cols-2">
        <Card className="bg-white/95"><p className="text-sm text-muted">{t("totalOrders")}</p><p className="mt-1 text-3xl font-black text-primary">{overview.totalOrders}</p></Card>
        <Card className="bg-white/95"><p className="text-sm text-muted">{t("totalPackages")}</p><p className="mt-1 text-3xl font-black text-primary">{overview.totalPackages}</p></Card>
      </section>
      <Card className="bg-white/95">
        <h2 className="font-semibold text-primary">{t("byType")}</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {POSITION_TYPES.map((type) => <div className="rounded-control bg-primary-soft/50 p-3" key={type}><dt className="text-sm text-muted">{typeLabels[type]}</dt><dd className="text-xl font-bold text-primary">{overview.ordersByType[type]}</dd></div>)}
        </dl>
      </Card>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-primary">{t("positions")}</h2>
        {visiblePositions.length === 0 ? <p className="text-sm text-muted">{t("emptyPositions")}</p> : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visiblePositions.map((position) => (
              <Link className={`rounded-card border p-4 shadow-sm transition-standard hover:border-primary/40 hover:bg-primary-soft/30 ${position.orderCount === 0 ? "border-border bg-white/65" : "border-primary/20 bg-white"}`} href={`/app/warehouse?position=${encodeURIComponent(position.id)}#stored-orders`} key={position.id} locale={locale}>
                <div className="flex items-start justify-between gap-2"><div><p className="font-bold text-primary">{position.code}{position.name ? ` · ${position.name}` : ""}</p><p className="text-sm text-muted">{position.locationName} · {typeLabels[position.positionType]}</p></div><span className={`rounded-full px-2 py-1 text-xs font-semibold ${position.isActive ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>{position.isActive ? t("active") : t("inactive")}</span></div>
                {position.isDefaultInbound ? <span className="mt-2 inline-flex rounded-full bg-primary-soft px-2 py-1 text-xs font-semibold text-primary">{t("defaultInbound")}</span> : null}
                <p className="mt-3 text-sm text-foreground">{t("positionCounts", { orders: position.orderCount, packages: position.packageCount })}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3" id="stored-orders">
        <h2 className="text-xl font-bold text-primary">{t("storedOrders")}</h2>
        <Card className="bg-white/95">
          <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(10rem,1fr)_repeat(3,minmax(9rem,12rem))_auto]">
            <label className="space-y-1 text-sm font-semibold text-primary"><span>{t("search")}</span><input className={controlClass} defaultValue={filters.query} name="q" placeholder={t("searchPlaceholder")} /></label>
            <label className="space-y-1 text-sm font-semibold text-primary"><span>{t("location")}</span><select className={controlClass} defaultValue={filters.locationId} name="location"><option value="">{t("allLocations")}</option>{data.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
            <label className="space-y-1 text-sm font-semibold text-primary"><span>{t("position")}</span><select className={controlClass} defaultValue={filters.positionId} name="position"><option value="">{t("allPositions")}</option>{overview.positions.map((position) => <option key={position.id} value={position.id}>{position.code}{position.name ? ` · ${position.name}` : ""} · {position.locationName}</option>)}</select></label>
            <label className="space-y-1 text-sm font-semibold text-primary"><span>{t("storageMode")}</span><select className={controlClass} defaultValue={filters.storageMode} name="mode"><option value="">{t("allModes")}</option>{STORAGE_MODES.map((mode) => <option key={mode} value={mode}>{modeLabels[mode]}</option>)}</select></label>
            <div className="flex items-end gap-2"><button className="min-h-11 rounded-control bg-primary px-4 text-sm font-semibold text-white" type="submit">{t("filter")}</button><Link className="text-sm font-semibold !text-primary underline" href="/app/warehouse" locale={locale}>{t("clear")}</Link></div>
          </form>
        </Card>
        <p className="text-sm text-muted">{t("results", { count: filteredOrders.length })}</p>
        {filteredOrders.length === 0 ? <p className="text-sm text-muted">{t("emptyOrders")}</p> : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredOrders.map((order) => {
              const position = positionsById.get(order.positionId);
              return <Link className="rounded-card border border-border bg-white p-4 shadow-sm transition-standard hover:border-primary/40 hover:bg-primary-soft/30" href={`/app/orders/${order.orderId}`} key={order.orderId} locale={locale}>
                <div className="flex items-start justify-between gap-2"><div><p className="font-bold text-primary">{order.orderNumber}</p><p className="text-sm text-muted">{order.customerName}</p></div><span className="rounded-full bg-primary-soft px-2 py-1 text-xs font-semibold text-primary">{statusLabels[order.productionStatus]}</span></div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm"><div><dt className="text-muted">{t("position")}</dt><dd className="font-semibold text-foreground">{position?.code}{position?.name ? ` · ${position.name}` : ""}</dd></div><div><dt className="text-muted">{t("packageCount")}</dt><dd className="font-semibold text-foreground">{order.packageCount}</dd></div><div><dt className="text-muted">{t("storageMode")}</dt><dd className="font-semibold text-foreground">{modeLabels[order.storageMode]}</dd></div><div><dt className="text-muted">{t("enteredAt")}</dt><dd className="font-semibold text-foreground">{formatOrganizationDateTime(order.enteredAt, locale, data.timeZone)}</dd></div></dl>
              </Link>;
            })}
          </div>
        )}
      </section>
    </div>
  );
}
