import { getTranslations } from "next-intl/server";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { OrderItemForm } from "@/components/orders/OrderItemForm";
import { OrderItems } from "@/components/orders/OrderItems";
import { OrderAssignmentForm } from "@/components/orders/OrderAssignmentForm";
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
import { setOrderPhotoCustomerVisibilityAction } from "@/features/portal/server/actions";
import { getOrderPhotos } from "@/features/order-photos/server/queries";
import {
  removeOrderItemAction,
  saveOrderItemAction,
  transitionOrderStatusAction,
  updateOrderAssignmentAction,
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
import { formatCurrency, formatNumberInput } from "@/lib/number-format";

type OrderDetailPageProps = {
  params: Promise<{ locale: string; orderId: string }>;
};

function SectionShell({
  children,
  id,
  title,
}: {
  children: React.ReactNode;
  id: string;
  title: string;
}) {
  return (
    <section className="scroll-mt-24 space-y-4" id={id}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xl font-semibold text-primary">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { locale, orderId } = await params;
  const [access, order, items, history, services, logistics, assignments, payments, paymentSummary, photos, t, catalogT] = await Promise.all([
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
    getTranslations({ locale, namespace: "common.catalog" }),
  ]);
  const statusLabels = t.raw("statuses") as Record<ProductionStatus, string>;
  const logisticsStatusLabels = t.raw("logistics.statuses") as Record<string, string>;
  const paymentStatusLabels = t.raw("payments.statuses") as Record<string, string>;
  const canManageAssignments = access.membership.role === "owner" || access.membership.role === "manager";
  const canManagePaymentCorrections = access.membership.role === "owner" || access.membership.role === "manager";
  const sectionLinks = [
    { href: "#items", label: t("items.title") },
    { href: "#production", label: t("workflow.change") },
    { href: "#logistics", label: t("logistics.title") },
    { href: "#payments", label: t("payments.title") },
    { href: "#photos", label: t("photos.title") },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-card bg-[#09291f] p-5 text-white shadow-card lg:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">
              {order.orderNumber}
            </p>
            <h2 className="mt-2 break-words text-2xl font-semibold text-white lg:truncate lg:text-3xl">
              {order.customerName}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-control bg-white px-3 py-1 text-xs font-semibold text-primary">
                {statusLabels[order.productionStatus]}
              </span>
              <span className="rounded-control bg-white/12 px-3 py-1 text-xs font-semibold text-white">
                {t(`priorities.${order.priority}`)}
              </span>
              <span className="rounded-control bg-white/12 px-3 py-1 text-xs font-semibold text-white">
                {paymentStatusLabels[paymentSummary.paymentStatus]}
              </span>
            </div>
          </div>
          <Link className="w-full lg:w-auto" href={`/app/orders/${order.id}/edit`} locale={locale}>
            <Button className="w-full lg:w-auto" variant="secondary">{t("edit")}</Button>
          </Link>
        </div>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-card border border-white/16 bg-white/10 p-4">
            <dt className="text-xs font-semibold uppercase text-white/68">{t("property")}</dt>
            <dd className="mt-2 font-semibold text-white">{order.propertyName || "-"}</dd>
          </div>
          <div className="rounded-card border border-white/16 bg-white/10 p-4">
            <dt className="text-xs font-semibold uppercase text-white/68">{t("due")}</dt>
            <dd className="mt-2 font-semibold text-white">{order.dueAt ? new Date(order.dueAt).toLocaleString(locale) : "-"}</dd>
          </div>
          <div className="rounded-card border border-white/16 bg-white/10 p-4">
            <dt className="text-xs font-semibold uppercase text-white/68">{t("assignment.assignedTo")}</dt>
            <dd className="mt-2 font-semibold text-white">{order.assignedToName || "-"}</dd>
          </div>
          <div className="rounded-card border border-white/16 bg-white/10 p-4">
            <dt className="text-xs font-semibold uppercase text-white/68">{t("total")}</dt>
            <dd className="mt-2 text-xl font-semibold text-white">{formatCurrency(order.total, order.currency, locale)}</dd>
          </div>
        </dl>
      </section>

      <nav className="sticky top-16 z-20 -mx-4 border-y border-border bg-[#eef1ee]/95 px-4 py-2 backdrop-blur lg:top-[4.5rem] lg:mx-0 lg:rounded-card lg:border lg:bg-white lg:shadow-card" aria-label={t("title")}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap">
          {sectionLinks.map((link) => (
            <a
              className="inline-flex min-h-11 min-w-0 items-center justify-center rounded-control border border-border bg-white px-2 text-center text-sm font-semibold leading-tight text-primary transition-standard hover:border-primary hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-3 lg:w-auto"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </a>
          ))}
        </div>
      </nav>

      <dl className="grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-2">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted">{t("logistics.pickup")}</dt>
              <dd className="font-semibold text-primary">
                {logistics.pickup ? logisticsStatusLabels[logistics.pickup.status] : t("logistics.empty")}
              </dd>
              {logistics.pickup ? (
                <dd className="mt-1 text-sm text-muted">
                  {t("logistics.assignedTo")}: {logistics.pickup.assignedToName || t("assignment.none")}
                </dd>
              ) : null}
            </div>
            <div>
              <dt className="text-sm text-muted">{t("logistics.delivery")}</dt>
              <dd className="font-semibold text-primary">
                {logistics.delivery ? logisticsStatusLabels[logistics.delivery.status] : t("logistics.empty")}
              </dd>
              {logistics.delivery ? (
                <dd className="mt-1 text-sm text-muted">
                  {t("logistics.assignedTo")}: {logistics.delivery.assignedToName || t("assignment.none")}
                </dd>
              ) : null}
            </div>
          </dl>
        </Card>
        <Card>
          <dt className="text-sm text-muted">{t("payments.balanceDue")}</dt>
          <dd className="mt-1 text-xl font-semibold text-primary">{formatCurrency(paymentSummary.balanceDue, order.currency, locale)}</dd>
        </Card>
        <Card>
          <dt className="text-sm text-muted">{t("photos.title")}</dt>
          <dd className="mt-1 text-xl font-semibold text-primary">{photos.filter((photo) => photo.isActive).length}</dd>
        </Card>
      </dl>

      <SectionShell id="items" title={t("items.title")}>
        <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
          <div className="space-y-4">
            <Card className="space-y-4">
              <OrderItemForm
                action={saveOrderItemAction.bind(null, locale, order.id)}
                locale={locale}
                services={services}
                text={{
                  addItem: t("items.add"),
                  description: t("items.description"),
                  error: t("items.error"),
                  notes: t("items.notes"),
                  categoryLabels: catalogT.raw("categories") as Record<string, string>,
                  quantity: t("items.quantity"),
                  saving: t("items.saving"),
                  search: catalogT("search"),
                  searchPlaceholder: catalogT("searchPlaceholder"),
                  service: t("items.service"),
                  unitPrice: t("items.unitPrice"),
                  unitType: t("items.unitType"),
                  unitTypes: catalogT.raw("unitTypes") as Record<import("@/features/services/types").ServiceUnitType, string>,
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
                categoryLabels: catalogT.raw("categories") as Record<string, string>,
                quantity: t("items.quantity"),
                remove: t("items.remove"),
                removing: t("items.removing"),
                saveEdit: t("items.save"),
                saving: t("items.saving"),
                search: catalogT("search"),
                searchPlaceholder: catalogT("searchPlaceholder"),
                service: t("items.service"),
                subtotal: t("subtotal"),
                total: t("total"),
                unitPrice: t("items.unitPrice"),
                unitType: t("items.unitType"),
                unitTypes: catalogT.raw("unitTypes") as Record<import("@/features/services/types").ServiceUnitType, string>,
              }}
              onSave={saveOrderItemAction.bind(null, locale, order.id)}
              services={services}
            />
          </div>

          {canEditCatalog(access.membership.role) ? (
            <Card className="h-fit">
              <form action={updateOrderDiscountAction.bind(null, locale, order.id)} className="flex flex-col gap-3">
                <label className="space-y-2 text-sm font-semibold text-primary">
                  <span>{t("discount")}</span>
                  <input className="min-h-11 rounded-control border border-border px-3 text-sm" defaultValue={formatNumberInput(order.discountAmount, 2)} min="0" name="discountAmount" step="0.01" type="number" />
                </label>
                <Button type="submit">{t("updateDiscount")}</Button>
              </form>
            </Card>
          ) : null}
        </div>
      </SectionShell>

      <SectionShell id="production" title={t("workflow.change")}>
        <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
          <Card>
            <StatusTransitionForm
              action={transitionOrderStatusAction.bind(null, locale, order.id, "order")}
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
          <Card className="h-fit">
            <OrderAssignmentForm
              action={updateOrderAssignmentAction.bind(null, locale, order.id)}
              assignedTo={order.assignedTo}
              assignedToName={order.assignedToName}
              assignments={assignments.all}
              canAssign={canManageAssignments}
              text={{
                assignedTo: t("assignment.assignedTo"),
                error: t("assignment.error"),
                none: t("assignment.none"),
                save: t("assignment.save"),
                saving: t("assignment.saving"),
                staffReadonly: t("assignment.staffReadonly"),
                success: t("assignment.success"),
              }}
            />
          </Card>
        </div>
      </SectionShell>

      <SectionShell id="logistics" title={t("logistics.title")}>
        <LogisticsPanel
          actions={{
            saveDelivery: saveDeliveryAction.bind(null, locale, order.id),
            savePickup: savePickupAction.bind(null, locale, order.id),
            transitionDelivery: transitionDeliveryAction.bind(null, locale, order.id, "order"),
            transitionPickup: transitionPickupAction.bind(null, locale, order.id, "order"),
          }}
          assignments={{
            delivery: assignments.delivery,
            pickup: assignments.pickup,
          }}
          canAssign={canManageAssignments}
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
            unassigned: t("assignment.none"),
            success: t("logistics.success"),
            statuses: t.raw("logistics.statuses"),
          }}
        />
      </SectionShell>

      <SectionShell id="payments" title={t("payments.title")}>
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
      </SectionShell>

      <SectionShell id="photos" title={t("photos.title")}>
        <OrderPhotosPanel
          action={uploadOrderPhotoAction.bind(null, locale, order.id)}
          canManageCustomerVisibility={canManageAssignments}
          deactivateAction={deactivateOrderPhotoAction.bind(null, locale, order.id)}
          photos={photos}
          setCustomerVisibilityAction={setOrderPhotoCustomerVisibilityAction.bind(null, locale, order.id)}
          text={{
            caption: t("photos.caption"),
            categories: t.raw("photos.categories"),
            category: t("photos.category"),
            customerHidden: t("photos.customerHidden"),
            customerVisible: t("photos.customerVisible"),
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
      </SectionShell>
    </div>
  );
}
