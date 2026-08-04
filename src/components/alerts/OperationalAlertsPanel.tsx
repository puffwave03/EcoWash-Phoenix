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
  OperationalAlert,
  OperationalAlertsData,
  OperationalAlertSeverity,
  OperationalAlertType,
} from "@/features/alerts/types";
import type { FulfillmentStatus } from "@/features/logistics/types";
import type { ProductionStatus } from "@/features/orders/types";
import type { DerivedPaymentStatus } from "@/features/payments/types";

type OperationalAlertsText = {
  description: string;
  empty: string;
  labels: {
    assignedTo: string;
    customer: string;
    missingAmount: string;
    order: string;
    property: string;
    time: string;
    view: string;
  };
  paymentStatuses: Record<DerivedPaymentStatus, string>;
  sections: Record<OperationalAlertSeverity, string>;
  severities: Record<OperationalAlertSeverity, string>;
  statuses: Record<FulfillmentStatus | ProductionStatus, string>;
  summary: {
    critical: string;
    info: string;
    total: string;
    warning: string;
  };
  title: string;
  types: Record<OperationalAlertType, string>;
};

const severityOrder: OperationalAlertSeverity[] = ["critical", "warning", "info"];
const severityTone: Record<OperationalAlertSeverity, Tone> = {
  critical: "critical",
  info: "info",
  warning: "warning",
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

function AlertCard({
  alert,
  locale,
  text,
  timeZone,
}: {
  alert: OperationalAlert;
  locale: string;
  text: OperationalAlertsText;
  timeZone: string;
}) {
  const tone = severityTone[alert.severity];

  return (
    <article className={`rounded-card border bg-white px-4 py-4 shadow-sm transition-standard hover:-translate-y-0.5 hover:shadow-card ${alert.severity === "critical" ? "border-red-200" : "border-border"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={tone}>
              {text.severities[alert.severity]}
            </StatusBadge>
            <StatusBadge>
              {text.statuses[alert.status]}
            </StatusBadge>
          </div>
          <h3 className="mt-3 text-lg font-semibold text-primary">{text.types[alert.type]}</h3>
          <p className="mt-1 text-sm font-medium text-muted">
            {text.labels.order}: {alert.orderNumber}
          </p>
        </div>
        <Link
          className="inline-flex min-h-10 items-center justify-center rounded-control border border-primary px-3 text-sm font-semibold text-primary transition-standard hover:bg-primary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          href={`/app/orders/${alert.orderId}`}
          locale={locale}
        >
          {text.labels.view}
        </Link>
      </div>

      <dl className="mt-4 grid gap-3 rounded-control bg-[#fbfbf8] p-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-primary">{text.labels.time}</dt>
          <dd className="text-muted">{formatDateTime(alert.timestamp, locale, timeZone)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-primary">{text.labels.assignedTo}</dt>
          <dd className="text-muted">{alert.assignedToName || "-"}</dd>
        </div>
        <div>
          <dt className="font-semibold text-primary">{text.labels.customer}</dt>
          <dd className="text-muted">{alert.customerName || "-"}</dd>
        </div>
        <div>
          <dt className="font-semibold text-primary">{text.labels.property}</dt>
          <dd className="text-muted">{alert.propertyName || "-"}</dd>
        </div>
        {alert.missingAmount ? (
          <div>
            <dt className="font-semibold text-primary">{text.labels.missingAmount}</dt>
            <dd className="font-semibold text-red-700">{alert.missingAmount}</dd>
          </div>
        ) : null}
        {alert.paymentStatus ? (
          <div>
            <dt className="font-semibold text-primary">{text.types.payment_issue}</dt>
            <dd className="text-muted">{text.paymentStatuses[alert.paymentStatus]}</dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}

export function OperationalAlertsPanel({
  data,
  locale,
  text,
}: {
  data: OperationalAlertsData;
  locale: string;
  text: OperationalAlertsText;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={text.title} description={text.description} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={text.title}>
        <SummaryCard label={text.summary.total} value={data.summary.total} />
        <SummaryCard label={text.summary.critical} tone="critical" value={data.summary.critical} />
        <SummaryCard label={text.summary.warning} tone="warning" value={data.summary.warning} />
        <SummaryCard label={text.summary.info} tone="info" value={data.summary.info} />
      </section>

      {data.alerts.length === 0 ? (
        <Card>
          <EmptyState>{text.empty}</EmptyState>
        </Card>
      ) : (
        <section className="grid gap-4 xl:grid-cols-3">
          {severityOrder.map((severity) => {
            const alerts = data.alerts.filter((alert) => alert.severity === severity);

            return (
              <Card className="space-y-4 bg-white/95" key={severity}>
                <SectionHeader count={alerts.length} title={text.sections[severity]} tone={severityTone[severity]} />
                {alerts.length === 0 ? (
                  <EmptyState>{text.empty}</EmptyState>
                ) : (
                  <div className="space-y-3">
                    {alerts.map((alert) => (
                      <AlertCard
                        alert={alert}
                        key={alert.id}
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
      )}
    </div>
  );
}
