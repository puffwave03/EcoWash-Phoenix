import { getTranslations } from "next-intl/server";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { OrderItemForm } from "@/components/orders/OrderItemForm";
import { OrderItems } from "@/components/orders/OrderItems";
import { StatusTransitionForm } from "@/components/orders/StatusTransitionForm";
import { LogisticsPanel } from "@/components/logistics/LogisticsPanel";
import { OrderPhotosPanel } from "@/components/order-photos/OrderPhotosPanel";
import { PaymentsPanel } from "@/components/payments/PaymentsPanel";
import { Link } from "@/i18n/navigation";
import {
  saveDeliveryAction,
  savePickupAction,
  transitionDeliveryAction,
  transitionPickupAction,
} from "@/features/logistics/server/actions";
import {
  getOrderLogistics,
  listAssignableStaff,
} from "@/features/logistics/server/queries";
import {
  deactivateOrderPhotoAction,
  uploadOrderPhotoAction,
} from "@/features/order-photos/server/actions";
import { getOrderPhotos } from "@/features/order-photos/server/queries";
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
import {
  recordPaymentAction,
  refundPaymentAction,
  voidPaymentAction,
} from "@/features/payments/server/actions";
import {
  getOrderPaymentSummary,
  getOrderPayments,
} from "@/features/payments/server/queries";
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
  const [access, order, items, history, services, logistics, assignments, payments, paymentSummary, photos, t] = await Promise.all([
    requireMembership(locale),
    getOrderById(locale, orderId),
    listOrderItems(locale, orderId),
    getOrderHistory(locale, orderId),
    listActiveServicesForOrder(locale),
    getOrderLogistics(locale, orderId),
    listAssignableStaff(locale),
    getOrderPayments(locale, orderId),
    getOrderPaymentSummary(locale, orderId),
    getOrderPhotos(locale, orderId),
    getTranslations({ locale, namespace: "common.orders" }),
  ]);
  const statusLabels = t.raw("statuses") as Record<ProductionStatus, string>;
  const canManagePaymentCorrections = access.membership.role === "owner" || access.membership.role === "manager";

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
          cancel: t("items.cancel"),
          description: t("items.description"),
          edit: t("edit"),
          error: t("items.error"),
          lineTotal: t("items.lineTotal"),
          piece: t("unitTypes.piece"),
          quantity: t("items.quantity"),
          remove: t("items.remove"),
          removing: t("items.removing"),
          saveEdit: t("items.save"),
          saving: t("items.saving"),
          service: t("items.service"),
          subtotal: t("subtotal"),
          total: t("total"),
          unitPrice: t("items.unitPrice"),
          unitType: t("items.unitType"),
          weight: t("unitTypes.weight"),
        }}
        onSave={saveOrderItemAction.bind(null, locale, order.id)}
        services={services}
      />

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

      <LogisticsPanel
        actions={{
          saveDelivery: saveDeliveryAction.bind(null, locale, order.id),
          savePickup: savePickupAction.bind(null, locale, order.id),
          transitionDelivery: transitionDeliveryAction.bind(null, locale, order.id),
          transitionPickup: transitionPickupAction.bind(null, locale, order.id),
        }}
        assignments={assignments}
        logistics={logistics}
        text={{
          addressLine1: t("logistics.addressLine1"),
          addressLine2: t("logistics.addressLine2"),
          assignedTo: t("logistics.assignedTo"),
          cancelledReason: t("logistics.cancelledReason"),
          city: t("logistics.city"),
          contactName: t("logistics.contactName"),
          contactPhone: t("logistics.contactPhone"),
          countryCode: t("logistics.countryCode"),
          delivery: t("logistics.delivery"),
          empty: t("logistics.empty"),
          error: t("logistics.error"),
          fee: t("logistics.fee"),
          inProgress: t("logistics.title"),
          notes: t("logistics.notes"),
          pickup: t("logistics.pickup"),
          postalCode: t("logistics.postalCode"),
          save: t("logistics.save"),
          saving: t("logistics.saving"),
          scheduledAt: t("logistics.scheduledAt"),
          statuses: t.raw("logistics.statuses"),
        }}
      />

      <PaymentsPanel
        actions={{
          record: recordPaymentAction.bind(null, locale, order.id),
          refund: refundPaymentAction.bind(null, locale, order.id),
          void: voidPaymentAction.bind(null, locale, order.id),
        }}
        canManageCorrections={canManagePaymentCorrections}
        currency={order.currency}
        locale={locale}
        payments={payments}
        summary={paymentSummary}
        text={{
          actor: t("payments.actor"),
          amount: t("payments.amount"),
          balanceDue: t("payments.balanceDue"),
          date: t("payments.date"),
          empty: t("payments.empty"),
          error: t("payments.error"),
          method: t("payments.method"),
          methods: t.raw("payments.methods"),
          notes: t("payments.notes"),
          paidAt: t("payments.paidAt"),
          paymentStatus: t("payments.paymentStatus"),
          proof: t("payments.proof"),
          record: t("payments.record"),
          reference: t("payments.reference"),
          refund: t("payments.refund"),
          refundReason: t("payments.refundReason"),
          saving: t("payments.saving"),
          statuses: t.raw("payments.statuses"),
          title: t("payments.title"),
          totalDue: t("payments.totalDue"),
          totalPaid: t("payments.totalPaid"),
          void: t("payments.void"),
          voidReason: t("payments.voidReason"),
        }}
      />

      <OrderPhotosPanel
        action={uploadOrderPhotoAction.bind(null, locale, order.id)}
        deactivateAction={deactivateOrderPhotoAction.bind(null, locale, order.id)}
        photos={photos}
        text={{
          caption: t("photos.caption"),
          categories: t.raw("photos.categories"),
          category: t("photos.category"),
          deactivate: t("photos.deactivate"),
          empty: t("photos.empty"),
          error: t("photos.error"),
          file: t("photos.file"),
          fileHelp: t("photos.fileHelp"),
          inactive: t("photos.inactive"),
          title: t("photos.title"),
          upload: t("photos.upload"),
          uploading: t("photos.uploading"),
        }}
      />

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
