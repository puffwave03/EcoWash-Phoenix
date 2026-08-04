import { Card } from "@/components/Card";
import {
  EmptyState,
  PageHeader,
  SectionHeader,
  StatusBadge,
  SummaryCard,
  type Tone,
} from "@/components/operational/OperationalUi";
import { Link } from "@/i18n/navigation";
import type {
  DailyCloseData,
  DailyCloseGroupKey,
  DailyCloseItem,
} from "@/features/daily-close/types";
import type { FulfillmentStatus } from "@/features/logistics/types";
import type { ProductionStatus } from "@/features/orders/types";
import type { DerivedPaymentStatus } from "@/features/payments/types";

type DailyCloseText = {
  anomalies: Record<"late" | "onHold" | "payment" | "logistics", string>;
  description: string;
  empty: string;
  groups: Record<DailyCloseGroupKey, string>;
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
  paymentStatuses: Record<DerivedPaymentStatus, string>;
  statuses: Record<FulfillmentStatus | ProductionStatus, string>;
  summary: Record<DailyCloseGroupKey, string>;
  title: string;
};

const groupOrder: DailyCloseGroupKey[] = [
  "completedToday",
  "openOrders",
  "onHoldOrders",
  "lateOrders",
  "incompletePickups",
  "incompleteDeliveries",
  "paymentIssues",
  "anomalies",
];

const groupTone: Record<DailyCloseGroupKey, Tone> = {
  anomalies: "warning",
  completedToday: "success",
  incompleteDeliveries: "warning",
  incompletePickups: "warning",
  lateOrders: "critical",
  onHoldOrders: "warning",
  openOrders: "info",
  paymentIssues: "warning",
};

function formatDateTime(value: string | null, locale: string, timeZone: string) {
  return value
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone,
      }).format(new Date(value))
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
  if (item.isLate) return text.anomalies.late;

  return text.anomalies.logistics;
}

function DailyCloseCard({
  item,
  locale,
  text,
  timeZone,
}: {
  item: DailyCloseItem;
  locale: string;
  text: DailyCloseText;
  timeZone: string;
}) {
  const tone = statusTone(item);

  return (
    <article className={`rounded-card border bg-white px-4 py-4 shadow-sm transition-standard hover:-translate-y-0.5 hover:shadow-card ${item.isLate ? "border-red-200" : "border-border"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={tone}>
              {text.statuses[item.status]}
            </StatusBadge>
            {item.kind === "anomaly" || item.isLate || item.paymentStatus ? (
              <StatusBadge tone={item.isLate ? "critical" : "warning"}>
                {anomalyLabel(item, text)}
              </StatusBadge>
            ) : null}
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">{text.labels.order}</p>
          <h3 className="mt-1 truncate text-lg font-semibold text-primary">{item.orderNumber}</h3>
          <p className="mt-1 truncate text-sm font-medium text-muted">{item.customerName}</p>
        </div>
        <Link
          className="inline-flex min-h-10 items-center justify-center rounded-control border border-primary px-3 text-sm font-semibold text-primary transition-standard hover:bg-primary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          href={`/app/orders/${item.orderId}`}
          locale={locale}
        >
          {text.labels.view}
        </Link>
      </div>

      <dl className="mt-4 grid gap-3 rounded-control bg-[#fbfbf8] p-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-primary">{text.labels.time}</dt>
          <dd className="text-muted">{formatDateTime(item.timestamp, locale, timeZone)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-primary">{text.labels.assignedTo}</dt>
          <dd className="text-muted">{item.assignedToName || "-"}</dd>
        </div>
        <div>
          <dt className="font-semibold text-primary">{text.labels.property}</dt>
          <dd className="text-muted">{item.propertyName || "-"}</dd>
        </div>
        {item.missingAmount ? (
          <div>
            <dt className="font-semibold text-primary">{text.labels.missingAmount}</dt>
            <dd className="font-semibold text-red-700">{item.missingAmount}</dd>
          </div>
        ) : null}
        {item.paymentStatus ? (
          <div>
            <dt className="font-semibold text-primary">{text.labels.status}</dt>
            <dd className="text-muted">{text.paymentStatuses[item.paymentStatus]}</dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}

export function DailyCloseDashboard({
  data,
  locale,
  text,
}: {
  data: DailyCloseData;
  locale: string;
  text: DailyCloseText;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={text.title} description={text.description} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={text.title}>
        {groupOrder.map((group) => (
          <SummaryCard
            key={group}
            label={text.summary[group]}
            tone={groupTone[group]}
            value={data.summary[group]}
          />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {groupOrder.map((group) => {
          const items = data.groups[group];

          return (
            <Card className="space-y-4 bg-white/95" key={group}>
              <SectionHeader count={items.length} title={text.groups[group]} tone={groupTone[group]} />
              {items.length === 0 ? (
                <EmptyState>{text.empty}</EmptyState>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <DailyCloseCard
                      item={item}
                      key={`${group}-${item.kind}-${item.id}`}
                      locale={locale}
                      text={text}
                      timeZone={data.timeZone}
                    />
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </section>
    </div>
  );
}
