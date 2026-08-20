import { Link } from "@/i18n/navigation";
import type {
  MyDayActivity,
  MyDayActivityKind,
  MyDayActivityPriority,
  MyDayData,
} from "@/features/work/types";

type MyDayDashboardText = {
  activityKinds: Record<MyDayActivityKind, string>;
  assignedTo: string;
  emptyDescription: string;
  emptyTitle: string;
  greeting: string;
  myActivities: string;
  nextActivity: string;
  nextEmpty: string;
  noTime: string;
  openDelivery: string;
  openPickup: string;
  openProduction: string;
  order: string;
  priorityLabels: Record<MyDayActivityPriority, string>;
  resumeActivity: string;
  teamActivities: string;
  today: string;
  todaySummary: string;
  urgent: string;
  workflowStatuses: Record<string, string>;
};

type MyDayDashboardProps = {
  data: MyDayData;
  locale: string;
  text: MyDayDashboardText;
};

const priorityClasses: Record<MyDayActivityPriority, string> = {
  assigned: "border-border bg-[#eef1ee] text-muted",
  in_progress: "border-primary/20 bg-primary-soft text-primary",
  overdue: "border-red-200 bg-red-50 text-red-700",
  scheduled: "border-border bg-white text-muted",
  upcoming: "border-amber-200 bg-amber-50 text-amber-800",
};

function dateKey(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).format(value);
}

function formatToday(value: string, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeZone,
  }).format(new Date(value));
}

function formatActivityTime(
  value: string | null,
  generatedAt: string,
  locale: string,
  timeZone: string,
  noTime: string,
) {
  if (!value) return noTime;

  const date = new Date(value);
  const isToday = dateKey(date, timeZone) === dateKey(new Date(generatedAt), timeZone);

  return new Intl.DateTimeFormat(locale, {
    ...(isToday ? {} : { day: "2-digit", month: "short" as const }),
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

function activityHref(activity: MyDayActivity) {
  const section = activity.kind === "pickup" || activity.kind === "delivery"
    ? "logistics"
    : "production";

  return `/app/orders/${activity.orderId}#${section}`;
}

function actionLabel(activity: MyDayActivity, text: MyDayDashboardText) {
  if (activity.isInProgress) return text.resumeActivity;
  if (activity.kind === "pickup") return text.openPickup;
  if (activity.kind === "delivery") return text.openDelivery;

  return text.openProduction;
}

function PriorityBadge({
  priority,
  text,
}: {
  priority: MyDayActivityPriority;
  text: MyDayDashboardText;
}) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityClasses[priority]}`}>
      {text.priorityLabels[priority]}
    </span>
  );
}

function ActivityContext({ activity }: { activity: MyDayActivity }) {
  return (
    <div className="min-w-0">
      <h4 className="truncate text-lg font-semibold text-primary">
        {activity.propertyName || activity.customerName || activity.orderNumber}
      </h4>
      {activity.propertyName && activity.customerName ? (
        <p className="mt-1 truncate text-sm text-muted">{activity.customerName}</p>
      ) : null}
      {activity.city ? (
        <p className="mt-1 truncate text-sm font-medium text-foreground">{activity.city}</p>
      ) : null}
    </div>
  );
}

function NextActivityCard({
  activity,
  data,
  locale,
  text,
}: {
  activity: MyDayActivity | null;
  data: MyDayData;
  locale: string;
  text: MyDayDashboardText;
}) {
  if (!activity) {
    return (
      <div className="rounded-card border border-dashed border-primary/25 bg-white p-6 text-sm leading-6 text-muted shadow-card">
        {text.nextEmpty}
      </div>
    );
  }

  return (
    <article className="overflow-hidden rounded-card border border-primary/15 bg-white shadow-card">
      <div className="border-b border-primary/10 bg-primary-soft px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-3xl font-semibold tracking-tight text-primary">
            {formatActivityTime(activity.timestamp, data.generatedAt, locale, data.timeZone, text.noTime)}
          </p>
          <PriorityBadge priority={activity.priority} text={text} />
        </div>
        <p className="mt-3 text-sm font-semibold uppercase tracking-[0.12em] text-primary/70">
          {text.activityKinds[activity.kind]}
        </p>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <ActivityContext activity={activity} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-muted">
          <span>{text.order} {activity.orderNumber}</span>
          <span>{text.workflowStatuses[activity.workflowStatus]}</span>
          {data.isSupervision && activity.assignedToName ? (
            <span>{text.assignedTo}: {activity.assignedToName}</span>
          ) : null}
        </div>
        <Link
          className="inline-flex min-h-12 w-full items-center justify-center rounded-control bg-primary px-5 text-center text-sm font-semibold text-white shadow-card transition-standard hover:bg-primary-strong hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          href={activityHref(activity)}
          locale={locale}
        >
          {actionLabel(activity, text)}
        </Link>
      </div>
    </article>
  );
}

function ActivityCard({
  activity,
  data,
  locale,
  text,
}: {
  activity: MyDayActivity;
  data: MyDayData;
  locale: string;
  text: MyDayDashboardText;
}) {
  return (
    <article className="rounded-card border border-border bg-white p-4 shadow-sm sm:p-5">
      <div className="grid gap-4 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-start">
        <div>
          <p className="text-lg font-semibold text-primary">
            {formatActivityTime(activity.timestamp, data.generatedAt, locale, data.timeZone, text.noTime)}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">
            {text.activityKinds[activity.kind]}
          </p>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={activity.priority} text={text} />
            <span className="text-xs font-semibold text-muted">
              {text.workflowStatuses[activity.workflowStatus]}
            </span>
          </div>
          <ActivityContext activity={activity} />
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-muted">
            <span>{text.order} {activity.orderNumber}</span>
            {data.isSupervision && activity.assignedToName ? (
              <span>{text.assignedTo}: {activity.assignedToName}</span>
            ) : null}
          </div>
        </div>

        <Link
          className="inline-flex min-h-11 w-full items-center justify-center rounded-control border border-primary px-4 text-sm font-semibold text-primary transition-standard hover:bg-primary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:w-auto"
          href={activityHref(activity)}
          locale={locale}
        >
          {actionLabel(activity, text)}
        </Link>
      </div>
    </article>
  );
}

export function MyDayDashboard({ data, locale, text }: MyDayDashboardProps) {
  const summaryKinds: MyDayActivityKind[] = ["pickup", "production", "quality", "delivery"];
  const activitiesTitle = data.isSupervision ? text.teamActivities : text.myActivities;

  return (
    <div className="mx-auto max-w-6xl space-y-5 lg:space-y-6">
      <section className="rounded-card bg-[#09291f] px-5 py-6 text-white shadow-card sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
          {text.today}
        </p>
        <h2 className="mt-3 text-2xl font-semibold leading-tight text-white sm:text-3xl">
          {text.greeting}{data.profileName ? `, ${data.profileName}` : ""}
        </h2>
        <p className="mt-2 text-sm capitalize text-white/72">
          {formatToday(data.generatedAt, locale, data.timeZone)}
        </p>
        <p className="mt-5 text-sm font-semibold text-secondary">
          {data.summary.total} {text.todaySummary} · {data.summary.urgent} {text.urgent}
        </p>
      </section>

      <section aria-label={text.todaySummary} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summaryKinds.map((kind) => (
          <div className="rounded-card border border-border bg-white px-4 py-4 shadow-sm" key={kind}>
            <p className="text-2xl font-semibold text-primary">{data.summary[kind]}</p>
            <p className="mt-1 text-sm font-medium text-muted">{text.activityKinds[kind]}</p>
          </div>
        ))}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.35fr)]">
        <section className="space-y-3 lg:sticky lg:top-6">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            {text.nextActivity}
          </h3>
          <NextActivityCard activity={data.nextActivity} data={data} locale={locale} text={text} />
        </section>

        <section className="min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-semibold text-primary">{activitiesTitle}</h3>
            {data.summary.urgent > 0 ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                {data.summary.urgent} {text.urgent}
              </span>
            ) : null}
          </div>

          {data.activities.length === 0 ? (
            <div className="rounded-card border border-dashed border-border bg-white p-6 shadow-sm">
              <h4 className="text-base font-semibold text-primary">{text.emptyTitle}</h4>
              <p className="mt-2 text-sm leading-6 text-muted">{text.emptyDescription}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.activities.map((activity) => (
                <ActivityCard
                  activity={activity}
                  data={data}
                  key={activity.id}
                  locale={locale}
                  text={text}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
