import { Card } from "@/components/Card";
import { Link } from "@/i18n/navigation";
import type { ProductionQueueOrder } from "@/features/orders/server/queries";
import type { OrderPriority, ProductionStatus } from "@/features/orders/types";

type ProductionGroupKey = "todo" | "inProgress" | "onHold" | "ready";

type ProductionQueueText = {
  assignedTo: string;
  due: string;
  empty: string;
  groups: Record<ProductionGroupKey, string>;
  order: string;
  priority: string;
  property: string;
  statuses: Record<ProductionStatus, string>;
  priorities: Record<OrderPriority, string>;
  view: string;
};

const productionGroups: Array<{
  key: ProductionGroupKey;
  statuses: ProductionStatus[];
}> = [
  { key: "todo", statuses: ["draft", "received"] },
  { key: "inProgress", statuses: ["washing", "drying", "ironing", "quality_check", "packing"] },
  { key: "onHold", statuses: ["on_hold"] },
  { key: "ready", statuses: ["ready"] },
];

function formatDate(value: string | null, locale: string) {
  return value
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value))
    : "-";
}

function ordersForGroup(orders: ProductionQueueOrder[], statuses: ProductionStatus[]) {
  return orders.filter((order) => statuses.includes(order.productionStatus));
}

export function ProductionQueue({
  locale,
  orders,
  text,
}: {
  locale: string;
  orders: ProductionQueueOrder[];
  text: ProductionQueueText;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {productionGroups.map((group) => {
        const groupOrders = ordersForGroup(orders, group.statuses);

        return (
          <section
            aria-labelledby={`production-${group.key}`}
            className="min-w-0"
            key={group.key}
          >
            <Card className="h-full space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-primary" id={`production-${group.key}`}>
                  {text.groups[group.key]}
                </h3>
                <span className="min-w-9 rounded-full bg-primary-soft px-3 py-1 text-center text-sm font-semibold text-primary">
                  {groupOrders.length}
                </span>
              </div>

              {groupOrders.length === 0 ? (
                <p className="rounded-control border border-dashed border-border px-4 py-5 text-sm text-muted">
                  {text.empty}
                </p>
              ) : (
                <div className="space-y-3">
                  {groupOrders.map((order) => (
                    <article
                      className="rounded-card border border-border bg-white px-4 py-4 shadow-sm"
                      key={order.id}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase text-muted">
                            {text.order}
                          </p>
                          <h4 className="mt-1 truncate text-base font-semibold text-primary">
                            {order.orderNumber}
                          </h4>
                          <p className="mt-1 truncate text-sm text-muted">
                            {order.customerName}
                          </p>
                        </div>
                        <Link
                          className="inline-flex min-h-10 items-center justify-center rounded-control border border-primary px-3 text-sm font-semibold text-primary transition-standard hover:bg-primary hover:text-white"
                          href={`/app/orders/${order.id}`}
                          locale={locale}
                        >
                          {text.view}
                        </Link>
                      </div>

                      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="font-semibold text-primary">{text.statuses[order.productionStatus]}</dt>
                          <dd className="text-muted">{text.priority}: {text.priorities[order.priority]}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-primary">{text.due}</dt>
                          <dd className="text-muted">{formatDate(order.dueAt, locale)}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-primary">{text.property}</dt>
                          <dd className="text-muted">{order.propertyName || "-"}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold text-primary">{text.assignedTo}</dt>
                          <dd className="text-muted">{order.assignedToName || "-"}</dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
              )}
            </Card>
          </section>
        );
      })}
    </div>
  );
}
