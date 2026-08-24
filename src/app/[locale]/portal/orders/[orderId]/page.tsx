import { getTranslations } from "next-intl/server";
import { CustomerPortalShell } from "@/components/portal/CustomerPortalShell";
import {
  CustomerPortalOrderDetail,
  type PortalFinanceText,
} from "@/components/portal/CustomerPortalViews";
import {
  getCustomerPortalOrderDetail,
  requireCustomerPortalAccess,
} from "@/features/portal/server/queries";
import type { FulfillmentStatus } from "@/features/logistics/types";
import type { ProductionStatus } from "@/features/orders/types";

type CustomerPortalOrderDetailPageProps = {
  params: Promise<{ locale: string; orderId: string }>;
};

export default async function CustomerPortalOrderDetailPage({
  params,
}: CustomerPortalOrderDetailPageProps) {
  const { locale, orderId } = await params;
  const [access, order, t, catalogT] = await Promise.all([
    requireCustomerPortalAccess(locale),
    getCustomerPortalOrderDetail(locale, orderId),
    getTranslations({ locale, namespace: "common.portal" }),
    getTranslations({ locale, namespace: "common.catalog" }),
  ]);
  const statusLabels = t.raw("statuses") as Record<ProductionStatus, string>;
  const fulfillmentLabels = t.raw("fulfillmentStatuses") as Record<FulfillmentStatus, string>;

  return (
    <CustomerPortalShell
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
        fulfillmentLabels={fulfillmentLabels}
        locale={locale}
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
