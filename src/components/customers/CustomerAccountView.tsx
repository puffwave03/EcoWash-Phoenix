import { getTranslations } from "next-intl/server";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { CustomerPortalAccessPanel } from "@/components/customers/CustomerPortalAccessPanel";
import { CustomerSegmentAssignmentPanel } from "@/components/customers/CustomerSegmentAssignmentPanel";
import { DeactivateButton } from "@/components/customers/DeactivateButton";
import {
  EmptyState,
  StatusBadge,
  type Tone,
} from "@/components/operational/OperationalUi";
import { PropertyList } from "@/components/properties/PropertyList";
import type { CustomerSegmentAssignment } from "@/features/catalog-segments/types";
import { assignCustomerSegmentAction } from "@/features/catalog-segments/server/actions";
import type {
  CustomerAccountFinancials,
  CustomerAccountPeriod,
} from "@/features/customer-account/types";
import type { Customer, Property } from "@/features/customers/types";
import { deactivateCustomerAction } from "@/features/customers/server/actions";
import type { ProductionStatus } from "@/features/orders/types";
import type {
  DerivedPaymentStatus,
  PaymentMethod,
  PaymentRecordStatus,
} from "@/features/payments/types";
import type { CustomerPortalAccessSummary } from "@/features/portal/types";
import {
  inviteCustomerPortalAction,
  manageCustomerPortalAccessAction,
} from "@/features/portal/server/actions";
import { Link } from "@/i18n/navigation";
import { formatCurrency } from "@/lib/number-format";

function formatDate(value: string | null, locale: string, withTime = false) {
  if (!value) return "-";

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" as const } : {}),
  }).format(new Date(value));
}

function latestDate(values: Array<string | null>) {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
}

function productionTone(status: ProductionStatus): Tone {
  if (status === "completed" || status === "ready") return "success";
  if (status === "on_hold") return "warning";

  return "info";
}

function paymentTone(status: DerivedPaymentStatus | PaymentRecordStatus): Tone {
  if (status === "paid" || status === "confirmed") return "success";
  if (status === "partially_paid" || status === "pending") return "warning";
  if (status === "refunded") return "info";

  return "neutral";
}

function address(customer: Customer) {
  return [
    customer.billingAddressLine1,
    customer.billingAddressLine2,
    customer.billingPostalCode,
    customer.billingCity,
    customer.billingCountryCode,
  ].filter(Boolean).join(", ");
}

export async function CustomerAccountView({
  customer,
  financials,
  locale,
  period,
  portalAccess,
  previewUrl,
  properties,
  segmentAssignment,
}: {
  customer: Customer;
  financials: CustomerAccountFinancials;
  locale: string;
  period: CustomerAccountPeriod;
  portalAccess: CustomerPortalAccessSummary | null;
  previewUrl: string | null;
  properties: Property[];
  segmentAssignment: CustomerSegmentAssignment;
}) {
  const [t, customerText] = await Promise.all([
    getTranslations({ locale, namespace: "common.customerAccount" }),
    getTranslations({ locale, namespace: "common.customers" }),
  ]);
  const productionStatuses = t.raw("productionStatuses") as Record<ProductionStatus, string>;
  const paymentStatuses = t.raw("paymentStatuses") as Record<DerivedPaymentStatus | PaymentRecordStatus, string>;
  const paymentMethods = t.raw("paymentMethods") as Record<PaymentMethod, string>;
  const currentSegment = segmentAssignment.segments.find(
    (segment) => segment.id === segmentAssignment.currentSegmentId,
  );
  const lastActivity = latestDate([
    customer.updatedAt,
    portalAccess?.updatedAt ?? null,
    ...financials.summaries.flatMap((summary) => [summary.lastOrderAt, summary.lastPaymentAt]),
  ]);
  const billingAddress = address(customer);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[1.5rem] border border-primary/15 bg-white shadow-card">
        <div className="h-1.5 bg-gradient-to-r from-primary via-secondary to-primary/20" />
        <div className="p-5 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
                  {customer.customerType === "business" ? customerText("types.business") : customerText("types.individual")}
                </p>
                <StatusBadge tone={customer.isActive ? "success" : "neutral"}>
                  {customer.isActive ? customerText("active") : customerText("inactive")}
                </StatusBadge>
              </div>
              <h1 className="mt-3 break-words text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {customer.displayName}
              </h1>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
                <span>{customer.email || t("notAvailable")}</span>
                <span>{customer.phone || t("notAvailable")}</span>
                {customer.customerCode ? <span>{t("customerCode")}: {customer.customerCode}</span> : null}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-primary">{t("segment")}:</span>
                <span className="rounded-full border border-primary/15 bg-primary-soft px-3 py-1 font-semibold text-primary">
                  {currentSegment?.name ?? t("noSegment")}
                </span>
                <span className="text-muted">{t("lastActivity")}: {formatDate(lastActivity, locale, true)}</span>
              </div>
            </div>
            <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-1 xl:grid-cols-2">
              <Link href={`/app/orders/new?customerId=${customer.id}`} locale={locale}>
                <Button className="w-full">{t("actions.createOrder")}</Button>
              </Link>
              <Link href={`/app/customers/${customer.id}/properties/new`} locale={locale}>
                <Button className="w-full" variant="secondary">{t("actions.addProperty")}</Button>
              </Link>
              <Link href={`/app/customers/${customer.id}/edit`} locale={locale}>
                <Button className="w-full" variant="secondary">{customerText("edit")}</Button>
              </Link>
              <a className="inline-flex min-h-11 items-center justify-center rounded-control border border-secondary bg-surface px-5 py-2.5 text-sm font-semibold text-primary transition-standard hover:bg-secondary-soft" href="#account-admin">
                {t("actions.accountAdmin")}
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="financial-summary">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">{t("financial.eyebrow")}</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground" id="financial-summary">{t("financial.title")}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">{t("financial.description")}</p>
        </div>
        {financials.summaries.length === 0 ? (
          <EmptyState>{t("financial.empty")}</EmptyState>
        ) : financials.summaries.map((summary) => (
          <div className="space-y-3" key={summary.currency}>
            {financials.summaries.length > 1 ? (
              <p className="text-sm font-semibold text-primary">{t("financial.currencyGroup", { currency: summary.currency })}</p>
            ) : null}
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
              <div className={`relative col-span-2 overflow-hidden rounded-card border p-4 shadow-[0_6px_20px_rgb(15_59_46_/_0.035)] lg:col-span-1 ${summary.outstandingBalance > 0 ? "border-amber-200 bg-amber-50/55" : "border-emerald-200 bg-emerald-50/45"}`}>
                <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${summary.outstandingBalance > 0 ? "bg-amber-500" : "bg-emerald-600"}`} />
                <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{t("financial.outstanding")}</dt>
                <dd className={`mt-2 text-2xl font-semibold tracking-tight ${summary.outstandingBalance > 0 ? "text-amber-800" : "text-emerald-700"}`}>{formatCurrency(summary.outstandingBalance, summary.currency, locale)}</dd>
                <p className="mt-1 text-xs text-muted">{t("financial.outstandingOrders", { count: summary.outstandingOrderCount })}</p>
              </div>
              {[
                [t("financial.grossValue"), formatCurrency(summary.grossOrderValue, summary.currency, locale)],
                [t("financial.netPaid"), formatCurrency(summary.netPaid, summary.currency, locale)],
                [t("financial.orders"), String(summary.orderCount)],
                [t("financial.averageOrder"), formatCurrency(summary.averageOrderValue, summary.currency, locale)],
                [t("financial.refunds"), formatCurrency(summary.refundedPayments, summary.currency, locale)],
              ].map(([label, value]) => (
                <div className="relative overflow-hidden rounded-card border border-border bg-white p-4 shadow-[0_6px_20px_rgb(15_59_46_/_0.035)]" key={label}>
                  <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-secondary/65" />
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</dt>
                  <dd className="mt-2 text-xl font-semibold tracking-tight text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-muted">
              {t("financial.confirmedPayments")}: {formatCurrency(summary.confirmedPayments, summary.currency, locale)} · {t("financial.outstandingValue")}: {formatCurrency(summary.outstandingOrderValue, summary.currency, locale)}
            </p>
          </div>
        ))}
      </section>

      <nav className="flex flex-wrap gap-2" aria-label={t("history.filterLabel")}>
        {(["recent", "year", "all"] as const).map((value) => (
          <Link
            className={`inline-flex min-h-11 items-center rounded-control border px-4 text-sm font-semibold transition-standard ${period === value ? "border-primary bg-primary text-white" : "border-border bg-white text-primary hover:bg-primary-soft"}`}
            href={`/app/customers/${customer.id}?period=${value}`}
            key={value}
            locale={locale}
          >
            {t(`history.periods.${value}`)}
          </Link>
        ))}
      </nav>

      <section className="space-y-4" aria-labelledby="customer-orders">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground" id="customer-orders">{t("orders.title")}</h2>
            <p className="mt-1 text-sm text-muted">{t("orders.description")}</p>
          </div>
        </div>
        {financials.orders.length === 0 ? <EmptyState>{t("orders.empty")}</EmptyState> : (
          <div className="grid gap-3 lg:grid-cols-2">
            {financials.orders.map((order) => (
              <article className="rounded-card border border-border bg-white p-4 shadow-[0_6px_20px_rgb(15_59_46_/_0.035)] sm:p-5" key={order.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link className="text-lg font-semibold text-primary hover:underline" href={`/app/orders/${order.id}`} locale={locale}>{order.orderNumber}</Link>
                    <p className="mt-1 text-sm text-muted">{formatDate(order.createdAt, locale)} · {order.propertyName || t("orders.noProperty")}</p>
                  </div>
                  <StatusBadge tone={productionTone(order.productionStatus)}>{productionStatuses[order.productionStatus]}</StatusBadge>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm sm:grid-cols-3">
                  <div><dt className="text-muted">{t("orders.total")}</dt><dd className="mt-1 font-semibold text-foreground">{formatCurrency(order.total, order.currency, locale)}</dd></div>
                  <div><dt className="text-muted">{t("orders.paid")}</dt><dd className="mt-1 font-semibold text-emerald-700">{formatCurrency(order.totalPaid, order.currency, locale)}</dd></div>
                  <div className="col-span-2 sm:col-span-1"><dt className="text-muted">{t("orders.outstanding")}</dt><dd className={`mt-1 font-semibold ${order.balanceDue > 0 ? "text-amber-800" : "text-emerald-700"}`}>{formatCurrency(order.balanceDue, order.currency, locale)}</dd></div>
                </dl>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <StatusBadge tone={paymentTone(order.paymentStatus)}>{paymentStatuses[order.paymentStatus]}</StatusBadge>
                  <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline" href={`/app/orders/${order.id}`} locale={locale}>{t("orders.open")} →</Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="customer-payments">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground" id="customer-payments">{t("payments.title")}</h2>
          <p className="mt-1 text-sm text-muted">{t("payments.description")}</p>
        </div>
        {financials.payments.length === 0 ? <EmptyState>{t("payments.empty")}</EmptyState> : (
          <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-white shadow-card">
            {financials.payments.map((payment) => (
              <article className="grid gap-3 p-4 sm:grid-cols-[1.1fr_1fr_1fr_auto] sm:items-center sm:p-5" key={payment.id}>
                <div>
                  <p className={`text-lg font-semibold ${payment.status === "refunded" ? "text-blue-800" : "text-foreground"}`}>
                    {payment.status === "refunded" ? "−" : ""}{formatCurrency(payment.amount, payment.currency, locale)}
                  </p>
                  <p className="mt-1 text-sm text-muted">{formatDate(payment.paidAt, locale, true)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{t("payments.method")}</p>
                  <p className="mt-1 text-sm font-semibold text-primary">{paymentMethods[payment.method]}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{t("payments.order")}</p>
                  <Link className="mt-1 inline-flex min-h-8 items-center text-sm font-semibold text-primary hover:underline" href={`/app/orders/${payment.orderId}`} locale={locale}>{payment.orderNumber}</Link>
                </div>
                <StatusBadge tone={paymentTone(payment.status)}>{paymentStatuses[payment.status]}</StatusBadge>
              </article>
            ))}
          </div>
        )}
        <p className="text-xs leading-5 text-muted">{t("history.boundedNote")}</p>
      </section>

      <section className="space-y-4" aria-labelledby="customer-properties">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground" id="customer-properties">{t("properties.title")}</h2>
            <p className="mt-1 text-sm text-muted">{t("properties.description", { count: properties.length })}</p>
          </div>
          <Link href={`/app/customers/${customer.id}/properties/new`} locale={locale}><Button variant="secondary">{customerText("newProperty")}</Button></Link>
        </div>
        <PropertyList empty={customerText("propertiesEmpty")} locale={locale} properties={properties} view={customerText("view")} />
      </section>

      <section className="space-y-4" id="account-admin" aria-labelledby="account-admin-title">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">{t("admin.eyebrow")}</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground" id="account-admin-title">{t("admin.title")}</h2>
          <p className="mt-1 text-sm text-muted">{t("admin.description")}</p>
        </div>
        <details className="group rounded-card border border-border bg-white shadow-card" open>
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-semibold text-primary marker:content-none">
            {t("admin.relationship")}
            <span aria-hidden="true" className="text-xl transition-transform group-open:rotate-45">+</span>
          </summary>
          <div className="grid gap-4 border-t border-border p-4 lg:grid-cols-2 lg:p-5">
            <CustomerSegmentAssignmentPanel
              action={assignCustomerSegmentAction.bind(null, locale, customer.id)}
              assignment={segmentAssignment}
              text={{
                description: customerText("segment.description"), error: customerText("segment.error"), none: customerText("segment.none"), save: customerText("segment.save"), saved: customerText("segment.saved"), saving: customerText("segment.saving"), title: customerText("segment.title"),
              }}
            />
            <CustomerPortalAccessPanel
              access={portalAccess}
              defaultEmail={customer.email}
              inviteAction={inviteCustomerPortalAction.bind(null, locale, customer.id)}
              locale={locale}
              manageAction={manageCustomerPortalAccessAction.bind(null, locale, customer.id)}
              previewUrl={previewUrl}
              text={{
                active: customerText("portal.active"), accessDisabled: customerText("portal.accessDisabled"), authUnavailable: customerText("portal.authUnavailable"), configurationError: customerText("portal.configurationError"), disable: customerText("portal.disable"), disabled: customerText("portal.disabled"), email: customerText("portal.email"), emailDelivery: customerText("portal.emailDelivery"), emailInvalid: customerText("portal.emailInvalid"), enable: customerText("portal.enable"), error: customerText("portal.error"), invite: customerText("portal.invite"), invitedAt: customerText("portal.invitedAt"), lastSignIn: customerText("portal.lastSignIn"), inviteError: customerText("portal.inviteError"), membershipError: customerText("portal.membershipError"), noLastSignIn: customerText("portal.noLastSignIn"), pending: customerText("portal.pending"), preview: customerText("portal.preview"), rateLimit: customerText("portal.rateLimit"), resend: customerText("portal.resend"), resetPassword: customerText("portal.resetPassword"), resetPasswordError: customerText("portal.resetPasswordError"), resetPasswordSuccess: customerText("portal.resetPasswordSuccess"), resendSuccess: customerText("portal.resendSuccess"), success: customerText("portal.success"), title: customerText("portal.title"), unauthorized: customerText("portal.unauthorized"),
              }}
            />
          </div>
        </details>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-3 bg-white">
            <div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-secondary">{t("billing.eyebrow")}</p><h3 className="mt-1 text-lg font-semibold text-primary">{t("billing.title")}</h3></div>
            <p className="text-sm leading-6 text-muted">{billingAddress || t("billing.noAddress")}</p>
            {customer.taxId ? <p className="text-sm text-muted">{customerText("taxId")}: <span className="font-semibold text-primary">{customer.taxId}</span></p> : null}
            <p className="rounded-control border border-dashed border-border bg-[#fafbfa] px-4 py-3 text-sm font-semibold text-muted">{t("billing.notConfigured")}</p>
          </Card>
          <Card className="space-y-4 bg-white">
            <div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-secondary">{t("lifecycle.eyebrow")}</p><h3 className="mt-1 text-lg font-semibold text-primary">{t("lifecycle.title")}</h3></div>
            <p className="text-sm leading-6 text-muted">{t("lifecycle.description")}</p>
            {customer.isActive ? (
              <DeactivateButton action={deactivateCustomerAction.bind(null, locale, customer.id)} confirmLabel={customerText("confirmDeactivate")} label={customerText("deactivate")} pendingLabel={customerText("deactivating")} />
            ) : <StatusBadge tone="neutral">{customerText("inactive")}</StatusBadge>}
          </Card>
        </div>
      </section>
    </div>
  );
}
