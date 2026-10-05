import { getTranslations } from "next-intl/server";
import { CustomerPortalShell } from "@/components/portal/CustomerPortalShell";
import {
  CustomerPortalOrderList,
  type PortalFinanceText,
} from "@/components/portal/CustomerPortalViews";
import {
  countCustomerPortalOrders,
  listCustomerPortalOrdersPage,
  requireCustomerPortalAccess,
} from "@/features/portal/server/queries";
import { portalOrderHistoryHref } from "@/features/portal/pagination";
import type { ProductionStatus } from "@/features/orders/types";
import { getTenantBranding } from "@/features/branding/server/queries";

type CustomerPortalOrdersPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ cursor?: string }>;
};

export default async function CustomerPortalOrdersPage({
  params,
  searchParams,
}: CustomerPortalOrdersPageProps) {
  const { locale } = await params;
  const { cursor } = await searchParams;
  const access = await requireCustomerPortalAccess(locale);
  const [orderPage, completeOrderCount, branding, t, catalogT] = await Promise.all([
    listCustomerPortalOrdersPage(locale, cursor),
    countCustomerPortalOrders(locale),
    getTenantBranding(access.organizationId),
    getTranslations({ locale, namespace: "common.portal" }),
    getTranslations({ locale, namespace: "common.catalog" }),
  ]);
  const statusLabels = t.raw("statuses") as Record<ProductionStatus, string>;

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
      <CustomerPortalOrderList
        completeOrderCount={completeOrderCount}
        locale={locale}
        orders={orderPage.orders}
        pagination={{
          backToLatestHref: orderPage.pagination.isLatest ? null : portalOrderHistoryHref(),
          newerHref: orderPage.pagination.newerCursor
            ? portalOrderHistoryHref(orderPage.pagination.newerCursor)
            : null,
          olderHref: orderPage.pagination.olderCursor
            ? portalOrderHistoryHref(orderPage.pagination.olderCursor)
            : null,
        }}
        statusLabels={statusLabels}
        text={{
          assistance: t("assistance"),
          completed: t("completed"),
          delivery: t("delivery"),
          emptyOrders: t("emptyOrders"),
          finance: t.raw("finance") as PortalFinanceText,
          history: t("history"),
          nextTask: t("nextTask"),
          orderDate: t("orderDate"),
          orderReceived: t("orderReceived"),
          orders: t("orders"),
          photos: t("photos"),
          pickup: t("pickup"),
          pagination: t.raw("pagination") as {
            latest: string;
            navigation: string;
            newer: string;
            older: string;
          },
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
