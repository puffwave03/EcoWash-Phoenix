import { Link } from "@/i18n/navigation";
import type { PickupTask } from "@/features/pickups/types";

export type PickupDetailText = {
  address: string;
  assignedTo: string;
  back: string;
  complete: string;
  contact: string;
  customer: string;
  details: string;
  noNotes: string;
  noTime: string;
  notes: string;
  openOrder: string;
  order: string;
  phone: string;
  property: string;
  scheduledAt: string;
  start: string;
  statuses: Record<string, string>;
  title: string;
};

type PickupDetailProps = {
  action: (formData: FormData) => Promise<void>;
  isSupervision: boolean;
  locale: string;
  task: PickupTask;
  text: PickupDetailText;
  timeZone: string;
};

function formatDateTime(value: string | null, locale: string, timeZone: string, fallback: string) {
  return value
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "full",
        timeStyle: "short",
        timeZone,
      }).format(new Date(value))
    : fallback;
}

function fullAddress(task: PickupTask) {
  return [
    task.addressLine1,
    task.addressLine2,
    task.postalCode,
    task.city,
    task.countryCode,
  ].filter(Boolean).join(", ");
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

export function PickupDetail({
  action,
  isSupervision,
  locale,
  task,
  text,
  timeZone,
}: PickupDetailProps) {
  const address = fullAddress(task);
  const targetStatus = task.status === "scheduled"
    ? "in_progress"
    : task.status === "in_progress"
      ? "completed"
      : null;
  const actionLabel = targetStatus === "in_progress" ? text.start : text.complete;

  return (
    <div className="mx-auto max-w-3xl space-y-4 sm:space-y-5">
      <Link
        className="inline-flex min-h-11 items-center gap-2 rounded-control px-1 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        href="/app/work/pickups"
        locale={locale}
      >
        <span aria-hidden="true">←</span> {text.back}
      </Link>

      <section className="overflow-hidden rounded-card border border-primary/20 bg-white shadow-card">
        <div className="border-b border-primary/10 bg-primary-soft/70 px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">{text.title}</p>
              <h2 className="mt-2 text-2xl font-semibold leading-tight text-primary">
                {task.propertyName || task.customerName || task.orderNumber}
              </h2>
              {task.propertyName && task.customerName ? (
                <p className="mt-1 text-sm text-muted">{task.customerName}</p>
              ) : null}
            </div>
            <span className="rounded-full border border-primary/20 bg-white px-3 py-1.5 text-xs font-semibold text-primary">
              {text.statuses[task.status]}
            </span>
          </div>
          <p className="mt-5 text-2xl font-semibold tracking-tight text-primary">
            {formatDateTime(task.scheduledAt, locale, timeZone, text.noTime)}
          </p>
        </div>

        <div className="space-y-5 p-4 sm:p-6">
          <section aria-labelledby="pickup-detail-context" className="space-y-4">
            <h3 className="text-lg font-semibold text-primary" id="pickup-detail-context">{text.details}</h3>
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailRow label={text.order} value={task.orderNumber} />
              <DetailRow label={text.customer} value={task.customerName} />
              <DetailRow label={text.property} value={task.propertyName} />
              <DetailRow label={text.scheduledAt} value={formatDateTime(task.scheduledAt, locale, timeZone, text.noTime)} />
              <DetailRow label={text.assignedTo} value={task.assignedToName} />
              <DetailRow label={text.address} value={address} />
            </dl>
          </section>

          {(task.contactName || task.contactPhone) ? (
            <section className="rounded-card border border-border bg-[#f8faf8] p-4">
              <h3 className="text-sm font-semibold text-primary">{text.contact}</h3>
              {task.contactName ? <p className="mt-2 text-sm text-foreground">{task.contactName}</p> : null}
              {task.contactPhone ? (
                <a className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline decoration-primary/30 underline-offset-4" href={`tel:${task.contactPhone}`}>
                  {text.phone}: {task.contactPhone}
                </a>
              ) : null}
            </section>
          ) : null}

          <section className="rounded-card border border-border p-4">
            <h3 className="text-sm font-semibold text-primary">{text.notes}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
              {task.notes || text.noNotes}
            </p>
          </section>

          <div className="space-y-2.5 border-t border-border pt-5">
            {targetStatus ? (
              <form action={action}>
                <input name="recordId" type="hidden" value={task.id} />
                <input name="targetStatus" type="hidden" value={targetStatus} />
                <button className="inline-flex min-h-12 w-full items-center justify-center rounded-control bg-primary px-5 text-sm font-semibold text-white shadow-sm transition-standard hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" type="submit">
                  {actionLabel}
                </button>
              </form>
            ) : null}
            {isSupervision ? (
              <Link
                className="inline-flex min-h-11 w-full items-center justify-center rounded-control border border-border bg-white px-4 text-sm font-semibold text-primary transition-standard hover:border-primary/30 hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                href={`/app/orders/${task.orderId}#logistics`}
                locale={locale}
              >
                {text.openOrder}
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
