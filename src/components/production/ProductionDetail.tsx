import { Link } from "@/i18n/navigation";
import { ProductionTransitionForm } from "@/components/production/ProductionTransitionForm";
import type {
  OrderPriority,
  ProductionStatus,
} from "@/features/orders/types";
import type {
  ProductionTask,
  ProductionUrgency,
} from "@/features/production/types";
import type { ServiceUnitType } from "@/features/services/types";
import { formatQuantity } from "@/lib/number-format";

export type ProductionDetailText = {
  action: string;
  assignedTo: string;
  back: string;
  blocked: string;
  currentPhase: string;
  customer: string;
  due: string;
  items: string;
  nextPhase: string;
  noActions: string;
  noDeadline: string;
  noItems: string;
  noNotes: string;
  notes: string;
  openOrder: string;
  order: string;
  priorities: Record<OrderPriority, string>;
  priority: string;
  property: string;
  reason: string;
  selectPhase: string;
  services: string;
  statuses: Record<ProductionStatus, string>;
  title: string;
  urgencies: Record<ProductionUrgency, string>;
  units: Record<ServiceUnitType, string>;
  workflow: string;
};

type ProductionDetailProps = {
  action: (formData: FormData) => Promise<void>;
  allowedTransitions: ProductionStatus[];
  backHref?: string;
  isSupervision: boolean;
  locale: string;
  task: ProductionTask;
  text: ProductionDetailText;
  timeZone: string;
  workflowPhases?: ProductionStatus[];
};

const defaultWorkflowPhases: ProductionStatus[] = [
  "draft",
  "received",
  "washing",
  "drying",
  "ironing",
  "quality_check",
  "packing",
  "ready",
];

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

function DetailRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;

  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-semibold leading-5 text-primary">{value}</dd>
    </div>
  );
}

export function ProductionDetail({
  action,
  allowedTransitions,
  backHref = "/app/work/production",
  isSupervision,
  locale,
  task,
  text,
  timeZone,
  workflowPhases = defaultWorkflowPhases,
}: ProductionDetailProps) {
  const workflowCurrentStatus = task.productionStatus === "on_hold"
    ? task.previousStatus
    : task.productionStatus;

  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-5">
      <Link
        className="inline-flex min-h-11 items-center gap-2 rounded-control px-1 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        href={backHref}
        locale={locale}
      >
        <span aria-hidden="true">←</span> {text.back}
      </Link>

      <section className="overflow-hidden rounded-card border border-primary/20 bg-white shadow-card">
        <div className="border-b border-primary/10 bg-primary-soft/70 px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
                {text.order} {task.orderNumber}
              </p>
              <h2 className="mt-2 text-2xl font-semibold leading-tight text-primary">
                {task.propertyName || task.customerName || task.orderNumber}
              </h2>
              {task.propertyName && task.customerName ? (
                <p className="mt-1 text-sm text-muted">{task.customerName}</p>
              ) : null}
            </div>
            <span className="rounded-full border border-primary/20 bg-white px-3 py-1.5 text-xs font-semibold text-primary">
              {text.urgencies[task.urgency]}
            </span>
          </div>

          <div className="mt-5 rounded-card bg-primary px-4 py-4 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">{text.currentPhase}</p>
            <p className="mt-1 text-2xl font-semibold leading-tight text-white">
              {text.statuses[task.productionStatus]}
            </p>
          </div>
        </div>

        <div className="space-y-5 p-4 sm:p-6">
          {task.onHoldReason ? (
            <section className="rounded-card border border-amber-200 bg-amber-50 p-4">
              <h3 className="text-sm font-semibold text-amber-900">{text.blocked}</h3>
              <p className="mt-2 text-sm leading-6 text-amber-900">{task.onHoldReason}</p>
            </section>
          ) : null}

          <section aria-labelledby="production-context" className="space-y-4">
            <h3 className="text-lg font-semibold text-primary" id="production-context">{text.title}</h3>
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailRow label={text.customer} value={task.customerName} />
              <DetailRow label={text.property} value={task.propertyName} />
              <DetailRow label={text.due} value={formatDateTime(task.dueAt, locale, timeZone, text.noDeadline)} />
              <DetailRow label={text.priority} value={text.priorities[task.priority]} />
              <DetailRow label={text.assignedTo} value={task.assignedToName} />
              <DetailRow label={text.services} value={task.serviceNames.join(", ")} />
            </dl>
          </section>

          <section aria-labelledby="production-items" className="space-y-3">
            <h3 className="text-lg font-semibold text-primary" id="production-items">{text.items}</h3>
            {task.items.length === 0 ? (
              <p className="rounded-card border border-dashed border-border p-4 text-sm text-muted">{text.noItems}</p>
            ) : (
              <div className="space-y-2">
                {task.items.map((item, index) => (
                  <article className="rounded-card border border-border bg-[#f8faf8] p-4" key={`${item.description}-${index}`}>
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="text-sm font-semibold text-primary">{item.description}</h4>
                      <span className="shrink-0 text-sm font-semibold text-foreground">
                        {formatQuantity(item.quantity, locale)} {text.units[item.unitType]}
                      </span>
                    </div>
                    {item.notes ? <p className="mt-2 text-sm leading-5 text-muted">{item.notes}</p> : null}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-card border border-border p-4">
            <h3 className="text-sm font-semibold text-primary">{text.notes}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
              {task.note || text.noNotes}
            </p>
          </section>

          <section aria-labelledby="production-workflow" className="space-y-3">
            <div>
              <h3 className="text-lg font-semibold text-primary" id="production-workflow">{text.workflow}</h3>
              <p className="mt-1 text-sm text-muted">
                {text.nextPhase}: {allowedTransitions.length > 0
                  ? allowedTransitions.map((status) => text.statuses[status]).join(" · ")
                  : text.noActions}
              </p>
            </div>
            <ol className="space-y-2">
              {workflowPhases.map((status, index) => {
                const isCurrent = status === workflowCurrentStatus;

                return (
                  <li className={`flex items-center gap-3 rounded-control border px-3 py-2.5 ${isCurrent ? "border-primary bg-primary-soft" : "border-border bg-white"}`} key={status}>
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${isCurrent ? "bg-primary text-white" : "bg-[#eef1ee] text-muted"}`}>
                      {index + 1}
                    </span>
                    <span className={`text-sm font-semibold ${isCurrent ? "text-primary" : "text-muted"}`}>
                      {text.statuses[status]}
                    </span>
                    {isCurrent ? (
                      <span className="ml-auto text-xs font-semibold uppercase tracking-wide text-primary">{text.currentPhase}</span>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="space-y-3 border-t border-border pt-5">
            <h3 className="text-lg font-semibold text-primary">{text.nextPhase}</h3>
            <ProductionTransitionForm
              action={action}
              allowedTransitions={allowedTransitions}
              text={{
                action: text.action,
                noActions: text.noActions,
                reason: text.reason,
                selectPhase: text.selectPhase,
                statuses: text.statuses,
              }}
            />
            {isSupervision ? (
              <Link
                className="inline-flex min-h-11 w-full items-center justify-center rounded-control border border-border bg-white px-4 text-sm font-semibold text-primary transition-standard hover:border-primary/30 hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                href={`/app/orders/${task.id}#production`}
                locale={locale}
              >
                {text.openOrder}
              </Link>
            ) : null}
          </section>
        </div>
      </section>
    </div>
  );
}
