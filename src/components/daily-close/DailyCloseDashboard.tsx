import { Card } from "@/components/Card";
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

function formatDateTime(value: string | null, locale: string, timeZone: string) {
  return value
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone,
      }).format(new Date(value))
    : "-";
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
  return (
    <article className={`rounded-card border bg-white px-4 py-4 shadow-sm ${item.isLate ? "border-red-200" : "border-border"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
              {text.statuses[item.status]}
            </span>
            {item.kind === "anomaly" || item.isLate || item.paymentStatus ? (
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.isLate ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                {anomalyLabel(item, text)}
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-xs font-semibold uppercase text-muted">{text.labels.order}</p>
          <h3 className="mt-1 truncate text-base font-semibold text-primary">{item.orderNumber}</h3>
          <p className="mt-1 truncate text-sm text-muted">{item.customerName}</p>
        </div>
        <Link
          className="inline-flex min-h-10 items-center justify-center rounded-control border border-primary px-3 text-sm font-semibold text-primary transition-standard hover:bg-primary hover:text-white"
          href={`/app/orders/${item.orderId}`}
          locale={locale}
        >
          {text.labels.view}
        </Link>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
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
      <div>
        <h2 className="text-2xl font-semibold text-primary">{text.title}</h2>
        <p className="mt-2 text-sm text-muted">{text.description}</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={text.title}>
        {groupOrder.map((group) => (
          <Card className="space-y-1" key={group}>
            <p className="text-sm font-medium text-muted">{text.summary[group]}</p>
            <p className="text-3xl font-semibold text-primary">{data.summary[group]}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {groupOrder.map((group) => {
          const items = data.groups[group];

          return (
            <Card className="space-y-4" key={group}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-primary">{text.groups[group]}</h3>
                <span className="min-w-9 rounded-full bg-primary-soft px-3 py-1 text-center text-sm font-semibold text-primary">
                  {items.length}
                </span>
              </div>
              {items.length === 0 ? (
                <p className="rounded-control border border-dashed border-border px-4 py-5 text-sm text-muted">
                  {text.empty}
                </p>
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
