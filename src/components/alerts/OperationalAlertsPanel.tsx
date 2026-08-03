import { Card } from "@/components/Card";
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

function formatDateTime(value: string | null, locale: string, timeZone: string) {
  return value
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone,
      }).format(new Date(value))
    : "-";
}

function severityClasses(severity: OperationalAlertSeverity) {
  if (severity === "critical") return "border-red-200 bg-red-50 text-red-700";
  if (severity === "warning") return "border-amber-200 bg-amber-50 text-amber-700";

  return "border-primary-soft bg-primary-soft text-primary";
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
  return (
    <article className={`rounded-card border bg-white px-4 py-4 shadow-sm ${alert.severity === "critical" ? "border-red-200" : "border-border"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${severityClasses(alert.severity)}`}>
              {text.severities[alert.severity]}
            </span>
            <span className="rounded-full bg-[#eef1ee] px-3 py-1 text-xs font-semibold text-muted">
              {text.statuses[alert.status]}
            </span>
          </div>
          <h3 className="mt-3 text-base font-semibold text-primary">{text.types[alert.type]}</h3>
          <p className="mt-1 text-sm text-muted">
            {text.labels.order}: {alert.orderNumber}
          </p>
        </div>
        <Link
          className="inline-flex min-h-10 items-center justify-center rounded-control border border-primary px-3 text-sm font-semibold text-primary transition-standard hover:bg-primary hover:text-white"
          href={`/app/orders/${alert.orderId}`}
          locale={locale}
        >
          {text.labels.view}
        </Link>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
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
      <div>
        <h2 className="text-2xl font-semibold text-primary">{text.title}</h2>
        <p className="mt-2 text-sm text-muted">{text.description}</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={text.title}>
        <Card className="space-y-1">
          <p className="text-sm font-medium text-muted">{text.summary.total}</p>
          <p className="text-3xl font-semibold text-primary">{data.summary.total}</p>
        </Card>
        <Card className="space-y-1">
          <p className="text-sm font-medium text-muted">{text.summary.critical}</p>
          <p className="text-3xl font-semibold text-red-700">{data.summary.critical}</p>
        </Card>
        <Card className="space-y-1">
          <p className="text-sm font-medium text-muted">{text.summary.warning}</p>
          <p className="text-3xl font-semibold text-amber-700">{data.summary.warning}</p>
        </Card>
        <Card className="space-y-1">
          <p className="text-sm font-medium text-muted">{text.summary.info}</p>
          <p className="text-3xl font-semibold text-primary">{data.summary.info}</p>
        </Card>
      </section>

      {data.alerts.length === 0 ? (
        <Card>
          <p className="rounded-control border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
            {text.empty}
          </p>
        </Card>
      ) : (
        <section className="grid gap-4 xl:grid-cols-3">
          {severityOrder.map((severity) => {
            const alerts = data.alerts.filter((alert) => alert.severity === severity);

            return (
              <Card className="space-y-4" key={severity}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-primary">{text.sections[severity]}</h3>
                  <span className="min-w-9 rounded-full bg-primary-soft px-3 py-1 text-center text-sm font-semibold text-primary">
                    {alerts.length}
                  </span>
                </div>
                {alerts.length === 0 ? (
                  <p className="rounded-control border border-dashed border-border px-4 py-5 text-sm text-muted">
                    {text.empty}
                  </p>
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
