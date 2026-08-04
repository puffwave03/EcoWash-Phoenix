import { Card } from "@/components/Card";
import { StatusBadge, type Tone } from "@/components/operational/OperationalUi";
import { Link } from "@/i18n/navigation";
import type { Order, OrderPriority, ProductionStatus } from "@/features/orders/types";

type OrderListText = {
  created: string;
  customer: string;
  due: string;
  empty: string;
  order: string;
  priority: string;
  property: string;
  status: string;
  total: string;
  view: string;
};

function formatMoney(amount: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, { currency, style: "currency" }).format(amount);
}

function formatDate(value: string | null, locale: string) {
  return value ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value)) : "-";
}

function readableToken(value: string) {
  return value.replaceAll("_", " ");
}

function statusTone(status: ProductionStatus): Tone {
  if (status === "completed" || status === "ready") return "success";
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
}: {
  locale: string;
  orders: Order[];
  text: OrderListText;
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
              <p className="mt-1 text-xs text-muted">{text.created}: {formatDate(order.createdAt, locale)}</p>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-primary">{order.customerName}</p>
              <p className="mt-1 text-xs text-muted xl:hidden">{order.propertyName || "-"}</p>
            </div>
            <p className="hidden truncate text-sm text-muted xl:block">{order.propertyName || "-"}</p>
            <div>
              <StatusBadge tone={statusTone(order.productionStatus)}>
                {readableToken(order.productionStatus)}
              </StatusBadge>
            </div>
            <div>
              <StatusBadge tone={priorityTone(order.priority)}>
                {readableToken(order.priority)}
              </StatusBadge>
            </div>
            <p className="text-sm font-semibold text-primary">{formatMoney(order.total, order.currency, locale)}</p>
            <p className="text-sm text-muted">{formatDate(order.dueAt, locale)}</p>
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
