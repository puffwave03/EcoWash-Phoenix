import { Link } from "@/i18n/navigation";
import { operationalPrimaryActionClasses } from "@/components/operational/OperationalUi";
import type {
  OrderPriority,
  ProductionStatus,
} from "@/features/orders/types";
import type {
  ProductionTask,
  ProductionUrgency,
  QualityGroup,
  QualityWorkspaceData,
} from "@/features/production/types";
import { formatQuantity } from "@/lib/number-format";

export type QualityWorkspaceText = {
  assignedTo: string;
  due: string;
  empty: string;
  groups: Record<QualityGroup, string>;
  nextEmpty: string;
  nextOrder: string;
  noDeadline: string;
  openTask: string;
  order: string;
  priorities: Record<OrderPriority, string>;
  priority: string;
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

type QualityWorkspaceProps = {
  data: QualityWorkspaceData;
  locale: string;
  text: QualityWorkspaceText;
};

const groupOrder: QualityGroup[] = ["toCheck", "toPack"];

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

function groupForTask(task: ProductionTask): QualityGroup {
  return task.productionStatus === "quality_check" ? "toCheck" : "toPack";
}

function QuantitySummary({
  locale,
  task,
  text,
}: {
  locale: string;
  task: ProductionTask;
  text: QualityWorkspaceText;
}) {
  const values = [
    task.totalWeight > 0
      ? `${formatQuantity(task.totalWeight, locale)} ${text.units.weight}`
      : null,
    task.totalPieces > 0
      ? `${formatQuantity(task.totalPieces, locale)} ${text.units.piece}`
      : null,
  ].filter(Boolean);

  return values.length > 0 ? (
    <p className="text-sm font-semibold text-foreground">{values.join(" · ")}</p>
  ) : null;
}

function QualityCard({
  data,
  locale,
  task,
  text,
}: QualityWorkspaceProps & { task: ProductionTask }) {
  return (
    <article className="rounded-card border border-border bg-white p-4 shadow-sm sm:p-5">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              {text.order} {task.orderNumber}
            </p>
            <h4 className="mt-1 truncate text-base font-semibold text-primary">
              {task.propertyName || task.customerName || task.orderNumber}
            </h4>
            {task.propertyName && task.customerName ? (
              <p className="mt-0.5 truncate text-sm text-muted">{task.customerName}</p>
            ) : null}
          </div>
          <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${urgencyClasses[task.urgency]}`}>
            {text.urgencies[task.urgency]}
          </span>
        </div>

        <div className="rounded-control border border-primary/15 bg-primary-soft/60 px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary/65">{text.statuses[task.productionStatus]}</p>
          <p className="mt-1 text-sm font-semibold text-primary">
            {formatDue(task.dueAt, data.generatedAt, locale, data.timeZone, text.noDeadline)}
          </p>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-muted">
          <span>{text.priority}: {text.priorities[task.priority]}</span>
          {task.assignedToName ? <span>{text.assignedTo}: {task.assignedToName}</span> : null}
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

        <Link
          className={operationalPrimaryActionClasses}
          href={`/app/work/quality/${task.id}`}
          locale={locale}
        >
          {text.openTask}
        </Link>
      </div>
    </article>
  );
}

function NextQualityOrder({ data, locale, text }: QualityWorkspaceProps) {
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
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/65">
          {text.order} {task.orderNumber}
        </p>
        <p className="mt-2 text-2xl font-semibold leading-tight text-primary">
          {text.statuses[task.productionStatus]}
        </p>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <div>
          <h4 className="text-lg font-semibold text-primary">
            {task.propertyName || task.customerName || task.orderNumber}
          </h4>
          {task.propertyName && task.customerName ? (
            <p className="mt-0.5 text-sm text-muted">{task.customerName}</p>
          ) : null}
        </div>
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
          href={`/app/work/quality/${task.id}`}
          locale={locale}
        >
          {text.openTask}
        </Link>
      </div>
    </article>
  );
}

export function QualityWorkspace({ data, locale, text }: QualityWorkspaceProps) {
  const queueTitle = data.isSupervision ? text.queueTeam : text.queueMine;

  return (
    <div className="mx-auto max-w-5xl space-y-5 lg:space-y-6">
      <section className="rounded-card border border-border bg-white px-4 py-4 shadow-sm sm:px-6 sm:py-5 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">{text.today}</p>
            <h2 className="mt-1.5 text-2xl font-semibold leading-tight text-primary sm:text-3xl">{text.title}</h2>
            <p className="mt-1 text-sm capitalize text-muted">{formatToday(data.generatedAt, locale, data.timeZone)}</p>
            <p className="mt-2 max-w-2xl text-sm leading-5 text-muted">{text.subtitle}</p>
          </div>
          <span className="rounded-full bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary">
            {data.summary.total} {text.tasks}
          </span>
        </div>
      </section>

      <section aria-label={queueTitle} className="grid grid-cols-2 gap-2.5 sm:max-w-xl sm:gap-3">
        {groupOrder.map((group) => (
          <a className="rounded-card border border-border bg-white px-3.5 py-3 shadow-sm transition-standard hover:border-primary/25 hover:bg-primary-soft/40" href={`#quality-${group}`} key={group}>
            <p className="text-xl font-semibold leading-none text-primary sm:text-2xl">{data.summary[group]}</p>
            <p className="mt-1.5 text-sm font-medium leading-4 text-muted">{text.groups[group]}</p>
          </a>
        ))}
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(18rem,0.75fr)_minmax(0,1.4fr)] lg:gap-6">
        <section className="space-y-2.5 lg:sticky lg:top-24">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{text.nextOrder}</h3>
          <NextQualityOrder data={data} locale={locale} text={text} />
        </section>

        <section className="min-w-0 space-y-5">
          <h3 className="text-xl font-semibold text-primary">{queueTitle}</h3>
          {data.tasks.length === 0 ? (
            <div className="rounded-card border border-dashed border-border bg-white p-6 text-sm leading-6 text-muted shadow-sm">{text.empty}</div>
          ) : (
            groupOrder.map((group) => {
              const tasks = data.tasks.filter((task) => groupForTask(task) === group);

              return (
                <section className="scroll-mt-24 space-y-2.5" id={`quality-${group}`} key={group}>
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-lg font-semibold text-primary">{text.groups[group]}</h4>
                    <span className="min-w-8 rounded-full bg-primary-soft px-2.5 py-1 text-center text-xs font-semibold text-primary">{tasks.length}</span>
                  </div>
                  {tasks.length === 0 ? (
                    <p className="rounded-card border border-dashed border-border bg-white px-4 py-5 text-sm text-muted">{text.empty}</p>
                  ) : (
                    <div className="space-y-2.5">
                      {tasks.map((task) => (
                        <QualityCard data={data} key={task.id} locale={locale} task={task} text={text} />
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
