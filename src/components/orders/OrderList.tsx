import { Card } from "@/components/Card";
import { StatusBadge, type Tone } from "@/components/operational/OperationalUi";
import { Link } from "@/i18n/navigation";
import type { OrderPriority } from "@/features/orders/types";
import type { OrderDisplayStatus, OrderListEntry } from "@/features/orders/display-status";
import { formatCurrency } from "@/lib/number-format";
import { formatOrganizationDateTime } from "@/lib/organization-timezone";

type OrderListText = {
  created: string;
  customer: string;
  due: string;
  empty: string;
  order: string;
  priority: string;
  property: string;
  status: string;
  statuses: Record<OrderDisplayStatus, string>;
  total: string;
  view: string;
};

function formatDate(value: string | null, locale: string, timeZone: string) {
  return value ? formatOrganizationDateTime(value, locale, timeZone, { dateStyle: "medium" }) : "-";
}

function readableToken(value: string) {
  return value.replaceAll("_", " ");
}

function statusTone(status: OrderDisplayStatus): Tone {
  if (status === "completed") return "success";
  if (["ready", "ready_for_pickup", "delivery_scheduled"].includes(status)) return "warning";
  if (status === "delivery_in_progress") return "info";
  if (status === "on_hold") return "warning";
  if (status === "cancelled") return "neutral";

  return "info";
}

function priorityTone(priority: OrderPriority): Tone {
  return priority === "express" ? "warning" : "neutral";
}

export function OrderList({
  locale,
  orders,
  text,
  timeZone,
}: {
  locale: string;
  orders: OrderListEntry[];
  text: OrderListText;
  timeZone: string;
}) {
  if (orders.length === 0) {
    return <Card><p className="text-sm text-muted">{text.empty}</p></Card>;
  }

  return (
    <div className="overflow-hidden rounded-card border border-border bg-white shadow-card">
      <div className="hidden border-b border-border bg-[#fbfbf8] px-5 py-3 text-sm font-semibold text-primary xl:grid xl:grid-cols-[1.05fr_1.25fr_1fr_0.95fr_0.85fr_0.95fr_0.95fr_auto] xl:gap-4">
        <span>{text.order}</span>
        <span>{text.customer}</span>
        <span>{text.property}</span>
        <span>{text.status}</span>
        <span>{text.priority}</span>
        <span>{text.total}</span>
        <span>{text.due}</span>
        <span />
      </div>
      <div className="divide-y divide-border/80">
        {orders.map((order) => (
          <article
            className="grid gap-4 px-4 py-4 transition-standard hover:bg-primary-soft/35 sm:px-5 xl:grid-cols-[1.05fr_1.25fr_1fr_0.95fr_0.85fr_0.95fr_0.95fr_auto] xl:items-center xl:gap-4"
            key={order.id}
          >
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-primary">{order.orderNumber}</p>
              <p className="mt-1 text-xs text-muted">{text.created}: {formatDate(order.createdAt, locale, timeZone)}</p>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-primary">{order.customerName}</p>
              <p className="mt-1 text-xs text-muted xl:hidden">{order.propertyName || "-"}</p>
            </div>
            <p className="hidden truncate text-sm text-muted xl:block">{order.propertyName || "-"}</p>
            <div>
              <StatusBadge tone={statusTone(order.displayStatus)}>
                {text.statuses[order.displayStatus] ?? readableToken(order.displayStatus)}
              </StatusBadge>
            </div>
            <div>
              <StatusBadge tone={priorityTone(order.priority)}>
                {readableToken(order.priority)}
              </StatusBadge>
            </div>
            <p className="text-sm font-semibold text-primary">{formatCurrency(order.total, order.currency, locale)}</p>
            <p className="text-sm text-muted">{formatDate(order.dueAt, locale, timeZone)}</p>
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-control border border-primary px-3 text-sm font-semibold text-primary transition-standard hover:bg-primary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              href={`/app/orders/${order.id}`}
              locale={locale}
            >
              {text.view}
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
