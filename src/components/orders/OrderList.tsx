import { Card } from "@/components/Card";
import { Link } from "@/i18n/navigation";
import type { Order } from "@/features/orders/types";

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
      <div className="hidden lg:grid lg:grid-cols-[1fr_1.2fr_1fr_1fr_1fr_1fr_1fr_auto] lg:gap-4 lg:border-b lg:border-border lg:px-5 lg:py-3 lg:text-sm lg:font-semibold lg:text-primary">
        <span>{text.order}</span><span>{text.customer}</span><span>{text.property}</span><span>{text.status}</span><span>{text.priority}</span><span>{text.total}</span><span>{text.due}</span><span />
      </div>
      <div className="divide-y divide-border">
        {orders.map((order) => (
          <div className="grid gap-3 px-5 py-4 lg:grid-cols-[1fr_1.2fr_1fr_1fr_1fr_1fr_1fr_auto] lg:items-center lg:gap-4" key={order.id}>
            <div>
              <p className="font-semibold text-primary">{order.orderNumber}</p>
              <p className="text-sm text-muted">{text.created}: {formatDate(order.createdAt, locale)}</p>
            </div>
            <p className="text-sm text-muted">{order.customerName}</p>
            <p className="text-sm text-muted">{order.propertyName || "-"}</p>
            <p className="text-sm text-muted">{order.productionStatus}</p>
            <p className="text-sm text-muted">{order.priority}</p>
            <p className="text-sm text-muted">{formatMoney(order.total, order.currency, locale)}</p>
            <p className="text-sm text-muted">{formatDate(order.dueAt, locale)}</p>
            <Link className="text-sm font-semibold text-primary underline-offset-4 hover:underline" href={`/app/orders/${order.id}`} locale={locale}>
              {text.view}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
