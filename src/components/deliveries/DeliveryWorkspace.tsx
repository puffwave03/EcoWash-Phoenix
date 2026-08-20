import { Link } from "@/i18n/navigation";
import type {
  DeliveryPriority,
  DeliveryTask,
  DeliveryWorkspaceData,
} from "@/features/deliveries/types";

export type DeliveryWorkspaceText = {
  assignedTo: string;
  empty: string;
  inProgress: string;
  nextDelivery: string;
  nextEmpty: string;
  noTime: string;
  openDelivery: string;
  order: string;
  overdue: string;
  priorities: Record<DeliveryPriority, string>;
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

type DeliveryWorkspaceProps = {
  data: DeliveryWorkspaceData;
  locale: string;
  text: DeliveryWorkspaceText;
};

const priorityClasses: Record<DeliveryPriority, string> = {
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
  const isToday = dateKey(date, timeZone) === dateKey(new Date(generatedAt), timeZone);

  return new Intl.DateTimeFormat(locale, {
    ...(isToday ? {} : { day: "2-digit", month: "short" as const }),
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

function shortAddress(task: DeliveryTask) {
  return [task.addressLine1, task.city].filter(Boolean).join(", ");
}

function DeliveryContext({ delivery, prominent = false }: { delivery: DeliveryTask; prominent?: boolean }) {
  const address = shortAddress(delivery);

  return (
    <div className="min-w-0">
      <h4 className={`${prominent ? "text-xl" : "text-base"} font-semibold leading-tight text-primary`}>
        {delivery.propertyName || delivery.customerName || delivery.orderNumber}
      </h4>
      {delivery.propertyName && delivery.customerName ? (
        <p className="mt-1 text-sm text-muted">{delivery.customerName}</p>
      ) : null}
      {address ? (
        <p className="mt-1.5 break-words text-sm font-medium leading-5 text-foreground">{address}</p>
      ) : null}
    </div>
  );
}

function PriorityBadge({ delivery, text }: { delivery: DeliveryTask; text: DeliveryWorkspaceText }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityClasses[delivery.priority]}`}>
      {text.priorities[delivery.priority]}
    </span>
  );
}

function NextDelivery({ data, locale, text }: DeliveryWorkspaceProps) {
  const delivery = data.nextDelivery;

  if (!delivery) {
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
            {formatTime(delivery.scheduledAt, data.generatedAt, locale, data.timeZone, text.noTime)}
          </p>
          <PriorityBadge delivery={delivery} text={text} />
        </div>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <DeliveryContext delivery={delivery} prominent />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-muted">
          <span>{text.order} {delivery.orderNumber}</span>
          <span>{text.status}: {text.statuses[delivery.status]}</span>
          {data.isSupervision && delivery.assignedToName ? (
            <span>{text.assignedTo}: {delivery.assignedToName}</span>
          ) : null}
        </div>
        {delivery.notes ? (
          <p className="line-clamp-2 text-sm leading-5 text-foreground">{delivery.notes}</p>
        ) : null}
        <Link
          className="inline-flex min-h-12 w-full items-center justify-center rounded-control bg-primary px-5 text-center text-sm font-semibold text-white shadow-sm transition-standard hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          href={`/app/work/deliveries/${delivery.id}`}
          locale={locale}
        >
          {text.openDelivery}
        </Link>
      </div>
    </article>
  );
}

function DeliveryCard({ data, delivery, locale, text }: DeliveryWorkspaceProps & { delivery: DeliveryTask }) {
  return (
    <article className="rounded-card border border-border bg-white p-4 shadow-sm sm:p-5">
      <div className="grid gap-3 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:items-start sm:gap-4">
        <div className="flex items-start justify-between gap-3 sm:block">
          <p className="text-xl font-semibold leading-none text-primary">
            {formatTime(delivery.scheduledAt, data.generatedAt, locale, data.timeZone, text.noTime)}
          </p>
          <div className="sm:mt-2">
            <PriorityBadge delivery={delivery} text={text} />
          </div>
        </div>

        <div className="min-w-0 space-y-2.5">
          <DeliveryContext delivery={delivery} />
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-muted">
            <span>{text.order} {delivery.orderNumber}</span>
            <span>{text.statuses[delivery.status]}</span>
            {data.isSupervision && delivery.assignedToName ? (
              <span>{text.assignedTo}: {delivery.assignedToName}</span>
            ) : null}
          </div>
          {delivery.notes ? (
            <p className="line-clamp-2 text-sm leading-5 text-foreground">{delivery.notes}</p>
          ) : null}
        </div>

        <Link
          className="inline-flex min-h-11 w-full items-center justify-center rounded-control border border-primary/25 bg-primary-soft px-4 text-sm font-semibold text-primary-strong transition-standard hover:border-primary/40 hover:bg-[#dcebe4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:w-auto sm:bg-white"
          href={`/app/work/deliveries/${delivery.id}`}
          locale={locale}
        >
          {text.openDelivery}
        </Link>
      </div>
    </article>
  );
}

export function DeliveryWorkspace({ data, locale, text }: DeliveryWorkspaceProps) {
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
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{text.nextDelivery}</h3>
          <NextDelivery data={data} locale={locale} text={text} />
        </section>

        <section className="min-w-0 space-y-2.5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{text.queue}</p>
            <h3 className="mt-1 text-xl font-semibold text-primary">{queueTitle}</h3>
          </div>
          {data.tasks.length === 0 ? (
            <div className="rounded-card border border-dashed border-border bg-white p-6 text-sm leading-6 text-muted shadow-sm">
              {text.empty}
            </div>
          ) : (
            <div className="space-y-2.5">
              {data.tasks.map((delivery) => (
                <DeliveryCard data={data} delivery={delivery} key={delivery.id} locale={locale} text={text} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
