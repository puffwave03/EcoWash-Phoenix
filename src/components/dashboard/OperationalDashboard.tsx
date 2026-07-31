import { Card } from "@/components/Card";
import { Link } from "@/i18n/navigation";
import type {
  DashboardActivityItem,
  DashboardBalanceItem,
  DashboardHoldItem,
  DashboardLogisticsItem,
  DashboardOrderQueueItem,
  DashboardOverview,
} from "@/features/dashboard/types";
import type { FulfillmentStatus } from "@/features/logistics/types";
import type { ProductionStatus } from "@/features/orders/types";
import type { DerivedPaymentStatus } from "@/features/payments/types";

type DashboardText = {
  activity: {
    actorFallback: string;
    empty: string;
    events: Record<DashboardActivityItem["descriptionKey"], string>;
    title: string;
  };
  balances: {
    balanceDue: string;
    empty: string;
    paymentStatus: string;
    title: string;
    total: string;
    totalPaid: string;
  };
  labels: {
    assigned: string;
    customer: string;
    due: string;
    late: string;
    order: string;
    priority: string;
    property: string;
    status: string;
    view: string;
  };
  logistics: {
    attention: string;
    delivery: string;
    empty: string;
    pickup: string;
    todayDeliveries: string;
    todayPickups: string;
  };
  onHold: {
    empty: string;
    holdAt: string;
    reason: string;
    title: string;
  };
  payments: {
    partiallyPaid: string;
    paymentsToday: string;
    recentCorrections: string;
    title: string;
    unpaid: string;
  };
  production: {
    empty: string;
    readyAt: string;
    readyTitle: string;
    title: string;
  };
  statuses: {
    fulfillment: Record<FulfillmentStatus, string>;
    payment: Record<DerivedPaymentStatus, string>;
    production: Record<ProductionStatus, string>;
  };
  summary: {
    balanceDue: string;
    express: string;
    late: string;
    onHold: string;
    open: string;
    ready: string;
    title: string;
  };
  workspace: {
    attentionClear: string;
    attentionCount: string;
    attentionTitle: string;
    description: string;
    logisticsSignal: string;
    newCustomer: string;
    newOrder: string;
    paymentsSignal: string;
    productionSignal: string;
    quickActions: string;
    services: string;
    title: string;
    viewOrders: string;
  };
};

type OperationalDashboardProps = {
  data: DashboardOverview;
  locale: string;
  text: DashboardText;
};

function formatMoney(amount: string | number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, { currency, style: "currency" }).format(Number(amount));
}

function formatCurrencyAmounts(
  amounts: NonNullable<DashboardOverview["summary"]["balanceDueTotals"]>,
  locale: string,
) {
  if (amounts.length === 0) return "-";

  return amounts.map((item) => formatMoney(item.amount, item.currency, locale)).join(" · ");
}

function formatDateTime(value: string | null, locale: string) {
  return value ? new Date(value).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : "-";
}

function formatTime(value: string | null, locale: string) {
  return value ? new Date(value).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "-";
}

function OrderLink({ id, locale, text }: { id: string; locale: string; text: string }) {
  return (
    <Link className="text-sm font-semibold text-primary underline-offset-4 hover:underline" href={`/app/orders/${id}`} locale={locale}>
      {text}
    </Link>
  );
}

function QuickAction({
  href,
  label,
  locale,
  primary = false,
}: {
  href: string;
  label: string;
  locale: string;
  primary?: boolean;
}) {
  return (
    <Link
      className={`inline-flex min-h-11 items-center justify-center rounded-control px-4 py-2.5 text-sm font-semibold transition-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
        primary
          ? "bg-primary text-white shadow-card hover:bg-primary-strong"
          : "border border-border bg-white text-primary hover:border-primary hover:bg-primary-soft"
      }`}
      href={href}
      locale={locale}
    >
      {label}
    </Link>
  );
}

function SignalCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-card border border-white/16 bg-white/10 p-4">
      <p className="text-xs font-semibold uppercase text-white/70">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function QueueList({
  items,
  locale,
  showReadyAt = false,
  text,
}: {
  items: DashboardOrderQueueItem[];
  locale: string;
  showReadyAt?: boolean;
  text: DashboardText;
}) {
  if (items.length === 0) return <p className="text-sm text-muted">{text.production.empty}</p>;

  return (
    <div className="divide-y divide-border">
      {items.map((item) => (
        <div className="grid gap-3 py-4 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-center" key={item.id}>
          <div>
            <p className="font-semibold text-primary">{item.orderNumber}</p>
            <p className="text-sm text-muted">{item.customerName}</p>
          </div>
          <p className="text-sm text-muted">{item.propertyName || "-"}</p>
          <div className="text-sm text-muted">
            <p>{text.statuses.production[item.productionStatus]} · {item.priority}</p>
            <p>{showReadyAt ? `${text.production.readyAt}: ${formatDateTime(item.readyAt, locale)}` : `${text.labels.due}: ${formatDateTime(item.dueAt, locale)}`}</p>
          </div>
          <div className="text-sm text-muted">
            <p>{formatMoney(item.total, item.currency, locale)}</p>
            <p>{text.summary.balanceDue}: {formatMoney(item.balanceDue, item.currency, locale)}</p>
          </div>
          <OrderLink id={item.id} locale={locale} text={text.labels.view} />
        </div>
      ))}
    </div>
  );
}

function LogisticsList({
  items,
  locale,
  text,
}: {
  items: DashboardLogisticsItem[];
  locale: string;
  text: DashboardText;
}) {
  if (items.length === 0) return <p className="text-sm text-muted">{text.logistics.empty}</p>;

  return (
    <div className="divide-y divide-border">
      {items.map((item) => (
        <div className="grid gap-3 py-3 md:grid-cols-[5rem_1fr_1fr_auto] md:items-center" key={`${item.kind}-${item.id}`}>
          <p className="text-sm font-semibold text-primary">{formatTime(item.scheduledAt, locale)}</p>
          <div>
            <p className="font-semibold text-primary">{item.orderNumber}</p>
            <p className="text-sm text-muted">{item.customerName}</p>
          </div>
          <p className="text-sm text-muted">
            {item.city || "-"} · {item.assignedToName || text.labels.assigned} · {text.statuses.fulfillment[item.status]}
          </p>
          <OrderLink id={item.orderId} locale={locale} text={text.labels.view} />
        </div>
      ))}
    </div>
  );
}

function BalanceList({
  items,
  locale,
  text,
}: {
  items: DashboardBalanceItem[];
  locale: string;
  text: DashboardText;
}) {
  if (items.length === 0) return <p className="text-sm text-muted">{text.balances.empty}</p>;

  return (
    <div className="divide-y divide-border">
      {items.map((item) => (
        <div className="grid gap-3 py-4 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-center" key={item.id}>
          <div>
            <p className="font-semibold text-primary">{item.orderNumber}</p>
            <p className="text-sm text-muted">{item.customerName}</p>
          </div>
          <p className="text-sm text-muted">{text.balances.total}: {formatMoney(item.total, item.currency, locale)}</p>
          <p className="text-sm text-muted">{text.balances.totalPaid}: {formatMoney(item.totalPaid, item.currency, locale)}</p>
          <p className="text-sm text-muted">{text.statuses.payment[item.paymentStatus]} · {formatMoney(item.balanceDue, item.currency, locale)}</p>
          <OrderLink id={item.id} locale={locale} text={text.labels.view} />
        </div>
      ))}
    </div>
  );
}

function OnHoldList({ items, locale, text }: { items: DashboardHoldItem[]; locale: string; text: DashboardText }) {
  if (items.length === 0) return <p className="text-sm text-muted">{text.onHold.empty}</p>;

  return (
    <div className="divide-y divide-border">
      {items.map((item) => (
        <div className="grid gap-3 py-4 md:grid-cols-[1fr_1fr_auto] md:items-center" key={item.id}>
          <div>
            <p className="font-semibold text-primary">{item.orderNumber}</p>
            <p className="text-sm text-muted">{item.customerName}</p>
          </div>
          <p className="text-sm text-muted">{text.onHold.holdAt}: {formatDateTime(item.holdAt, locale)} · {item.reason || "-"}</p>
          <OrderLink id={item.id} locale={locale} text={text.labels.view} />
        </div>
      ))}
    </div>
  );
}

function ActivityList({ items, locale, text }: { items: DashboardActivityItem[]; locale: string; text: DashboardText }) {
  if (items.length === 0) return <p className="text-sm text-muted">{text.activity.empty}</p>;

  return (
    <div className="divide-y divide-border">
      {items.map((item) => (
        <div className="grid gap-2 py-3 md:grid-cols-[1fr_1fr_auto] md:items-center" key={item.id}>
          <div>
            <p className="font-semibold text-primary">{text.activity.events[item.descriptionKey]}</p>
            <p className="text-sm text-muted">{item.orderNumber}</p>
          </div>
          <p className="text-sm text-muted">{formatDateTime(item.timestamp, locale)} · {item.actorName || text.activity.actorFallback}</p>
          <OrderLink id={item.orderId} locale={locale} text={text.labels.view} />
        </div>
      ))}
    </div>
  );
}

export function OperationalDashboard({ data, locale, text }: OperationalDashboardProps) {
  const summary = [
    [text.summary.open, data.summary.openOrders],
    [text.summary.late, data.summary.lateOpenOrders],
    [text.summary.express, data.summary.expressOpenOrders],
    [text.summary.onHold, data.summary.onHoldOrders],
    [text.summary.ready, data.summary.readyOrders],
  ];
  const financialSummary = data.financialSummary;
  const attentionItems = [
    [text.summary.late, data.summary.lateOpenOrders],
    [text.summary.onHold, data.summary.onHoldOrders],
    [text.logistics.attention, data.logisticsAttention.length],
    [text.balances.title, data.paymentBalances.length],
  ];
  const attentionTotal = attentionItems.reduce((total, [, value]) => total + Number(value), 0);
  const productionSignal =
    data.productionQueue.length + data.readyQueue.length + data.summary.onHoldOrders;
  const logisticsSignal =
    data.todayPickups.length + data.todayDeliveries.length + data.logisticsAttention.length;
  const paymentsSignal = data.summary.balanceDueTotals
    ? formatCurrencyAmounts(data.summary.balanceDueTotals, locale)
    : data.paymentBalances.length;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.45fr_1fr]" aria-labelledby="dashboard-workspace-title">
        <div className="rounded-card bg-[#09291f] p-5 text-white shadow-card lg:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase text-secondary">
                {text.summary.title}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white lg:text-3xl" id="dashboard-workspace-title">
                {text.workspace.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/76">
                {text.workspace.description}
              </p>
            </div>
            <div className="rounded-card border border-white/16 bg-white/10 p-4">
              <p className="text-sm font-semibold text-white/76">
                {text.workspace.attentionTitle}
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {attentionTotal}
              </p>
              <p className="mt-1 text-xs font-medium text-white/68">
                {attentionTotal > 0 ? text.workspace.attentionCount : text.workspace.attentionClear}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <SignalCard label={text.workspace.productionSignal} value={productionSignal} />
            <SignalCard label={text.workspace.logisticsSignal} value={logisticsSignal} />
            <SignalCard label={text.workspace.paymentsSignal} value={paymentsSignal} />
          </div>
        </div>

        <Card className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-primary">{text.workspace.quickActions}</h3>
            <p className="mt-1 text-sm text-muted">{text.workspace.attentionTitle}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <QuickAction href="/app/orders/new" label={text.workspace.newOrder} locale={locale} primary />
            <QuickAction href="/app/customers/new" label={text.workspace.newCustomer} locale={locale} />
            <QuickAction href="/app/services" label={text.workspace.services} locale={locale} />
            <QuickAction href="/app/orders" label={text.workspace.viewOrders} locale={locale} />
          </div>
        </Card>
      </section>

      <section className="grid gap-3 md:grid-cols-4" aria-label={text.workspace.attentionTitle}>
        {attentionItems.map(([label, value]) => (
          <div className="rounded-card border border-border bg-white p-4 shadow-card" key={label}>
            <p className="text-sm font-medium text-muted">{label}</p>
            <p className={`mt-2 text-2xl font-semibold ${Number(value) > 0 ? "text-primary" : "text-muted"}`}>
              {value}
            </p>
          </div>
        ))}
      </section>

      <section className="space-y-4" aria-labelledby="dashboard-summary-title">
        <h2 className="text-xl font-semibold text-primary" id="dashboard-summary-title">
          {text.summary.title}
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {summary.map(([label, value]) => (
            <div className="rounded-card border border-border bg-white p-4 shadow-card" key={label}>
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="mt-2 text-2xl font-semibold text-primary">{value}</dd>
            </div>
          ))}
          {data.summary.balanceDueTotals ? (
            <div className="rounded-card border border-border bg-white p-4 shadow-card sm:col-span-2 xl:col-span-1">
              <dt className="text-sm text-muted">{text.summary.balanceDue}</dt>
              <dd className="mt-2 text-xl font-semibold text-primary">
                {formatCurrencyAmounts(data.summary.balanceDueTotals, locale)}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="space-y-3">
          <h3 className="text-lg font-semibold text-primary">{text.production.title}</h3>
          <QueueList items={data.productionQueue} locale={locale} text={text} />
        </Card>
        <Card className="space-y-3">
          <h3 className="text-lg font-semibold text-primary">{text.onHold.title}</h3>
          <OnHoldList items={data.onHoldQueue} locale={locale} text={text} />
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-3">
          <h3 className="text-lg font-semibold text-primary">{text.production.readyTitle}</h3>
          <QueueList items={data.readyQueue} locale={locale} showReadyAt text={text} />
        </Card>
        {financialSummary ? (
          <Card className="space-y-3">
            <h3 className="text-lg font-semibold text-primary">{text.payments.title}</h3>
            <dl className="grid gap-3 sm:grid-cols-3">
              <div><dt className="text-sm text-muted">{text.payments.unpaid}</dt><dd className="font-semibold text-primary">{financialSummary.unpaidOrders}</dd></div>
              <div><dt className="text-sm text-muted">{text.payments.partiallyPaid}</dt><dd className="font-semibold text-primary">{financialSummary.partiallyPaidOrders}</dd></div>
              <div><dt className="text-sm text-muted">{text.payments.paymentsToday}</dt><dd className="font-semibold text-primary">{financialSummary.paymentsToday}</dd></div>
            </dl>
            <p className="text-sm text-muted">{text.payments.recentCorrections}: {financialSummary.recentCorrections}</p>
          </Card>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-3">
          <h3 className="text-lg font-semibold text-primary">{text.logistics.todayPickups}</h3>
          <LogisticsList items={data.todayPickups} locale={locale} text={text} />
        </Card>
        <Card className="space-y-3">
          <h3 className="text-lg font-semibold text-primary">{text.logistics.todayDeliveries}</h3>
          <LogisticsList items={data.todayDeliveries} locale={locale} text={text} />
        </Card>
      </div>

      <Card className="space-y-3">
        <h3 className="text-lg font-semibold text-primary">{text.logistics.attention}</h3>
        <LogisticsList items={data.logisticsAttention} locale={locale} text={text} />
      </Card>

      <Card className="space-y-3">
        <h3 className="text-lg font-semibold text-primary">{text.balances.title}</h3>
        <BalanceList items={data.paymentBalances} locale={locale} text={text} />
      </Card>

      <Card className="space-y-3">
        <h3 className="text-lg font-semibold text-primary">{text.activity.title}</h3>
        <ActivityList items={data.activity} locale={locale} text={text} />
      </Card>
    </div>
  );
}
