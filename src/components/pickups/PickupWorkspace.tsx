import { Link } from "@/i18n/navigation";
import type {
  PickupPriority,
  PickupTask,
  PickupWorkspaceData,
} from "@/features/pickups/types";

export type PickupWorkspaceText = {
  allCompleted: string;
  assignedTo: string;
  empty: string;
  inProgress: string;
  nextEmpty: string;
  nextPickup: string;
  noTime: string;
  openPickup: string;
  order: string;
  overdue: string;
  priorities: Record<PickupPriority, string>;
  queue: string;
  queueMine: string;
  queueTeam: string;
  status: string;
  statuses: Record<string, string>;
  subtitle: string;
  tasks: string;
  title: string;
  today: string;
  toDo: string;
};

type PickupWorkspaceProps = {
  data: PickupWorkspaceData;
  locale: string;
  text: PickupWorkspaceText;
};

const priorityClasses: Record<PickupPriority, string> = {
  assigned: "border-border bg-[#f5f7f5] text-muted",
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

function formatDate(value: string, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeZone,
  }).format(new Date(value));
}

function formatTime(
  value: string | null,
  generatedAt: string,
  locale: string,
  timeZone: string,
  noTime: string,
) {
  if (!value) return noTime;

  const date = new Date(value);
  const isToday =
    dateKey(date, timeZone) === dateKey(new Date(generatedAt), timeZone);

  return new Intl.DateTimeFormat(locale, {
    ...(isToday ? {} : { day: "2-digit", month: "short" as const }),
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

function shortAddress(task: PickupTask) {
  return [task.addressLine1, task.city].filter(Boolean).join(", ");
}

function PickupContext({ pickup, prominent = false }: { pickup: PickupTask; prominent?: boolean }) {
  const address = shortAddress(pickup);

  return (
    <div className="min-w-0">
      <h4 className={`${prominent ? "text-xl" : "text-base"} font-semibold leading-tight text-primary`}>
        {pickup.propertyName || pickup.customerName || pickup.orderNumber}
      </h4>
      {pickup.propertyName && pickup.customerName ? (
        <p className="mt-1 text-sm text-muted">{pickup.customerName}</p>
      ) : null}
      {address ? (
        <p className="mt-1.5 text-sm font-medium leading-5 text-foreground">{address}</p>
      ) : null}
    </div>
  );
}

function PriorityBadge({ pickup, text }: { pickup: PickupTask; text: PickupWorkspaceText }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityClasses[pickup.priority]}`}>
      {text.priorities[pickup.priority]}
    </span>
  );
}

function NextPickup({ data, locale, text }: PickupWorkspaceProps) {
  const pickup = data.nextPickup;

  if (!pickup) {
    return (
      <div className="rounded-card border border-dashed border-primary/25 bg-white p-6 text-sm leading-6 text-muted shadow-sm">
        {text.nextEmpty}
      </div>
    );
  }

  return (
    <article className="overflow-hidden rounded-card border border-primary/20 bg-white shadow-card">
      <div className="border-b border-primary/10 bg-primary-soft/70 px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-3xl font-semibold leading-none tracking-tight text-primary">
            {formatTime(pickup.scheduledAt, data.generatedAt, locale, data.timeZone, text.noTime)}
          </p>
          <PriorityBadge pickup={pickup} text={text} />
        </div>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <PickupContext pickup={pickup} prominent />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-muted">
          <span>{text.order} {pickup.orderNumber}</span>
          <span>{text.status}: {text.statuses[pickup.status]}</span>
          {data.isSupervision && pickup.assignedToName ? (
            <span>{text.assignedTo}: {pickup.assignedToName}</span>
          ) : null}
        </div>
        <Link
          className="inline-flex min-h-12 w-full items-center justify-center rounded-control bg-primary px-5 text-center text-sm font-semibold text-white shadow-sm transition-standard hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          href={`/app/work/pickups/${pickup.id}`}
          locale={locale}
        >
          {text.openPickup}
        </Link>
      </div>
    </article>
  );
}

function PickupCard({ data, locale, pickup, text }: PickupWorkspaceProps & { pickup: PickupTask }) {
  return (
    <article className="rounded-card border border-border bg-white p-4 shadow-sm sm:p-5">
      <div className="grid gap-3 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:items-start sm:gap-4">
        <div className="flex items-start justify-between gap-3 sm:block">
          <p className="text-xl font-semibold leading-none text-primary">
            {formatTime(pickup.scheduledAt, data.generatedAt, locale, data.timeZone, text.noTime)}
          </p>
          <div className="sm:mt-2">
            <PriorityBadge pickup={pickup} text={text} />
          </div>
        </div>

        <div className="min-w-0 space-y-2.5">
          <PickupContext pickup={pickup} />
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-muted">
            <span>{text.order} {pickup.orderNumber}</span>
            <span>{text.statuses[pickup.status]}</span>
            {data.isSupervision && pickup.assignedToName ? (
              <span>{text.assignedTo}: {pickup.assignedToName}</span>
            ) : null}
          </div>
          {pickup.notes ? (
            <p className="line-clamp-2 text-sm leading-5 text-foreground">{pickup.notes}</p>
          ) : null}
        </div>

        <Link
          className="inline-flex min-h-11 w-full items-center justify-center rounded-control border border-primary/25 bg-primary-soft px-4 text-sm font-semibold text-primary-strong transition-standard hover:border-primary/40 hover:bg-[#dcebe4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:w-auto sm:bg-white"
          href={`/app/work/pickups/${pickup.id}`}
          locale={locale}
        >
          {text.openPickup}
        </Link>
      </div>
    </article>
  );
}

export function PickupWorkspace({ data, locale, text }: PickupWorkspaceProps) {
  const emptyMessage = data.completedToday > 0 ? text.allCompleted : text.empty;
  const queueTitle = data.isSupervision ? text.queueTeam : text.queueMine;

  return (
    <div className="mx-auto max-w-6xl space-y-5 lg:space-y-6">
      <section className="rounded-card border border-border bg-white px-4 py-4 shadow-sm sm:px-6 sm:py-5 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">{text.today}</p>
            <h2 className="mt-1.5 text-2xl font-semibold leading-tight text-primary sm:text-3xl">{text.title}</h2>
            <p className="mt-1 text-sm capitalize text-muted">
              {formatDate(data.generatedAt, locale, data.timeZone)}
            </p>
            <p className="mt-2 max-w-xl text-sm leading-5 text-muted">{text.subtitle}</p>
          </div>
          <span className="rounded-full bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary">
            {data.summary.total} {text.tasks}
          </span>
        </div>
      </section>

      <section aria-label={text.today} className="grid grid-cols-3 gap-2.5 sm:max-w-2xl sm:gap-3">
        {[
          [data.summary.toDo, text.toDo],
          [data.summary.inProgress, text.inProgress],
          [data.summary.overdue, text.overdue],
        ].map(([value, label]) => (
          <div className="rounded-card border border-border bg-white px-3 py-3 shadow-sm sm:px-4" key={label}>
            <p className="text-xl font-semibold leading-none text-primary sm:text-2xl">{value}</p>
            <p className="mt-1.5 text-xs font-medium leading-4 text-muted sm:text-sm">{label}</p>
          </div>
        ))}
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.35fr)] lg:gap-6">
        <section className="space-y-2.5 lg:sticky lg:top-24">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{text.nextPickup}</h3>
          <NextPickup data={data} locale={locale} text={text} />
        </section>

        <section className="min-w-0 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{text.queue}</p>
              <h3 className="mt-1 text-xl font-semibold text-primary">{queueTitle}</h3>
            </div>
          </div>
          {data.tasks.length === 0 ? (
            <div className="rounded-card border border-dashed border-border bg-white p-6 text-sm leading-6 text-muted shadow-sm">
              {emptyMessage}
            </div>
          ) : (
            <div className="space-y-2.5">
              {data.tasks.map((pickup) => (
                <PickupCard data={data} key={pickup.id} locale={locale} pickup={pickup} text={text} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
