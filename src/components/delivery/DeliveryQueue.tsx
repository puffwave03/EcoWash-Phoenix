"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/Card";
import { Link } from "@/i18n/navigation";
import type { DeliveryQueueTask } from "@/features/logistics/server/queries";
import type { FulfillmentStatus } from "@/features/logistics/types";

type DeliveryTaskKind = DeliveryQueueTask["kind"];
type DeliveryGroupKey = "today" | "upcoming" | "inProgress" | "completedToday";
type AssignmentFilter = "all" | "mine" | "unassigned";

type DeliveryQueueText = {
  address: string;
  assignedTo: string;
  customer: string;
  delivery: string;
  dueSoon: string;
  empty: string;
  filters: Record<AssignmentFilter, string>;
  groups: Record<DeliveryGroupKey, string>;
  late: string;
  order: string;
  phone: string;
  pickup: string;
  property: string;
  statuses: Record<FulfillmentStatus, string>;
  view: string;
};

const groups: DeliveryGroupKey[] = ["inProgress", "today", "upcoming", "completedToday"];

function dateKey(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).format(value);
}

function formatDateTime(value: string | null, locale: string, timeZone: string) {
  return value
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone,
      }).format(new Date(value))
    : "-";
}

function formatAddress(task: DeliveryQueueTask) {
  return [
    task.addressLine1,
    task.addressLine2,
    task.city,
    task.postalCode,
    task.countryCode,
  ].filter(Boolean).join(", ");
}

function isToday(value: string | null, now: Date, timeZone: string) {
  return value ? dateKey(new Date(value), timeZone) === dateKey(now, timeZone) : false;
}

function groupTasks(tasks: DeliveryQueueTask[], group: DeliveryGroupKey, now: Date, timeZone: string) {
  return tasks.filter((task) => {
    if (group === "inProgress") return task.status === "in_progress";
    if (group === "completedToday") {
      return task.status === "completed" && isToday(task.completedAt, now, timeZone);
    }
    if (task.status !== "scheduled") return false;
    if (group === "today") return isToday(task.scheduledAt, now, timeZone);

    return !isToday(task.scheduledAt, now, timeZone);
  });
}

function isLate(task: DeliveryQueueTask, now: Date) {
  return task.status === "scheduled" && task.scheduledAt ? new Date(task.scheduledAt) < now : false;
}

function isDueSoon(task: DeliveryQueueTask, now: Date, timeZone: string) {
  return task.status === "scheduled" && isToday(task.scheduledAt, now, timeZone) && !isLate(task, now);
}

function TaskCard({
  locale,
  task,
  text,
  timeZone,
}: {
  locale: string;
  task: DeliveryQueueTask;
  text: DeliveryQueueText;
  timeZone: string;
}) {
  const now = new Date();
  const address = formatAddress(task);
  const late = isLate(task, now);
  const dueSoon = isDueSoon(task, now, timeZone);

  return (
    <article className="rounded-card border border-border bg-white px-4 py-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
              {task.kind === "pickup" ? text.pickup : text.delivery}
            </span>
            <span className="rounded-full bg-[#eef1ee] px-3 py-1 text-xs font-semibold text-muted">
              {text.statuses[task.status]}
            </span>
            {late ? (
              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                {text.late}
              </span>
            ) : null}
            {dueSoon ? (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                {text.dueSoon}
              </span>
            ) : null}
          </div>
          <h4 className="mt-3 text-base font-semibold text-primary">
            {formatDateTime(task.scheduledAt ?? task.completedAt, locale, timeZone)}
          </h4>
          <p className="mt-1 text-sm text-muted">
            {text.order}: {task.orderNumber}
          </p>
        </div>
        <Link
          className="inline-flex min-h-10 items-center justify-center rounded-control border border-primary px-3 text-sm font-semibold text-primary transition-standard hover:bg-primary hover:text-white"
          href={`/app/orders/${task.orderId}`}
          locale={locale}
        >
          {text.view}
        </Link>
      </div>

      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div>
          <dt className="font-semibold text-primary">{text.customer}</dt>
          <dd className="text-muted">{task.customerName || "-"}</dd>
        </div>
        <div>
          <dt className="font-semibold text-primary">{text.property}</dt>
          <dd className="text-muted">{task.propertyName || "-"}</dd>
        </div>
        <div className="md:col-span-2">
          <dt className="font-semibold text-primary">{text.address}</dt>
          <dd className="text-muted">{address || "-"}</dd>
        </div>
        <div>
          <dt className="font-semibold text-primary">{text.phone}</dt>
          <dd className="text-muted">{task.contactPhone || "-"}</dd>
        </div>
        <div>
          <dt className="font-semibold text-primary">{text.assignedTo}</dt>
          <dd className="text-muted">{task.assignedToName || text.filters.unassigned}</dd>
        </div>
      </dl>
    </article>
  );
}

function TaskSection({
  kind,
  locale,
  tasks,
  text,
  timeZone,
}: {
  kind: DeliveryTaskKind;
  locale: string;
  tasks: DeliveryQueueTask[];
  text: DeliveryQueueText;
  timeZone: string;
}) {
  const now = new Date();
  const kindTasks = tasks.filter((task) => task.kind === kind);

  return (
    <section className="space-y-4">
      <h3 className="text-xl font-semibold text-primary">
        {kind === "pickup" ? text.pickup : text.delivery}
      </h3>
      <div className="grid gap-4 xl:grid-cols-2">
        {groups.map((group) => {
          const groupItems = groupTasks(kindTasks, group, now, timeZone);

          return (
            <Card className="space-y-4" key={group}>
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-base font-semibold text-primary">{text.groups[group]}</h4>
                <span className="min-w-9 rounded-full bg-primary-soft px-3 py-1 text-center text-sm font-semibold text-primary">
                  {groupItems.length}
                </span>
              </div>
              {groupItems.length === 0 ? (
                <p className="rounded-control border border-dashed border-border px-4 py-5 text-sm text-muted">
                  {text.empty}
                </p>
              ) : (
                <div className="space-y-3">
                  {groupItems.map((task) => (
                    <TaskCard
                      key={`${task.kind}-${task.id}`}
                      locale={locale}
                      task={task}
                      text={text}
                      timeZone={timeZone}
                    />
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}

export function DeliveryQueue({
  currentProfileId,
  locale,
  tasks,
  text,
  timeZone,
}: {
  currentProfileId: string;
  locale: string;
  tasks: DeliveryQueueTask[];
  text: DeliveryQueueText;
  timeZone: string;
}) {
  const [filter, setFilter] = useState<AssignmentFilter>("all");
  const filteredTasks = useMemo(() => {
    if (filter === "mine") return tasks.filter((task) => task.assignedTo === currentProfileId);
    if (filter === "unassigned") return tasks.filter((task) => !task.assignedTo);

    return tasks;
  }, [currentProfileId, filter, tasks]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(text.filters) as AssignmentFilter[]).map((key) => (
          <button
            className={`min-h-10 rounded-control border px-3 text-sm font-semibold transition-standard ${
              filter === key ? "border-primary bg-primary text-white" : "border-border bg-white text-primary hover:bg-primary-soft"
            }`}
            key={key}
            onClick={() => setFilter(key)}
            type="button"
          >
            {text.filters[key]}
          </button>
        ))}
      </div>
      <TaskSection kind="pickup" locale={locale} tasks={filteredTasks} text={text} timeZone={timeZone} />
      <TaskSection kind="delivery" locale={locale} tasks={filteredTasks} text={text} timeZone={timeZone} />
    </div>
  );
}
