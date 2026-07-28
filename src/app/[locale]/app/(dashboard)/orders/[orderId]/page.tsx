import { getTranslations } from "next-intl/server";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { OrderItemForm } from "@/components/orders/OrderItemForm";
import { OrderItems } from "@/components/orders/OrderItems";
import { StatusTransitionForm } from "@/components/orders/StatusTransitionForm";
import { Link } from "@/i18n/navigation";
import {
  removeOrderItemAction,
  saveOrderItemAction,
  transitionOrderStatusAction,
  updateOrderDiscountAction,
} from "@/features/orders/server/actions";
import {
  getOrderById,
  getOrderHistory,
  listOrderItems,
} from "@/features/orders/server/queries";
import { listActiveServicesForOrder } from "@/features/services/server/queries";
import type { ProductionStatus } from "@/features/orders/types";
import { canEditCatalog } from "@/features/orders/workflow";
import { requireMembership } from "@/lib/auth/require-membership";

type OrderDetailPageProps = {
  params: Promise<{ locale: string; orderId: string }>;
};

function formatMoney(amount: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, { currency, style: "currency" }).format(amount);
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { locale, orderId } = await params;
  const [access, order, items, history, services, t] = await Promise.all([
    requireMembership(locale),
    getOrderById(locale, orderId),
    listOrderItems(locale, orderId),
    getOrderHistory(locale, orderId),
    listActiveServicesForOrder(locale),
    getTranslations({ locale, namespace: "common.orders" }),
  ]);
  const statusLabels = t.raw("statuses") as Record<ProductionStatus, string>;

  return (
    <div className="space-y-6">
      <Card className="space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">{order.orderNumber}</p>
            <h2 className="mt-2 text-2xl font-semibold text-primary">{order.customerName}</h2>
            <p className="mt-1 text-sm text-muted">{statusLabels[order.productionStatus]} · {t(`priorities.${order.priority}`)}</p>
          </div>
          <Link href={`/app/orders/${order.id}/edit`} locale={locale}>
            <Button variant="secondary">{t("edit")}</Button>
          </Link>
        </div>
        <dl className="grid gap-4 md:grid-cols-4">
          <div><dt className="text-sm text-muted">{t("property")}</dt><dd className="font-semibold text-primary">{order.propertyName || "-"}</dd></div>
          <div><dt className="text-sm text-muted">{t("due")}</dt><dd className="font-semibold text-primary">{order.dueAt ? new Date(order.dueAt).toLocaleString(locale) : "-"}</dd></div>
          <div><dt className="text-sm text-muted">{t("assigned")}</dt><dd className="font-semibold text-primary">{order.assignedToName || "-"}</dd></div>
          <div><dt className="text-sm text-muted">{t("total")}</dt><dd className="font-semibold text-primary">{formatMoney(order.total, order.currency, locale)}</dd></div>
        </dl>
      </Card>

      <Card className="space-y-4">
        <h3 className="text-xl font-semibold text-primary">{t("items.title")}</h3>
        <OrderItemForm
          action={saveOrderItemAction.bind(null, locale, order.id)}
          services={services}
          text={{
            addItem: t("items.add"),
            description: t("items.description"),
            error: t("items.error"),
            notes: t("items.notes"),
            piece: t("unitTypes.piece"),
            quantity: t("items.quantity"),
            saving: t("items.saving"),
            service: t("items.service"),
            unitPrice: t("items.unitPrice"),
            unitType: t("items.unitType"),
            weight: t("unitTypes.weight"),
          }}
        />
      </Card>

      <OrderItems
        items={items}
        locale={locale}
        onRemove={removeOrderItemAction.bind(null, locale, order.id)}
        order={order}
        text={{
          description: t("items.description"),
          lineTotal: t("items.lineTotal"),
          quantity: t("items.quantity"),
          remove: t("items.remove"),
          removing: t("items.removing"),
          subtotal: t("subtotal"),
          total: t("total"),
          unitPrice: t("items.unitPrice"),
        }}
      />

      {items.length > 0 ? (
        <Card className="space-y-4">
          <h3 className="text-xl font-semibold text-primary">{t("items.edit")}</h3>
          <div className="space-y-4">
            {items.map((item) => (
              <OrderItemForm
                action={saveOrderItemAction.bind(null, locale, order.id)}
                item={item}
                key={item.id}
                services={services}
                text={{
                  addItem: t("items.save"),
                  description: t("items.description"),
                  error: t("items.error"),
                  notes: t("items.notes"),
                  piece: t("unitTypes.piece"),
                  quantity: t("items.quantity"),
                  saving: t("items.saving"),
                  service: t("items.service"),
                  unitPrice: t("items.unitPrice"),
                  unitType: t("items.unitType"),
                  weight: t("unitTypes.weight"),
                }}
              />
            ))}
          </div>
        </Card>
      ) : null}

      {canEditCatalog(access.membership.role) ? (
        <Card>
          <form action={updateOrderDiscountAction.bind(null, locale, order.id)} className="flex flex-col gap-3 md:max-w-sm">
            <label className="space-y-2 text-sm font-semibold text-primary">
              <span>{t("discount")}</span>
              <input className="min-h-11 rounded-control border border-border px-3 text-sm" defaultValue={order.discountAmount} min="0" name="discountAmount" step="0.01" type="number" />
            </label>
            <Button type="submit">{t("updateDiscount")}</Button>
          </form>
        </Card>
      ) : null}

      <Card>
        <StatusTransitionForm
          action={transitionOrderStatusAction.bind(null, locale, order.id)}
          currentStatus={order.productionStatus}
          history={history}
          text={{
            change: t("workflow.change"),
            history: t("workflow.history"),
            reason: t("workflow.reason"),
            statusLabels,
          }}
        />
      </Card>
    </div>
  );
}
