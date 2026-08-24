import { getTranslations } from "next-intl/server";
import { CustomerPortalShell } from "@/components/portal/CustomerPortalShell";
import {
  CustomerPortalOverview,
  type PortalFinanceText,
} from "@/components/portal/CustomerPortalViews";
import {
  getCustomerPortalOrderRequestOptions,
  getNextCustomerPortalTask,
  listCustomerPortalOrders,
  requireCustomerPortalAccess,
} from "@/features/portal/server/queries";
import type { ProductionStatus } from "@/features/orders/types";

type CustomerPortalPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function CustomerPortalPage({
  params,
}: CustomerPortalPageProps) {
  const { locale } = await params;
  const [access, orders, nextTask, options, t] = await Promise.all([
    requireCustomerPortalAccess(locale),
    listCustomerPortalOrders(locale),
    getNextCustomerPortalTask(locale),
    getCustomerPortalOrderRequestOptions(locale),
    getTranslations({ locale, namespace: "common.portal" }),
  ]);
  const statusLabels = t.raw("statuses") as Record<ProductionStatus, string>;
  const activeOrders = orders.filter((order) => !["completed", "cancelled"].includes(order.productionStatus));

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
      <CustomerPortalOverview
        activeOrders={activeOrders}
        customerName={access.customerName}
        locale={locale}
        nextTask={nextTask}
        orders={orders}
        services={options.services}
        statusLabels={statusLabels}
        text={{
          activeOrders: t("activeOrders"),
          assistance: t("assistance"),
          completed: t("completed"),
          currentOrder: t("currentOrder"),
          delivery: t("delivery"),
          emptyOrders: t("emptyOrders"),
          finance: t.raw("finance") as PortalFinanceText,
          greeting: t("greeting"),
          history: t("history"),
          historyLink: t("historyLink"),
          fromPrice: t("fromPrice"),
          inDelivery: t("inDelivery"),
          newRequest: t("request.nav"),
          noActiveOrdersDescription: t("noActiveOrdersDescription"),
          noActiveOrdersTitle: t("noActiveOrdersTitle"),
          nextTask: t("nextTask"),
          orderDate: t("orderDate"),
          orderReceived: t("orderReceived"),
          orders: t("orders"),
          photos: t("photos"),
          pickup: t("pickup"),
          property: t("property"),
          quickActions: t("quickActions"),
          ready: t("ready"),
          recentOrders: t("recentOrders"),
          servicesDescription: t("servicesDescription"),
          servicesDiscovery: t("servicesDiscovery"),
          servicesEmpty: t("servicesEmpty"),
          servicePerPiece: t("request.perPiece"),
          servicePerWeight: t("request.perWeight"),
          status: t("status"),
          viewOrder: t("viewOrder"),
        }}
      />
    </CustomerPortalShell>
  );
}
