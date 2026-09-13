import { Card } from "@/components/Card";
import {
  EmptyState,
  PageHeader,
  SectionHeader,
  StatusBadge,
  SummaryCard,
  type Tone,
} from "@/components/operational/OperationalUi";
import type {
  DailyCloseBlockerKey,
  DailyCloseData,
  DailyCloseItem,
  DailyCloseSource,
} from "@/features/daily-close/types";
import type { FulfillmentStatus } from "@/features/logistics/types";
import type { ProductionStatus } from "@/features/orders/types";
import type { DerivedPaymentStatus } from "@/features/payments/types";
import { Link } from "@/i18n/navigation";
import { formatCurrency } from "@/lib/number-format";

type DailyCloseText = {
  anomalies: Record<"late" | "logistics" | "onHold" | "payment", string>;
  blockers: Record<DailyCloseBlockerKey | "none" | "notReady" | "ready", string>;
  description: string;
  empty: string;
  filter: Record<"allLocations" | "apply" | "businessDate" | "current" | "future" | "location" | "past", string>;
  groups: Record<"incompleteDeliveries" | "incompletePickups", string>;
  labels: {
    assignedTo: string;
    customer: string;
    missingAmount: string;
    order: string;
    property: string;
    status: string;
    time: string;
    view: string;
  };
  metrics: Record<
    | "bankTransfer"
    | "cancelled"
    | "card"
    | "cash"
    | "cashWithoutSession"
    | "closedSessions"
    | "collectedGross"
    | "collectedNet"
    | "confirmedPayments"
    | "countedCash"
    | "deliveriesDue"
    | "expectedCash"
    | "finalFulfillmentCompleted"
    | "inProgress"
    | "late"
    | "onHold"
    | "online"
    | "open"
    | "openSessions"
    | "ordersCreated"
    | "other"
    | "outstanding"
    | "outstandingOrders"
    | "overdueDeliveries"
    | "overduePickups"
    | "pickupsDue"
    | "productionCompleted"
    | "refunds"
    | "variance",
    string
  >;
  nonFiscal: string;
  paymentStatuses: Record<DerivedPaymentStatus, string>;
  previewLabel: string;
  semantics: Record<"currentState" | "currentStateNote" | "historicalNotice" | "selectedDateFacts" | "selectedDateNote", string>;
  sections: Record<"attention" | "businessDay" | "logistics" | "orders" | "payments" | "pos", string>;
  sourceLabels: Record<DailyCloseSource, string>;
  statuses: Record<FulfillmentStatus | ProductionStatus, string>;
  title: string;
  unavailable: string;
};

function formatDateTime(value: string | null, locale: string, timeZone: string) {
  return value
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value))
    : "-";
}

function statusTone(item: DailyCloseItem): Tone {
  if (item.isLate) return "critical";
  if (item.paymentStatus || item.status === "on_hold") return "warning";
  if (item.status === "completed") return "success";
  return "info";
}

function anomalyLabel(item: DailyCloseItem, text: DailyCloseText) {
  if (item.kind === "payment" || item.paymentStatus) return text.anomalies.payment;
  if (item.status === "on_hold") return text.anomalies.onHold;
  if (item.kind === "pickup" || item.kind === "delivery") return item.isLate ? text.anomalies.late : text.anomalies.logistics;
  return item.isLate ? text.anomalies.late : text.anomalies.logistics;
}

function DailyCloseCard({ item, locale, text, timeZone }: {
  item: DailyCloseItem;
  locale: string;
  text: DailyCloseText;
  timeZone: string;
}) {
  return (
    <article className={`rounded-card border bg-white px-4 py-4 shadow-sm ${item.isLate ? "border-red-200" : "border-border"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={statusTone(item)}>{text.statuses[item.status]}</StatusBadge>
            {item.kind === "anomaly" || item.isLate || item.paymentStatus ? (
              <StatusBadge tone={item.isLate ? "critical" : "warning"}>{anomalyLabel(item, text)}</StatusBadge>
            ) : null}
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">{text.labels.order}</p>
          <h4 className="mt-1 truncate text-lg font-semibold text-primary">{item.orderNumber}</h4>
          <p className="mt-1 truncate text-sm font-medium text-muted">{item.customerName}</p>
        </div>
        <Link className="inline-flex min-h-10 items-center justify-center rounded-control border border-primary px-3 text-sm font-semibold text-primary hover:bg-primary hover:text-white" href={`/app/orders/${item.orderId}`} locale={locale}>{text.labels.view}</Link>
      </div>
      <dl className="mt-4 grid gap-3 rounded-control bg-[#fbfbf8] p-3 text-sm sm:grid-cols-2">
        <div><dt className="font-semibold text-primary">{text.labels.time}</dt><dd className="text-muted">{formatDateTime(item.timestamp, locale, timeZone)}</dd></div>
        <div><dt className="font-semibold text-primary">{text.labels.assignedTo}</dt><dd className="text-muted">{item.assignedToName || "-"}</dd></div>
        <div><dt className="font-semibold text-primary">{text.labels.property}</dt><dd className="text-muted">{item.propertyName || "-"}</dd></div>
        {item.missingAmount ? <div><dt className="font-semibold text-primary">{text.labels.missingAmount}</dt><dd className="font-semibold text-red-700">{item.missingAmount}</dd></div> : null}
        {item.paymentStatus ? <div><dt className="font-semibold text-primary">{text.labels.status}</dt><dd className="text-muted">{text.paymentStatuses[item.paymentStatus]}</dd></div> : null}
      </dl>
    </article>
  );
}

function ItemGroup({ items, locale, text, timeZone, title }: {
  items: DailyCloseItem[];
  locale: string;
  text: DailyCloseText;
  timeZone: string;
  title: string;
}) {
  return (
    <Card className="space-y-4 bg-white/95">
      <SectionHeader count={items.length} title={title} tone={items.some((item) => item.isLate) ? "critical" : "warning"} />
      {items.length ? <div className="space-y-3">{items.map((item) => <DailyCloseCard item={item} key={`${item.kind}-${item.id}`} locale={locale} text={text} timeZone={timeZone} />)}</div> : <EmptyState>{text.empty}</EmptyState>}
    </Card>
  );
}

function blockerText(data: DailyCloseData, index: number, text: DailyCloseText) {
  const blocker = data.blockers[index];
  if (blocker.key === "source_unavailable") {
    const sources = (blocker.sources ?? []).map((source) => text.sourceLabels[source]).join(", ");
    return `${text.blockers.source_unavailable}: ${sources}`;
  }
  const label = text.blockers[blocker.key];
  return blocker.count === undefined ? label : `${label}: ${blocker.count}`;
}

export function DailyCloseDashboard({ data, locale, text }: { data: DailyCloseData; locale: string; text: DailyCloseText }) {
  const isHistoricalBusinessDate = data.businessDate < data.currentBusinessDate;
  const dayTone: Tone = data.isFutureBusinessDate ? "warning" : data.businessDate === data.currentBusinessDate ? "info" : "neutral";
  const dayLabel = data.isFutureBusinessDate ? text.filter.future : data.businessDate === data.currentBusinessDate ? text.filter.current : text.filter.past;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={text.previewLabel} title={text.title} description={text.description} />
      <div className="rounded-control border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{text.nonFiscal}</div>

      <section className="space-y-3" aria-labelledby="daily-close-business-day">
        <h3 className="text-xl font-semibold text-primary" id="daily-close-business-day">{text.sections.businessDay}</h3>
        <Card>
          <form className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end" method="get">
            <label className="space-y-2 text-sm font-semibold text-primary"><span>{text.filter.businessDate}</span><input className="min-h-12 w-full rounded-control border border-border bg-white px-3" defaultValue={data.businessDate} name="date" required type="date" /></label>
            <label className="space-y-2 text-sm font-semibold text-primary"><span>{text.filter.location}</span><select className="min-h-12 w-full rounded-control border border-border bg-white px-3" defaultValue={data.selectedLocationId ?? ""} name="location"><option value="">{text.filter.allLocations}</option>{data.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
            <button className="min-h-12 rounded-control bg-primary px-5 text-sm font-semibold text-white" type="submit">{text.filter.apply}</button>
          </form>
          <div className="mt-4 flex flex-wrap items-center gap-2"><StatusBadge tone={dayTone}>{dayLabel}</StatusBadge><span className="text-sm text-muted">{data.businessDate} · {data.timeZone}</span></div>
          {isHistoricalBusinessDate ? <div className="mt-4 rounded-control border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">{text.semantics.historicalNotice}</div> : null}
        </Card>
      </section>

      <section className="space-y-3" aria-labelledby="daily-close-orders">
        <h3 className="text-xl font-semibold text-primary" id="daily-close-orders">{text.sections.orders}</h3>
        {data.orders ? <div className="space-y-4">
          {isHistoricalBusinessDate ? <div><h4 className="font-semibold text-primary">{text.semantics.selectedDateFacts}</h4><p className="mt-1 text-sm text-muted">{text.semantics.selectedDateNote}</p></div> : null}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label={text.metrics.ordersCreated} value={data.orders.created} />
            <SummaryCard label={text.metrics.productionCompleted} tone="info" value={data.orders.productionCompleted} />
            <SummaryCard label={text.metrics.finalFulfillmentCompleted} tone="success" value={data.orders.finalFulfillmentCompleted ?? "—"} />
            <SummaryCard label={text.metrics.cancelled} tone="warning" value={data.orders.cancelled} />
          </div>
          {isHistoricalBusinessDate ? <div><h4 className="font-semibold text-primary">{text.semantics.currentState}</h4><p className="mt-1 text-sm text-muted">{text.semantics.currentStateNote}</p></div> : null}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label={text.metrics.open} tone="info" value={data.orders.open} />
            <SummaryCard label={text.metrics.onHold} tone="warning" value={data.orders.onHold} />
            <SummaryCard label={text.metrics.late} tone="critical" value={data.orders.late} />
          </div>
        </div> : <EmptyState>{text.unavailable}</EmptyState>}
      </section>

      <section className="space-y-3" aria-labelledby="daily-close-payments">
        <h3 className="text-xl font-semibold text-primary" id="daily-close-payments">{text.sections.payments}</h3>
        {data.payments ? data.payments.length ? <div className="space-y-4">{data.payments.map((payment) => <Card className="space-y-4" key={payment.currency}>
          <div className="flex items-center justify-between"><h4 className="text-lg font-semibold text-primary">{payment.currency}</h4><StatusBadge>{payment.confirmedPaymentCount} {text.metrics.confirmedPayments}</StatusBadge></div>
          {isHistoricalBusinessDate ? <h5 className="font-semibold text-primary">{text.semantics.selectedDateFacts}</h5> : null}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <SummaryCard label={text.metrics.collectedGross} value={formatCurrency(payment.collectedGross, payment.currency, locale)} />
            <SummaryCard label={text.metrics.refunds} tone="warning" value={formatCurrency(payment.refunds, payment.currency, locale)} />
            <SummaryCard label={text.metrics.collectedNet} tone="success" value={formatCurrency(payment.collectedNet, payment.currency, locale)} />
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
            {[[text.metrics.cash, payment.cashCollected], [text.metrics.card, payment.cardCollected], [text.metrics.bankTransfer, payment.bankTransferCollected], [text.metrics.other, payment.otherCollected], [text.metrics.online, payment.onlineCollected]].map(([label, amount]) => <div className="rounded-control bg-[#f7f8f7] p-3" key={String(label)}><dt className="text-muted">{label}</dt><dd className="mt-1 font-semibold text-primary">{formatCurrency(Number(amount), payment.currency, locale)}</dd></div>)}
          </dl>
          <p className="text-sm text-muted">{text.metrics.refunds}: {payment.refundCount}</p>
          {isHistoricalBusinessDate ? <div><h5 className="font-semibold text-primary">{text.semantics.currentState}</h5><p className="mt-1 text-sm text-muted">{text.semantics.currentStateNote}</p></div> : null}
          <div className="grid gap-3 sm:grid-cols-2"><SummaryCard label={text.metrics.outstanding} tone="warning" value={formatCurrency(payment.outstanding, payment.currency, locale)} /><SummaryCard label={text.metrics.outstandingOrders} tone="warning" value={payment.outstandingOrderCount} /></div>
        </Card>)}</div> : <EmptyState>{text.empty}</EmptyState> : <EmptyState>{text.unavailable}</EmptyState>}
      </section>

      <section className="space-y-3" aria-labelledby="daily-close-pos">
        <h3 className="text-xl font-semibold text-primary" id="daily-close-pos">{text.sections.pos}</h3>
        {data.pos ? <Card className="space-y-4">
          {isHistoricalBusinessDate ? <div><h4 className="font-semibold text-primary">{text.semantics.currentState}</h4><p className="mt-1 text-sm text-muted">{text.semantics.currentStateNote}</p></div> : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label={text.metrics.openSessions} tone={data.pos.openSessions ? "critical" : "success"} value={data.pos.openSessions} />
            <SummaryCard label={text.metrics.closedSessions} value={data.pos.closedSessions} />
            <SummaryCard label={text.metrics.cashWithoutSession} tone={data.pos.cashPaymentsWithoutSession ? "critical" : "success"} value={data.pos.cashPaymentsWithoutSession} />
          </div>
          {data.pos.currencies.map((currency) => <div className="grid gap-3 sm:grid-cols-3" key={currency.currency}><SummaryCard label={`${text.metrics.expectedCash} · ${currency.currency}`} value={formatCurrency(currency.expectedCash, currency.currency, locale)} /><SummaryCard label={`${text.metrics.countedCash} · ${currency.currency}`} value={formatCurrency(currency.countedCash, currency.currency, locale)} /><SummaryCard label={`${text.metrics.variance} · ${currency.currency}`} tone={currency.variance === 0 ? "success" : "warning"} value={formatCurrency(currency.variance, currency.currency, locale)} /></div>)}
        </Card> : <EmptyState>{text.unavailable}</EmptyState>}
      </section>

      <section className="space-y-3" aria-labelledby="daily-close-logistics">
        <h3 className="text-xl font-semibold text-primary" id="daily-close-logistics">{text.sections.logistics}</h3>
        {data.logistics ? <div className="space-y-4">
          {isHistoricalBusinessDate ? <div><h4 className="font-semibold text-primary">{text.semantics.currentState}</h4><p className="mt-1 text-sm text-muted">{text.semantics.currentStateNote}</p></div> : null}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><SummaryCard label={text.metrics.pickupsDue} value={data.logistics.pickupsDueOpen} /><SummaryCard label={text.metrics.deliveriesDue} value={data.logistics.deliveriesDueOpen} /><SummaryCard label={text.metrics.overduePickups} tone="critical" value={data.logistics.overduePickups} /><SummaryCard label={text.metrics.overdueDeliveries} tone="critical" value={data.logistics.overdueDeliveries} /></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><SummaryCard label={text.metrics.inProgress} tone="info" value={data.logistics.inProgress} /></div>
          <div className="grid gap-4 xl:grid-cols-2"><ItemGroup items={data.groups.incompletePickups} locale={locale} text={text} timeZone={data.timeZone} title={text.groups.incompletePickups} /><ItemGroup items={data.groups.incompleteDeliveries} locale={locale} text={text} timeZone={data.timeZone} title={text.groups.incompleteDeliveries} /></div>
        </div> : <EmptyState>{text.unavailable}</EmptyState>}
      </section>

      <section className="space-y-3" aria-labelledby="daily-close-attention">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-semibold text-primary" id="daily-close-attention">{text.sections.attention}</h3><StatusBadge tone={data.complete && data.blockers.length === 0 ? "success" : "critical"}>{data.complete && data.blockers.length === 0 ? text.blockers.ready : text.blockers.notReady}</StatusBadge></div>
        {isHistoricalBusinessDate ? <p className="rounded-control border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">{text.semantics.currentStateNote}</p> : null}
        {!data.complete ? <div className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{text.unavailable}</div> : null}
        {data.blockers.length ? <ul className="space-y-2">{data.blockers.map((blocker, index) => <li className="rounded-control border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" key={`${blocker.key}-${index}`}>{blockerText(data, index, text)}</li>)}</ul> : <EmptyState>{text.blockers.none}</EmptyState>}
        {data.groups.anomalies.length ? <div className="grid gap-4 xl:grid-cols-2">{data.groups.anomalies.map((item) => <DailyCloseCard item={item} key={`anomaly-${item.id}-${item.paymentStatus ?? item.status}`} locale={locale} text={text} timeZone={data.timeZone} />)}</div> : null}
      </section>
    </div>
  );
}
