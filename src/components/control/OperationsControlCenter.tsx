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
  ControlActivity,
  ControlActivityKind,
  ControlCenterData,
  ControlException,
  ControlExceptionSeverity,
  ControlExceptionType,
} from "@/features/control/types";
import type { MyDayActivityPriority, MyDayWorkflowStatus } from "@/features/work/types";
import { Link } from "@/i18n/navigation";

type QuickLinkKey =
  | "pickups"
  | "production"
  | "quality"
  | "deliveries"
  | "orders"
  | "alerts"
  | "dailyClose";

export type OperationsControlCenterText = {
  active: string;
  assignedTo: string;
  description: string;
  exceptionTypes: Record<ControlExceptionType, string>;
  exceptionsDescription: string;
  exceptionsEmpty: string;
  exceptionsTitle: string;
  highestLoad: string;
  inProgress: string;
  kinds: Record<ControlActivityKind, string>;
  links: Record<QuickLinkKey, string>;
  noTime: string;
  open: string;
  order: string;
  overdue: string;
  priorities: Record<MyDayActivityPriority, string>;
  quickLinksDescription: string;
  quickLinksTitle: string;
  statuses: Record<MyDayWorkflowStatus, string>;
  summary: {
    deliveries: string;
    inProgress: string;
    overdue: string;
    pickups: string;
    production: string;
    quality: string;
  };
  summaryTitle: string;
  title: string;
  today: string;
  unknownAssignee: string;
  upcomingDescription: string;
  upcomingEmpty: string;
  upcomingTitle: string;
  workloadDescription: string;
  workloadEmpty: string;
  workloadTitle: string;
};

const severityTones: Record<ControlExceptionSeverity, Tone> = {
  critical: "critical",
  info: "info",
  warning: "warning",
};

const priorityTones: Record<MyDayActivityPriority, Tone> = {
  assigned: "neutral",
  in_progress: "info",
  overdue: "critical",
  scheduled: "neutral",
  upcoming: "warning",
};

const quickLinks: { href: string; key: QuickLinkKey }[] = [
  { href: "/app/work/pickups", key: "pickups" },
  { href: "/app/work/production", key: "production" },
  { href: "/app/work/quality", key: "quality" },
  { href: "/app/work/deliveries", key: "deliveries" },
  { href: "/app/orders", key: "orders" },
  { href: "/app/alerts", key: "alerts" },
  { href: "/app/daily-close", key: "dailyClose" },
];

function formatToday(value: string, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeZone,
  }).format(new Date(value));
}

function formatDateTime(
  value: string | null,
  locale: string,
  timeZone: string,
  fallback: string,
) {
  return value
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone,
      }).format(new Date(value))
    : fallback;
}

function Context({
  customerName,
  orderNumber,
  propertyName,
  text,
}: {
  customerName: string;
  orderNumber: string;
  propertyName: string | null;
  text: OperationsControlCenterText;
}) {
  return (
    <div className="min-w-0">
      <p className="break-words text-sm font-semibold text-primary">
        {propertyName || customerName || orderNumber}
      </p>
      {propertyName && customerName ? (
        <p className="mt-0.5 break-words text-sm text-muted">{customerName}</p>
      ) : null}
      <p className="mt-1 text-xs font-semibold text-muted">
        {text.order} {orderNumber}
      </p>
    </div>
  );
}

function ExceptionRow({
  exception,
  locale,
  text,
  timeZone,
}: {
  exception: ControlException;
  locale: string;
  text: OperationsControlCenterText;
  timeZone: string;
}) {
  return (
    <article className="grid gap-3 border-b border-border py-4 first:pt-0 last:border-b-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={severityTones[exception.severity]}>
            {text.exceptionTypes[exception.type]}
          </StatusBadge>
          <StatusBadge>{text.kinds[exception.kind]}</StatusBadge>
          <span className="text-xs font-semibold text-muted">
            {text.statuses[exception.status]}
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <Context
            customerName={exception.customerName}
            orderNumber={exception.orderNumber}
            propertyName={exception.propertyName}
            text={text}
          />
          <div className="text-xs font-medium text-muted sm:text-right">
            <p>{formatDateTime(exception.timestamp, locale, timeZone, text.noTime)}</p>
            {exception.assignedToName ? (
              <p className="mt-1">{text.assignedTo}: {exception.assignedToName}</p>
            ) : null}
          </div>
        </div>
      </div>
      <Link
        className="inline-flex min-h-11 w-full items-center justify-center rounded-control border border-primary/25 bg-primary-soft px-4 text-sm font-semibold text-primary transition-standard hover:border-primary/40 hover:bg-[#dcebe4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:w-auto"
        href={exception.href}
        locale={locale}
      >
        {text.open}
      </Link>
    </article>
  );
}

function UpcomingRow({
  activity,
  locale,
  text,
  timeZone,
}: {
  activity: ControlActivity;
  locale: string;
  text: OperationsControlCenterText;
  timeZone: string;
}) {
  return (
    <article className="border-b border-border py-3.5 first:pt-0 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusBadge tone={priorityTones[activity.priority]}>
          {text.priorities[activity.priority]}
        </StatusBadge>
        <span className="text-xs font-semibold text-muted">
          {formatDateTime(activity.timestamp, locale, timeZone, text.noTime)}
        </span>
      </div>
      <div className="mt-3">
        <Context
          customerName={activity.customerName}
          orderNumber={activity.orderNumber}
          propertyName={activity.propertyName}
          text={text}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-muted">
        <span>{text.kinds[activity.kind]} · {text.statuses[activity.status]}</span>
        <Link
          className="inline-flex min-h-11 items-center rounded-control px-2 text-sm font-semibold text-primary underline decoration-primary/25 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          href={activity.href}
          locale={locale}
        >
          {text.open}
        </Link>
      </div>
    </article>
  );
}

export function OperationsControlCenter({
  data,
  locale,
  text,
}: {
  data: ControlCenterData;
  locale: string;
  text: OperationsControlCenterText;
}) {
  return (
    <div className="mx-auto max-w-7xl space-y-5 lg:space-y-6">
      <PageHeader
        description={text.description}
        eyebrow={text.today}
        title={text.title}
        action={(
          <p className="rounded-full bg-primary-soft px-3 py-2 text-sm font-semibold capitalize text-primary">
            {formatToday(data.generatedAt, locale, data.timeZone)}
          </p>
        )}
      />

      <section aria-label={text.summaryTitle} className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{text.summaryTitle}</h3>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
          <SummaryCard label={text.summary.pickups} value={data.summary.pickups} />
          <SummaryCard label={text.summary.production} value={data.summary.production} />
          <SummaryCard label={text.summary.quality} value={data.summary.quality} />
          <SummaryCard label={text.summary.deliveries} value={data.summary.deliveries} />
          <SummaryCard label={text.summary.overdue} tone="critical" value={data.summary.overdue} />
          <SummaryCard label={text.summary.inProgress} tone="info" value={data.summary.inProgress} />
        </div>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.75fr)] xl:gap-6">
        <Card className="space-y-4 bg-white p-4 sm:p-6">
          <div>
            <SectionHeader count={data.exceptions.length} title={text.exceptionsTitle} tone="critical" />
            <p className="mt-1.5 text-sm leading-5 text-muted">{text.exceptionsDescription}</p>
          </div>
          {data.exceptions.length === 0 ? (
            <EmptyState>{text.exceptionsEmpty}</EmptyState>
          ) : (
            <div>
              {data.exceptions.map((exception) => (
                <ExceptionRow
                  exception={exception}
                  key={exception.id}
                  locale={locale}
                  text={text}
                  timeZone={data.timeZone}
                />
              ))}
            </div>
          )}
        </Card>

        <Card className="space-y-4 bg-white p-4 sm:p-6 xl:sticky xl:top-24">
          <div>
            <SectionHeader count={data.upcoming.length} title={text.upcomingTitle} tone="info" />
            <p className="mt-1.5 text-sm leading-5 text-muted">{text.upcomingDescription}</p>
          </div>
          {data.upcoming.length === 0 ? (
            <EmptyState>{text.upcomingEmpty}</EmptyState>
          ) : (
            <div>
              {data.upcoming.map((activity) => (
                <UpcomingRow
                  activity={activity}
                  key={activity.id}
                  locale={locale}
                  text={text}
                  timeZone={data.timeZone}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="space-y-4 bg-white p-4 sm:p-6">
        <div>
          <SectionHeader count={data.workload.length} title={text.workloadTitle} />
          <p className="mt-1.5 text-sm leading-5 text-muted">{text.workloadDescription}</p>
        </div>
        {data.workload.length === 0 ? (
          <EmptyState>{text.workloadEmpty}</EmptyState>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.workload.map((person) => (
              <article className="rounded-card border border-border bg-[#fafbfa] p-4" key={person.assigneeId}>
                <div className="flex items-start justify-between gap-3">
                  <h4 className="break-words text-base font-semibold text-primary">
                    {person.assigneeName || text.unknownAssignee}
                  </h4>
                  {person.isHighestLoad ? (
                    <StatusBadge tone="warning">{text.highestLoad}</StatusBadge>
                  ) : null}
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[
                    [person.active, text.active],
                    [person.overdue, text.overdue],
                    [person.inProgress, text.inProgress],
                  ].map(([value, label]) => (
                    <div className="min-w-0 rounded-control bg-white px-2 py-3" key={label}>
                      <dd className="text-xl font-semibold leading-none text-primary">{value}</dd>
                      <dt className="mt-1.5 break-words text-xs font-medium leading-4 text-muted">{label}</dt>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
        )}
      </Card>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-primary">{text.quickLinksTitle}</h3>
          <p className="mt-1 text-sm leading-5 text-muted">{text.quickLinksDescription}</p>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-7">
          {quickLinks.map((item) => (
            <Link
              className="inline-flex min-h-12 min-w-0 items-center justify-between gap-2 rounded-control border border-border bg-white px-3 py-2 text-sm font-semibold text-primary transition-standard hover:border-primary/30 hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              href={item.href}
              key={item.key}
              locale={locale}
            >
              <span className="break-words">{text.links[item.key]}</span>
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
