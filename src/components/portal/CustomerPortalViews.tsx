"use client";

/* eslint-disable @next/next/no-img-element */
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/Card";
import { PortalMedia } from "@/components/portal/PortalMedia";
import type { FulfillmentStatus } from "@/features/logistics/types";
import type { OrderPhoto } from "@/features/order-photos/types";
import type {
  CustomerPortalLogistics,
  CustomerPortalNextTask,
  CustomerPortalOrder,
  CustomerPortalOrderDetail,
  CustomerPortalOrderService,
} from "@/features/portal/types";
import type { ProductionStatus } from "@/features/orders/types";
import { catalogCategoryLabel, groupServicesByCategory } from "@/features/services/catalog";
import type { ServiceUnitType } from "@/features/services/types";
import type {
  DerivedPaymentStatus,
  PaymentMethod,
  PaymentRecordStatus,
} from "@/features/payments/types";
import type { TenantBrandingExperience } from "@/features/branding/types";
import {
  DEFAULT_PORTAL_MEDIA,
  portalCategoryMedia,
  type PortalMediaRegistry,
} from "@/features/portal/media";
import { formatCurrency, formatQuantity } from "@/lib/number-format";

type StatusText = Record<ProductionStatus, string>;
type FulfillmentText = Record<FulfillmentStatus, string>;

export type PortalFinanceText = {
  balanceDue: string;
  discount: string;
  methods: Record<PaymentMethod, string>;
  ordersCount: string;
  paymentDate: string;
  paymentStatus: string;
  payments: string;
  paymentsEmpty: string;
  recordStatuses: Record<PaymentRecordStatus, string>;
  statuses: Record<DerivedPaymentStatus, string>;
  subtotal: string;
  title: string;
  total: string;
  totalPaid: string;
  totalValue: string;
};

type PortalCommonText = {
  assistance: string;
  completed: string;
  delivery: string;
  emptyOrders: string;
  finance: PortalFinanceText;
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
  unitTypes: Record<ServiceUnitType, string>;
  viewOrder: string;
};

type PortalOverviewProps = {
  activeOrders: CustomerPortalOrder[];
  customerName: string;
  branding?: TenantBrandingExperience;
  locale: string;
  media?: PortalMediaRegistry;
  nextTask: CustomerPortalNextTask | null;
  orders: CustomerPortalOrder[];
  services: CustomerPortalOrderService[];
  statusLabels: StatusText;
  text: PortalCommonText & {
    activeOrders: string;
    assistance: string;
    currentOrder: string;
    categoryDescription: string;
    categoryDescriptions: Record<string, string>;
    categoryLabels: Record<string, string>;
    fromPrice: string;
    greeting: string;
    historyLink: string;
    inDelivery: string;
    informationOnly: string;
    newRequest: string;
    promotion: string;
    noActiveOrdersDescription: string;
    noActiveOrdersTitle: string;
    quickActions: string;
    recentOrders: string;
    servicesDescription: string;
    servicesDiscovery: string;
    servicesEmpty: string;
    servicesCount: string;
    supportDetails: string;
    visitWebsite: string;
    whatsapp: string;
    unitTypes: Record<ServiceUnitType, string>;
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

function PaymentStatusBadge({
  status,
  text,
}: {
  status: DerivedPaymentStatus;
  text: PortalFinanceText;
}) {
  const classes = status === "paid"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : status === "partially_paid"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : status === "refunded"
        ? "border-blue-200 bg-blue-50 text-blue-800"
        : "border-border bg-[#f7f9f7] text-muted";

  return (
    <span className={`inline-flex min-h-7 items-center rounded-full border px-3 py-1 text-xs font-semibold ${classes}`}>
      {text.statuses[status]}
    </span>
  );
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
      className="group block overflow-hidden rounded-card border border-border bg-white shadow-[0_8px_28px_rgb(15_59_46_/_0.045)] transition-standard hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      href={`/portal/orders/${order.id}`}
      locale={locale}
    >
      <div className="flex items-start justify-between gap-3 p-5 pb-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
            {order.orderNumber}
          </p>
          <h3 className="mt-2 inline-flex rounded-full border border-primary/15 bg-primary-soft px-3 py-1.5 text-sm font-semibold text-primary">
            {statusLabels[order.productionStatus]}
          </h3>
          {order.financial ? (
            <div className="mt-2">
              <PaymentStatusBadge status={order.financial.paymentStatus} text={text.finance} />
            </div>
          ) : null}
        </div>
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </div>
      <dl className="grid gap-3 px-5 pb-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">{text.orderDate}</dt>
          <dd className="mt-1 font-semibold text-foreground">{formatDate(order.createdAt, locale)}</dd>
        </div>
        <div>
          <dt className="text-muted">{text.property}</dt>
          <dd className="mt-1 font-semibold text-foreground">{order.propertyName ?? "-"}</dd>
        </div>
      </dl>
      {order.financial ? (
        <dl className="grid grid-cols-2 gap-3 border-t border-border bg-[#fafcfa] px-5 py-4 text-sm">
          <div>
            <dt className="text-muted">{text.finance.total}</dt>
            <dd className="mt-1 font-semibold text-foreground">
              {formatCurrency(order.financial.totalDue, order.financial.currency, locale)}
            </dd>
          </div>
          <div className="text-right">
            <dt className="text-muted">{text.finance.balanceDue}</dt>
            <dd className={`mt-1 font-semibold ${order.financial.balanceDue > 0 ? "text-amber-800" : "text-emerald-700"}`}>
              {formatCurrency(order.financial.balanceDue, order.financial.currency, locale)}
            </dd>
          </div>
        </dl>
      ) : null}
      <div className="flex min-h-12 items-center justify-between border-t border-border px-5 text-sm font-semibold text-primary">
        <span>{text.viewOrder}</span><span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
      </div>
    </Link>
  );
}

function CategoryCard({
  category,
  locale,
  media,
  services,
  text,
}: {
  category: string;
  locale: string;
  media: PortalMediaRegistry;
  services: CustomerPortalOrderService[];
  text: PortalOverviewProps["text"];
}) {
  const lowestPrice = services.reduce((lowest, service) => service.amount < lowest.amount ? service : lowest);
  const label = services[0]?.categoryTitle || catalogCategoryLabel(category, text.categoryLabels);
  const categoryMedia = portalCategoryMedia(category, media);
  const fallbackImagePath = services.find((service) => service.portalImagePath)?.portalImagePath ?? null;

  return (
    <article className="group overflow-hidden rounded-card border border-border bg-white shadow-[0_8px_28px_rgb(15_59_46_/_0.045)] transition-standard hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-card">
      <PortalMedia
        alt=""
        className="aspect-[16/9] border-b border-border"
        imageClassName="transition-transform duration-500 group-hover:scale-105"
        objectPosition={categoryMedia?.objectPosition}
        sizes="(max-width: 639px) 100vw, (max-width: 1279px) 50vw, 33vw"
        src={categoryMedia?.path ?? fallbackImagePath}
      >
        <span className="absolute bottom-3 left-3 rounded-full border border-white/40 bg-white/90 px-3 py-1 text-xs font-semibold text-primary shadow-sm backdrop-blur">{services.length} {text.servicesCount}</span>
      </PortalMedia>
      <div className="space-y-4 p-5">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{label}</h3>
          <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-muted">
            {text.categoryDescriptions[category] ?? text.categoryDescription}
          </p>
          <ul className="mt-3 space-y-1 text-xs text-muted">
            {services.slice(0, 2).map((service) => <li className="truncate" key={service.id}>• {service.name}</li>)}
          </ul>
        </div>
        <div className="flex items-end justify-between gap-3">
          <p className="text-sm text-muted">
            {services.length > 1 || lowestPrice.priceIsFrom ? `${text.fromPrice} ` : ""}<strong className="text-base text-primary">{formatCurrency(lowestPrice.amount, lowestPrice.currency, locale)}</strong>{" "}
            <span>/ {text.unitTypes[lowestPrice.unitType]}</span>
          </p>
          {services.some((service) => service.customerOrderable) ? (
            <Link
              aria-label={`${text.newRequest}: ${label}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-control border border-primary/20 bg-primary-soft px-3 text-sm font-semibold !text-primary hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              href={`/portal/requests/new#category-${category}`}
              locale={locale}
            >
              {text.newRequest} <span aria-hidden="true">→</span>
            </Link>
          ) : <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">{text.informationOnly}</span>}
        </div>
      </div>
    </article>
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
  branding,
  customerName,
  locale,
  media = branding?.media ?? DEFAULT_PORTAL_MEDIA,
  nextTask,
  orders,
  services,
  statusLabels,
  text,
}: PortalOverviewProps) {
  const currentOrder = activeOrders[0] ?? null;
  const currentTask = currentOrder && nextTask?.orderId === currentOrder.id ? nextTask : null;
  const recentOrders = orders.filter((order) => order.id !== currentOrder?.id).slice(0, 4);
  const currentStatus = currentOrder
    ? currentTask?.kind === "delivery" && currentTask.status === "in_progress"
      ? text.inDelivery
      : statusLabels[currentOrder.productionStatus]
    : null;
  const financials = orders.flatMap((order) => order.financial ? [order.financial] : []);
  const summaryCurrencies = new Set(financials.map((financial) => financial.currency));
  const summaryCurrency = summaryCurrencies.size === 1 ? financials[0]?.currency ?? null : null;
  const accountSummary = summaryCurrency ? {
    balanceDue: financials.reduce((total, financial) => total + financial.balanceDue, 0),
    totalPaid: financials.reduce((total, financial) => total + financial.totalPaid, 0),
    totalValue: financials.reduce((total, financial) => total + financial.totalDue, 0),
  } : null;
  const featuredCategories = groupServicesByCategory(services.filter((service) => service.portalFeatured || service.categoryFeatured));
  const heroMedia = currentTask ? media.logistics : media.hero;

  return (
    <div className="space-y-9 sm:space-y-10">
      <section className="overflow-hidden rounded-[1.5rem] border border-primary/15 bg-white shadow-luxury">
        <div className="grid lg:grid-cols-[minmax(0,1.45fr)_minmax(17rem,0.55fr)]">
          <PortalMedia
            alt=""
            className="aspect-[16/9] border-b border-primary/10 lg:order-2 lg:aspect-auto lg:min-h-[34rem] lg:border-b-0 lg:border-l"
            imageClassName="transition-transform duration-700 hover:scale-[1.02]"
            objectPosition={heroMedia.objectPosition}
            overlayClassName="bg-gradient-to-t from-primary/25 via-transparent to-transparent"
            priority
            sizes="(max-width: 1023px) 100vw, 38vw"
            src={heroMedia.path}
          >
            <div className="absolute bottom-4 left-4 right-4 flex justify-end">
              <span className="rounded-full border border-white/50 bg-white/88 px-3 py-1.5 text-xs font-semibold text-primary shadow-sm backdrop-blur">
                {currentTask ? (currentTask.kind === "pickup" ? text.pickup : text.delivery) : text.servicesDiscovery}
              </span>
            </div>
          </PortalMedia>
          <div className="p-5 sm:p-7 lg:p-9">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
              {branding?.portalTitle || `${text.greeting}, ${customerName}`}
            </p>
            {currentOrder ? (
              <>
                <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  {currentStatus}
                </h1>
                {branding?.portalSubtitle ? <p className="mt-3 max-w-xl text-sm leading-6 text-muted">{branding.portalSubtitle}</p> : null}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                    {text.currentOrder}
                  </span>
                  <span className="text-sm font-semibold text-secondary">{currentOrder.orderNumber}</span>
                </div>

                <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
                  {currentTask ? (
                    <div className="rounded-control border border-blue-200 bg-blue-50/65 p-4 sm:col-span-2">
                      <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-blue-800">{text.nextTask}</dt>
                      <dd className="mt-1.5 text-base font-semibold text-foreground">
                        {currentTask.kind === "pickup" ? text.pickup : text.delivery} · {formatDate(currentTask.scheduledAt, locale)}
                      </dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-muted">{text.orderDate}</dt>
                    <dd className="mt-1 font-semibold text-foreground">{formatDate(currentOrder.createdAt, locale)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{text.property}</dt>
                    <dd className="mt-1 font-semibold text-foreground">{currentOrder.propertyName ?? "-"}</dd>
                  </div>
                </dl>

                {currentOrder.financial ? (
                  <div className="mt-6 rounded-card border border-primary/10 bg-primary-soft/55 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">{text.finance.paymentStatus}</p>
                      <PaymentStatusBadge status={currentOrder.financial.paymentStatus} text={text.finance} />
                    </div>
                    <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <dt className="text-muted">{text.finance.total}</dt>
                        <dd className="mt-1 font-semibold text-foreground">{formatCurrency(currentOrder.financial.totalDue, currentOrder.financial.currency, locale)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">{text.finance.totalPaid}</dt>
                        <dd className="mt-1 font-semibold text-foreground">{formatCurrency(currentOrder.financial.totalPaid, currentOrder.financial.currency, locale)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted">{text.finance.balanceDue}</dt>
                        <dd className="mt-1 font-semibold text-foreground">{formatCurrency(currentOrder.financial.balanceDue, currentOrder.financial.currency, locale)}</dd>
                      </div>
                    </dl>
                  </div>
                ) : null}

                <Link
                  className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-control border border-primary bg-primary px-5 text-sm font-semibold !text-white shadow-sm transition-standard hover:bg-primary-strong hover:!text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:w-auto"
                  href={`/portal/orders/${currentOrder.id}`}
                  locale={locale}
                >
                  {text.viewOrder}
                </Link>
              </>
            ) : (
              <>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{text.noActiveOrdersTitle}</h1>
                <p className="mt-3 max-w-xl text-base leading-7 text-muted">{branding?.portalSubtitle || text.noActiveOrdersDescription}</p>
                <Link
                  className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-control border border-primary bg-primary px-5 text-sm font-semibold !text-white shadow-sm transition-standard hover:bg-primary-strong hover:!text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:w-auto"
                  href="/portal/requests/new"
                  locale={locale}
                >
                  {text.newRequest}
                </Link>
              </>
            )}
          </div>

        </div>
      </section>

      {accountSummary && summaryCurrency ? (
        <section className="space-y-4" aria-labelledby="portal-account-summary">
          <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl" id="portal-account-summary">{text.finance.title}</h2>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              [text.finance.ordersCount, String(orders.length)],
              [text.finance.totalValue, formatCurrency(accountSummary.totalValue, summaryCurrency, locale)],
              [text.finance.totalPaid, formatCurrency(accountSummary.totalPaid, summaryCurrency, locale)],
              [text.finance.balanceDue, formatCurrency(accountSummary.balanceDue, summaryCurrency, locale)],
            ].map(([label, value]) => (
              <div className="relative overflow-hidden rounded-card border border-border bg-white p-4 shadow-[0_6px_20px_rgb(15_59_46_/_0.035)]" key={label}>
                <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-secondary/70" />
                <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</dt>
                <dd className="mt-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {nextTask && !currentTask ? (
        <Card className="space-y-2 border-blue-200 bg-blue-50/55">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-800">{text.nextTask}</p>
          <Link className="inline-flex min-h-11 items-center text-lg font-semibold !text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" href={`/portal/orders/${nextTask.orderId}`} locale={locale}>
            {nextTask.orderNumber}
          </Link>
          <p className="text-sm text-muted">
            {nextTask.kind === "pickup" ? text.pickup : text.delivery} · {formatDate(nextTask.scheduledAt, locale)}
          </p>
        </Card>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{text.quickActions}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { href: "/portal/requests/new", label: text.newRequest, primary: true },
            { href: "/portal/orders", label: text.orders, primary: false },
            { href: "/contact", label: text.assistance, primary: false },
          ].map((action) => (
            <Link
              className={`inline-flex min-h-14 items-center justify-between gap-3 rounded-control border px-4 text-sm font-semibold transition-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                action.primary
                  ? "border-primary bg-primary !text-white shadow-sm hover:bg-primary-strong hover:!text-white"
                  : "border-border bg-white !text-primary hover:border-primary/30 hover:bg-primary-soft"
              }`}
              href={action.href}
              key={action.href}
              locale={locale}
            >
              {action.label}<span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </section>

      {branding?.promotion ? (
        <section className="overflow-hidden rounded-[1.5rem] border border-primary/15 bg-white shadow-card" aria-labelledby="portal-promotion">
          <div className={`grid ${branding.promotion.imagePath ? "md:grid-cols-[minmax(0,1fr)_18rem]" : ""}`}>
            <div className="p-5 sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">{text.promotion}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground" id="portal-promotion">{branding.promotion.title}</h2>
              {branding.promotion.body ? <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{branding.promotion.body}</p> : null}
              {branding.promotion.ctaHref && branding.promotion.ctaLabel ? (
                <a
                  className="mt-5 inline-flex min-h-11 items-center rounded-control border border-primary bg-primary px-4 text-sm font-semibold !text-white transition-standard hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  href={branding.promotion.ctaHref}
                  rel="noreferrer"
                  target="_blank"
                >
                  {branding.promotion.ctaLabel}<span aria-hidden="true" className="ml-2">↗</span>
                </a>
              ) : null}
            </div>
            {branding.promotion.imagePath ? (
              <PortalMedia
                alt=""
                className="aspect-[16/9] border-t border-border md:aspect-auto md:min-h-56 md:border-l md:border-t-0"
                sizes="(max-width: 767px) 100vw, 18rem"
                src={branding.promotion.imagePath}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{text.servicesDiscovery}</h2>
          <p className="mt-1.5 text-sm leading-6 text-muted">{text.servicesDescription}</p>
        </div>
        {featuredCategories.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {featuredCategories.slice(0, 6).map(({ category, items }) => (
              <CategoryCard category={category} key={category} locale={locale} media={media} services={items} text={text} />
            ))}
          </div>
        ) : (
          <p className="rounded-card border border-dashed border-border bg-white p-5 text-sm leading-6 text-muted">{text.servicesEmpty}</p>
        )}
      </section>

      {recentOrders.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{text.recentOrders}</h2>
            <Link className="inline-flex min-h-11 items-center text-sm font-semibold !text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" href="/portal/orders" locale={locale}>
              {text.historyLink}
            </Link>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {recentOrders.map((order) => (
              <OrderCard key={order.id} locale={locale} order={order} statusLabels={statusLabels} text={text} />
            ))}
          </div>
        </section>
      ) : null}

      {branding && Object.values(branding.support).some(Boolean) ? (
        <section className="rounded-card border border-border bg-white p-5 shadow-[0_8px_28px_rgb(15_59_46_/_0.035)] sm:p-6" aria-labelledby="portal-support-details">
          <h2 className="text-xl font-semibold tracking-tight text-foreground" id="portal-support-details">{text.supportDetails}</h2>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {branding.support.email ? <a className="inline-flex min-h-11 items-center rounded-control border border-border px-4 font-semibold !text-primary hover:bg-primary-soft" href={`mailto:${branding.support.email}`}>{branding.support.email}</a> : null}
            {branding.support.phone ? <a className="inline-flex min-h-11 items-center rounded-control border border-border px-4 font-semibold !text-primary hover:bg-primary-soft" href={`tel:${branding.support.phone.replace(/[^+0-9]/g, "")}`}>{branding.support.phone}</a> : null}
            {branding.support.whatsapp ? <a className="inline-flex min-h-11 items-center rounded-control border border-border px-4 font-semibold !text-primary hover:bg-primary-soft" href={`https://wa.me/${branding.support.whatsapp.replace(/[^0-9]/g, "")}`} rel="noreferrer" target="_blank">{text.whatsapp}</a> : null}
            {branding.support.websiteUrl ? <a className="inline-flex min-h-11 items-center rounded-control border border-border px-4 font-semibold !text-primary hover:bg-primary-soft" href={branding.support.websiteUrl} rel="noreferrer" target="_blank">{text.visitWebsite}</a> : null}
          </div>
          {branding.support.address ? <p className="mt-4 whitespace-pre-line text-sm leading-6 text-muted">{branding.support.address}</p> : null}
        </section>
      ) : null}
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
    <div className="space-y-6">
      <header className="rounded-[1.5rem] border border-primary/10 bg-[linear-gradient(135deg,var(--color-primary-soft),white)] p-5 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">{text.history}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{text.orders}</h1>
        <p className="mt-2 text-sm text-muted">{orders.length} {text.orders.toLocaleLowerCase()}</p>
      </header>
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
    <div className="space-y-7">
      <section className="overflow-hidden rounded-[1.5rem] border border-primary/15 bg-[linear-gradient(135deg,var(--color-primary-soft),white)] p-5 shadow-card lg:p-7">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">
          {order.orderNumber}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
          {statusLabels[order.productionStatus]}
        </h1>
        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-card border border-border bg-[#fafbfa] p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{text.orderDate}</dt>
            <dd className="mt-2 font-semibold text-foreground">{formatDate(order.createdAt, locale)}</dd>
          </div>
          <div className="rounded-card border border-border bg-[#fafbfa] p-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{text.property}</dt>
            <dd className="mt-2 font-semibold text-foreground">{order.propertyName ?? "-"}</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-4 rounded-card border border-border bg-white p-5 shadow-[0_8px_28px_rgb(15_59_46_/_0.04)] sm:p-6">
        <h3 className="text-xl font-semibold text-primary">{text.items}</h3>
        <div className="space-y-3">
          {order.items.map((item) => (
            <div className="border-b border-border pb-3 last:border-b-0 last:pb-0" key={item.id}>
              <p className="font-semibold text-primary">{item.description}</p>
              <p className="text-sm text-muted">{formatQuantity(item.quantity, locale)} · {text.unitTypes[item.unitType]}</p>
            </div>
          ))}
        </div>
      </section>

      {order.financial ? (
        <section className="space-y-4 rounded-card border border-border bg-white p-5 shadow-[0_8px_28px_rgb(15_59_46_/_0.04)] sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-foreground">{text.finance.title}</h2>
            <PaymentStatusBadge status={order.financial.paymentStatus} text={text.finance} />
          </div>
          <div>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-muted">{text.finance.subtotal}</dt>
                <dd className="mt-1 font-semibold text-foreground">{formatCurrency(order.financial.subtotal, order.financial.currency, locale)}</dd>
              </div>
              <div>
                <dt className="text-muted">{text.finance.discount}</dt>
                <dd className="mt-1 font-semibold text-foreground">{formatCurrency(order.financial.discountAmount, order.financial.currency, locale)}</dd>
              </div>
              <div>
                <dt className="text-muted">{text.finance.totalPaid}</dt>
                <dd className="mt-1 font-semibold text-emerald-700">{formatCurrency(order.financial.totalPaid, order.financial.currency, locale)}</dd>
              </div>
              <div>
                <dt className="text-muted">{text.finance.balanceDue}</dt>
                <dd className={`mt-1 font-semibold ${order.financial.balanceDue > 0 ? "text-amber-800" : "text-emerald-700"}`}>
                  {formatCurrency(order.financial.balanceDue, order.financial.currency, locale)}
                </dd>
              </div>
              <div className="col-span-2 border-t border-border pt-4 sm:col-span-4">
                <dt className="text-muted">{text.finance.total}</dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{formatCurrency(order.financial.totalDue, order.financial.currency, locale)}</dd>
              </div>
            </dl>
          </div>
        </section>
      ) : null}

      <section className="space-y-4 rounded-card border border-border bg-white p-5 shadow-[0_8px_28px_rgb(15_59_46_/_0.04)] sm:p-6">
        <h2 className="text-xl font-semibold text-foreground">{text.finance.payments}</h2>
        {order.payments.length === 0 ? (
          <p className="rounded-card border border-dashed border-border bg-white p-5 text-sm leading-6 text-muted">{text.finance.paymentsEmpty}</p>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-white">
            {order.payments.map((payment) => (
              <article className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5" key={payment.id}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-foreground">{text.finance.methods[payment.method]}</p>
                    <span className="rounded-full border border-border bg-[#f7f9f7] px-2.5 py-1 text-xs font-semibold text-muted">
                      {text.finance.recordStatuses[payment.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{text.finance.paymentDate}: {formatDate(payment.paidAt, locale)}</p>
                </div>
                <p className={`text-lg font-semibold ${payment.status === "refunded" ? "text-blue-800" : "text-foreground"}`}>
                  {formatCurrency(payment.amount, payment.currency, locale)}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-card border border-border bg-white p-5 shadow-[0_8px_28px_rgb(15_59_46_/_0.04)] sm:p-6">
        <h3 className="text-xl font-semibold text-primary">{text.pickup} / {text.delivery}</h3>
        <LogisticsSummary fulfillmentLabels={fulfillmentLabels} logistics={order.logistics} locale={locale} text={text} />
      </section>

      <section className="space-y-4 rounded-card border border-border bg-white p-5 shadow-[0_8px_28px_rgb(15_59_46_/_0.04)] sm:p-6">
        <h3 className="text-xl font-semibold text-primary">{text.photos}</h3>
        <PhotoGrid photos={order.photos} text={text} />
      </section>

      <section className="space-y-4 rounded-card border border-border bg-white p-5 shadow-[0_8px_28px_rgb(15_59_46_/_0.04)] sm:p-6">
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

      <section className="rounded-card border border-border bg-primary-soft/45 p-5 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{text.assistance}</h2>
          <p className="mt-1 text-sm text-muted">{order.orderNumber}</p>
        </div>
        <Link
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-control border border-primary/20 bg-white px-4 text-sm font-semibold !text-primary hover:border-primary/35 hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:mt-0 sm:w-auto"
          href="/contact"
          locale={locale}
        >
          {text.assistance}
        </Link>
      </section>
    </div>
  );
}
