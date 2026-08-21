import { Link } from "@/i18n/navigation";
import { operationalPrimaryActionClasses } from "@/components/operational/OperationalUi";
import type {
  ProductionGroup,
  ProductionTask,
  ProductionUrgency,
  ProductionWorkspaceData,
} from "@/features/production/types";
import type {
  OrderPriority,
  ProductionStatus,
} from "@/features/orders/types";

export type ProductionWorkspaceText = {
  assignedTo: string;
  due: string;
  empty: string;
  groups: Record<ProductionGroup, string>;
  nextEmpty: string;
  nextOrder: string;
  noDeadline: string;
  openTask: string;
  order: string;
  priority: string;
  priorities: Record<OrderPriority, string>;
  queueMine: string;
  queueTeam: string;
  services: string;
  statuses: Record<ProductionStatus, string>;
  subtitle: string;
  tasks: string;
  title: string;
  today: string;
  units: { piece: string; weight: string };
  urgencies: Record<ProductionUrgency, string>;
};

type ProductionWorkspaceProps = {
  data: ProductionWorkspaceData;
  locale: string;
  text: ProductionWorkspaceText;
};

const groupOrder: ProductionGroup[] = [
  "toStart",
  "inProgress",
  "toCheck",
  "ready",
];

const urgencyClasses: Record<ProductionUrgency, string> = {
  due_soon: "border-amber-200 bg-amber-50 text-amber-800",
  in_progress: "border-primary/20 bg-primary-soft text-primary",
  overdue: "border-red-200 bg-red-50 text-red-700",
  scheduled: "border-border bg-white text-muted",
  unscheduled: "border-border bg-[#f5f7f5] text-muted",
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

function formatDue(
  value: string | null,
  generatedAt: string,
  locale: string,
  timeZone: string,
  fallback: string,
) {
  if (!value) return fallback;

  const due = new Date(value);
  const isToday = dateKey(due, timeZone) === dateKey(new Date(generatedAt), timeZone);

  return new Intl.DateTimeFormat(locale, {
    ...(isToday ? {} : { day: "2-digit", month: "short" as const }),
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(due);
}

function formatQuantity(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(value);
}

function ProductionContext({ task }: { task: ProductionTask }) {
  return (
    <div className="min-w-0">
      <h4 className="truncate text-base font-semibold text-primary">
        {task.propertyName || task.customerName || task.orderNumber}
      </h4>
      {task.propertyName && task.customerName ? (
        <p className="mt-0.5 truncate text-sm text-muted">{task.customerName}</p>
      ) : null}
    </div>
  );
}

function UrgencyBadge({
  task,
  text,
}: {
  task: ProductionTask;
  text: ProductionWorkspaceText;
}) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${urgencyClasses[task.urgency]}`}>
      {text.urgencies[task.urgency]}
    </span>
  );
}

function QuantitySummary({
  locale,
  task,
  text,
}: {
  locale: string;
  task: ProductionTask;
  text: ProductionWorkspaceText;
}) {
  if (task.totalWeight <= 0 && task.totalPieces <= 0) return null;

  return (
    <p className="text-sm font-medium text-foreground">
      {[
        task.totalWeight > 0
          ? `${formatQuantity(task.totalWeight, locale)} ${text.units.weight}`
          : null,
        task.totalPieces > 0
          ? `${formatQuantity(task.totalPieces, locale)} ${text.units.piece}`
          : null,
      ].filter(Boolean).join(" · ")}
    </p>
  );
}

function ProductionTaskCard({
  data,
  locale,
  task,
  text,
}: ProductionWorkspaceProps & { task: ProductionTask }) {
  return (
    <article className="rounded-card border border-border bg-white p-4 shadow-sm sm:p-5">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <ProductionContext task={task} />
          <UrgencyBadge task={task} text={text} />
        </div>

        <div className="rounded-control border border-primary/15 bg-primary-soft/60 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/65">
            {text.order} {task.orderNumber}
          </p>
          <p className="mt-1 text-lg font-semibold leading-tight text-primary">
            {text.statuses[task.productionStatus]}
          </p>
        </div>

        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{text.due}</p>
            <p className="mt-0.5 font-semibold text-foreground">
              {formatDue(task.dueAt, data.generatedAt, locale, data.timeZone, text.noDeadline)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{text.priority}</p>
            <p className="mt-0.5 font-semibold text-foreground">{text.priorities[task.priority]}</p>
          </div>
        </div>

        <QuantitySummary locale={locale} task={task} text={text} />

        {task.serviceNames.length > 0 ? (
          <p className="line-clamp-2 text-sm leading-5 text-muted">
            <span className="font-semibold text-foreground">{text.services}:</span>{" "}
            {task.serviceNames.join(", ")}
          </p>
        ) : null}

        {task.note ? (
          <p className="line-clamp-2 rounded-control bg-[#f5f7f5] px-3 py-2 text-sm leading-5 text-foreground">
            {task.note}
          </p>
        ) : null}

        {task.onHoldReason ? (
          <p className="rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
            {task.onHoldReason}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs font-semibold text-muted">
          {task.assignedToName ? (
            <span>{text.assignedTo}: {task.assignedToName}</span>
          ) : null}
          <Link
            className={`${operationalPrimaryActionClasses} sm:ml-auto sm:w-auto`}
            href={`/app/work/production/${task.id}`}
            locale={locale}
          >
            {text.openTask}
          </Link>
        </div>
      </div>
    </article>
  );
}

function NextOrder({ data, locale, text }: ProductionWorkspaceProps) {
  const task = data.nextOrder;

  if (!task) {
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
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/65">
              {text.order} {task.orderNumber}
            </p>
            <p className="mt-2 text-2xl font-semibold leading-tight text-primary">
              {text.statuses[task.productionStatus]}
            </p>
          </div>
          <UrgencyBadge task={task} text={text} />
        </div>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <ProductionContext task={task} />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          <span className="font-semibold text-foreground">
            {formatDue(task.dueAt, data.generatedAt, locale, data.timeZone, text.noDeadline)}
          </span>
          <span>{text.priorities[task.priority]}</span>
          {data.isSupervision && task.assignedToName ? (
            <span>{text.assignedTo}: {task.assignedToName}</span>
          ) : null}
        </div>
        <QuantitySummary locale={locale} task={task} text={text} />
        <Link
          className={operationalPrimaryActionClasses}
          href={`/app/work/production/${task.id}`}
          locale={locale}
        >
          {text.openTask}
        </Link>
      </div>
    </article>
  );
}

export function ProductionWorkspace({ data, locale, text }: ProductionWorkspaceProps) {
  const queueTitle = data.isSupervision ? text.queueTeam : text.queueMine;

  return (
    <div className="mx-auto max-w-5xl space-y-5 lg:space-y-6">
      <section className="rounded-card border border-border bg-white px-4 py-4 shadow-sm sm:px-6 sm:py-5 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">{text.today}</p>
            <h2 className="mt-1.5 text-2xl font-semibold leading-tight text-primary sm:text-3xl">{text.title}</h2>
            <p className="mt-1 text-sm capitalize text-muted">
              {formatToday(data.generatedAt, locale, data.timeZone)}
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-5 text-muted">{text.subtitle}</p>
          </div>
          <span className="rounded-full bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary">
            {data.summary.total} {text.tasks}
          </span>
        </div>
      </section>

      <section aria-label={queueTitle} className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        {groupOrder.map((group) => (
          <a className="rounded-card border border-border bg-white px-3.5 py-3 shadow-sm transition-standard hover:border-primary/25 hover:bg-primary-soft/40" href={`#production-${group}`} key={group}>
            <p className="text-xl font-semibold leading-none text-primary sm:text-2xl">{data.summary[group]}</p>
            <p className="mt-1.5 text-sm font-medium leading-4 text-muted">{text.groups[group]}</p>
          </a>
        ))}
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(18rem,0.75fr)_minmax(0,1.4fr)] lg:gap-6">
        <section className="space-y-2.5 lg:sticky lg:top-24">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{text.nextOrder}</h3>
          <NextOrder data={data} locale={locale} text={text} />
        </section>

        <section className="min-w-0 space-y-5">
          <h3 className="text-xl font-semibold text-primary">{queueTitle}</h3>
          {data.tasks.length === 0 ? (
            <div className="rounded-card border border-dashed border-border bg-white p-6 text-sm leading-6 text-muted shadow-sm">
              {text.empty}
            </div>
          ) : (
            groupOrder.map((group) => {
              const tasks = data.tasks.filter((task) => task.group === group);

              return (
                <section className="scroll-mt-24 space-y-2.5" id={`production-${group}`} key={group}>
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-lg font-semibold text-primary">{text.groups[group]}</h4>
                    <span className="min-w-8 rounded-full bg-primary-soft px-2.5 py-1 text-center text-xs font-semibold text-primary">
                      {tasks.length}
                    </span>
                  </div>
                  {tasks.length === 0 ? (
                    <p className="rounded-card border border-dashed border-border bg-white px-4 py-5 text-sm text-muted">
                      {text.empty}
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {tasks.map((task) => (
                        <ProductionTaskCard data={data} key={task.id} locale={locale} task={task} text={text} />
                      ))}
                    </div>
                  )}
                </section>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}
