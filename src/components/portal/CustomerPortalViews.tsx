"use client";

/* eslint-disable @next/next/no-img-element */
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/Card";
import type { FulfillmentStatus } from "@/features/logistics/types";
import type { OrderPhoto } from "@/features/order-photos/types";
import type {
  CustomerPortalLogistics,
  CustomerPortalNextTask,
  CustomerPortalOrder,
  CustomerPortalOrderDetail,
} from "@/features/portal/types";
import type { ProductionStatus } from "@/features/orders/types";

type StatusText = Record<ProductionStatus, string>;
type FulfillmentText = Record<FulfillmentStatus, string>;

type PortalCommonText = {
  completed: string;
  delivery: string;
  emptyOrders: string;
  history: string;
  nextTask: string;
  orderDate: string;
  orderReceived: string;
  orders: string;
  photos: string;
  pickup: string;
  property: string;
  ready: string;
  status: string;
};

type PortalOverviewProps = {
  activeOrders: CustomerPortalOrder[];
  locale: string;
  nextTask: CustomerPortalNextTask | null;
  statusLabels: StatusText;
  text: PortalCommonText & {
    activeOrders: string;
    greeting: string;
    historyLink: string;
  };
};

type PortalOrderListProps = {
  locale: string;
  orders: CustomerPortalOrder[];
  statusLabels: StatusText;
  text: PortalCommonText;
};

type PortalOrderDetailProps = {
  fulfillmentLabels: FulfillmentText;
  locale: string;
  order: CustomerPortalOrderDetail;
  statusLabels: StatusText;
  text: PortalCommonText & {
    items: string;
    noPhotos: string;
  };
};

function formatDate(value: string | null, locale: string) {
  if (!value) return "-";

  return new Date(value).toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function OrderCard({
  locale,
  order,
  statusLabels,
  text,
}: {
  locale: string;
  order: CustomerPortalOrder;
  statusLabels: StatusText;
  text: PortalCommonText;
}) {
  return (
    <Link
      className="block rounded-card border border-border bg-white p-4 shadow-card transition-standard hover:border-primary"
      href={`/portal/orders/${order.id}`}
      locale={locale}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
            {order.orderNumber}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-primary">
            {statusLabels[order.productionStatus]}
          </h3>
        </div>
        <span className="rounded-control bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
          {text.status}
        </span>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">{text.orderDate}</dt>
          <dd className="font-semibold text-primary">{formatDate(order.createdAt, locale)}</dd>
        </div>
        <div>
          <dt className="text-muted">{text.property}</dt>
          <dd className="font-semibold text-primary">{order.propertyName ?? "-"}</dd>
        </div>
      </dl>
    </Link>
  );
}

function LogisticsSummary({
  fulfillmentLabels,
  logistics,
  locale,
  text,
}: {
  fulfillmentLabels: FulfillmentText;
  logistics: CustomerPortalLogistics;
  locale: string;
  text: PortalCommonText;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {(["pickup", "delivery"] as const).map((kind) => {
        const record = logistics[kind];

        return (
          <Card className="space-y-3" key={kind}>
            <h3 className="text-lg font-semibold text-primary">
              {kind === "pickup" ? text.pickup : text.delivery}
            </h3>
            {record ? (
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-muted">{text.status}</dt>
                  <dd className="font-semibold text-primary">{fulfillmentLabels[record.status]}</dd>
                </div>
                <div>
                  <dt className="text-muted">{text.orderDate}</dt>
                  <dd className="font-semibold text-primary">{formatDate(record.scheduledAt, locale)}</dd>
                </div>
                <div>
                  <dt className="text-muted">{text.property}</dt>
                  <dd className="font-semibold text-primary">
                    {[record.addressLine1, record.city, record.postalCode].filter(Boolean).join(", ") || "-"}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-muted">-</p>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function PhotoGrid({
  photos,
  text,
}: {
  photos: OrderPhoto[];
  text: PortalOrderDetailProps["text"];
}) {
  if (photos.length === 0) {
    return <p className="rounded-card border border-border bg-white p-4 text-sm text-muted">{text.noPhotos}</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {photos.map((photo) => (
        <div className="overflow-hidden rounded-card border border-border bg-white shadow-card" key={photo.id}>
          {photo.signedUrl ? (
            <img alt={photo.caption || text.photos} className="aspect-[4/3] w-full object-cover" src={photo.signedUrl} />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center bg-secondary-soft text-sm text-muted">
              {text.photos}
            </div>
          )}
          {photo.caption ? <p className="p-4 text-sm text-muted">{photo.caption}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function CustomerPortalOverview({
  activeOrders,
  locale,
  nextTask,
  statusLabels,
  text,
}: PortalOverviewProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-card bg-[#09291f] p-5 text-white shadow-card lg:p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">
          {text.greeting}
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">{text.activeOrders}</h2>
        <p className="mt-3 text-sm text-white/72">{activeOrders.length} {text.orders}</p>
      </section>

      {nextTask ? (
        <Card className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">{text.nextTask}</p>
          <Link className="text-lg font-semibold text-primary hover:underline" href={`/portal/orders/${nextTask.orderId}`} locale={locale}>
            {nextTask.orderNumber}
          </Link>
          <p className="text-sm text-muted">
            {nextTask.kind === "pickup" ? text.pickup : text.delivery} · {formatDate(nextTask.scheduledAt, locale)}
          </p>
        </Card>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xl font-semibold text-primary">{text.activeOrders}</h3>
          <Link className="text-sm font-semibold text-primary hover:underline" href="/portal/orders" locale={locale}>
            {text.historyLink}
          </Link>
        </div>
        {activeOrders.length === 0 ? (
          <p className="rounded-card border border-border bg-white p-4 text-sm text-muted">{text.emptyOrders}</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {activeOrders.slice(0, 4).map((order) => (
              <OrderCard key={order.id} locale={locale} order={order} statusLabels={statusLabels} text={text} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function CustomerPortalOrderList({
  locale,
  orders,
  statusLabels,
  text,
}: PortalOrderListProps) {
  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-semibold text-primary">{text.orders}</h2>
      {orders.length === 0 ? (
        <p className="rounded-card border border-border bg-white p-4 text-sm text-muted">{text.emptyOrders}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {orders.map((order) => (
            <OrderCard key={order.id} locale={locale} order={order} statusLabels={statusLabels} text={text} />
          ))}
        </div>
      )}
    </div>
  );
}

export function CustomerPortalOrderDetail({
  fulfillmentLabels,
  locale,
  order,
  statusLabels,
  text,
}: PortalOrderDetailProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-card bg-[#09291f] p-5 text-white shadow-card lg:p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">
          {order.orderNumber}
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">
          {statusLabels[order.productionStatus]}
        </h2>
        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-card border border-white/16 bg-white/10 p-4">
            <dt className="text-xs font-semibold uppercase text-white/68">{text.orderDate}</dt>
            <dd className="mt-2 font-semibold text-white">{formatDate(order.createdAt, locale)}</dd>
          </div>
          <div className="rounded-card border border-white/16 bg-white/10 p-4">
            <dt className="text-xs font-semibold uppercase text-white/68">{text.property}</dt>
            <dd className="mt-2 font-semibold text-white">{order.propertyName ?? "-"}</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-4">
        <h3 className="text-xl font-semibold text-primary">{text.items}</h3>
        <Card className="space-y-3">
          {order.items.map((item) => (
            <div className="border-b border-border pb-3 last:border-b-0 last:pb-0" key={item.id}>
              <p className="font-semibold text-primary">{item.description}</p>
              <p className="text-sm text-muted">{item.quantity} · {item.unitType}</p>
            </div>
          ))}
        </Card>
      </section>

      <section className="space-y-4">
        <h3 className="text-xl font-semibold text-primary">{text.pickup} / {text.delivery}</h3>
        <LogisticsSummary fulfillmentLabels={fulfillmentLabels} logistics={order.logistics} locale={locale} text={text} />
      </section>

      <section className="space-y-4">
        <h3 className="text-xl font-semibold text-primary">{text.photos}</h3>
        <PhotoGrid photos={order.photos} text={text} />
      </section>

      <section className="space-y-4">
        <h3 className="text-xl font-semibold text-primary">{text.history}</h3>
        {order.history.length === 0 ? (
          <p className="rounded-card border border-border bg-white p-4 text-sm text-muted">{text.history}</p>
        ) : (
          <Card className="space-y-3">
            {order.history.map((event) => (
              <div className="border-b border-border pb-3 last:border-b-0 last:pb-0" key={event.id}>
                <p className="font-semibold text-primary">{statusLabels[event.toStatus]}</p>
                <p className="text-sm text-muted">{formatDate(event.changedAt, locale)}</p>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
