import { getTranslations } from "next-intl/server";
import { CustomerPortalShell } from "@/components/portal/CustomerPortalShell";
import {
  CustomerPortalOrderDetail,
  type PortalFinanceText,
  type PortalOnlinePaymentText,
} from "@/components/portal/CustomerPortalViews";
import {
  getCustomerPortalOrderDetail,
  requireCustomerPortalAccess,
} from "@/features/portal/server/queries";
import type { FulfillmentStatus } from "@/features/logistics/types";
import type { ProductionStatus } from "@/features/orders/types";
import { getTenantBranding } from "@/features/branding/server/queries";
import { randomUUID } from "node:crypto";
import { createOnlineCheckoutAction } from "@/features/online-payments/server/actions";
import {
  getCustomerOnlinePaymentAvailability,
  getLatestCustomerOnlinePaymentAttempt,
} from "@/features/online-payments/server/queries";

type CustomerPortalOrderDetailPageProps = {
  params: Promise<{ locale: string; orderId: string }>;
  searchParams: Promise<{ payment?: string }>;
};

export default async function CustomerPortalOrderDetailPage({
  params,
  searchParams,
}: CustomerPortalOrderDetailPageProps) {
  const { locale, orderId } = await params;
  const { payment } = await searchParams;
  const access = await requireCustomerPortalAccess(locale);
  const [order, branding, availability, attempt, t, catalogT] = await Promise.all([
    getCustomerPortalOrderDetail(locale, orderId),
    getTenantBranding(access.organizationId),
    getCustomerOnlinePaymentAvailability(locale, orderId),
    getLatestCustomerOnlinePaymentAttempt(locale, orderId),
    getTranslations({ locale, namespace: "common.portal" }),
    getTranslations({ locale, namespace: "common.catalog" }),
  ]);
  const statusLabels = t.raw("statuses") as Record<ProductionStatus, string>;
  const fulfillmentLabels = t.raw("fulfillmentStatuses") as Record<FulfillmentStatus, string>;

  return (
    <CustomerPortalShell
      brand={branding.brand}
      customerName={access.customerName}
      locale={locale}
      text={{
        assistance: t("assistance"),
        logout: t("logout"),
        navigationLabel: t("navigationLabel"),
        newRequest: t("request.nav"),
        orders: t("orders"),
        overview: t("overview"),
        profile: t("profile"),
        title: t("title"),
      }}
    >
      <CustomerPortalOrderDetail
        checkoutAction={createOnlineCheckoutAction.bind(null, locale, orderId)}
        checkoutIdempotencyKey={randomUUID()}
        fulfillmentLabels={fulfillmentLabels}
        locale={locale}
        onlinePayment={{
          attempt,
          availability,
          returnState: payment === "cancelled" || payment === "failed" || payment === "returned"
            ? payment
            : null,
        }}
        order={order}
        statusLabels={statusLabels}
        text={{
          assistance: t("assistance"),
          completed: t("completed"),
          delivery: t("delivery"),
          emptyOrders: t("emptyOrders"),
          finance: t.raw("finance") as PortalFinanceText,
          history: t("history"),
          items: t("items"),
          nextTask: t("nextTask"),
          noPhotos: t("noPhotos"),
          onlinePayment: t.raw("onlinePayments") as PortalOnlinePaymentText,
          orderDate: t("orderDate"),
          orderReceived: t("orderReceived"),
          orders: t("orders"),
          photos: t("photos"),
          pickup: t("pickup"),
          property: t("property"),
          ready: t("ready"),
          status: t("status"),
          unitTypes: catalogT.raw("unitTypes") as Record<import("@/features/services/types").ServiceUnitType, string>,
          viewOrder: t("viewOrder"),
        }}
      />
    </CustomerPortalShell>
  );
}
