import { getTranslations } from "next-intl/server";
import { CustomerPortalShell } from "@/components/portal/CustomerPortalShell";
import { CustomerPortalOverview } from "@/components/portal/CustomerPortalViews";
import {
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
  const [access, orders, nextTask, t] = await Promise.all([
    requireCustomerPortalAccess(locale),
    listCustomerPortalOrders(locale),
    getNextCustomerPortalTask(locale),
    getTranslations({ locale, namespace: "common.portal" }),
  ]);
  const statusLabels = t.raw("statuses") as Record<ProductionStatus, string>;
  const activeOrders = orders.filter((order) => !["completed", "cancelled"].includes(order.productionStatus));

  return (
    <CustomerPortalShell
      customerName={access.customerName}
      locale={locale}
      text={{
        logout: t("logout"),
        navigationLabel: t("navigationLabel"),
        newRequest: t("request.nav"),
        orders: t("orders"),
        overview: t("overview"),
        title: t("title"),
      }}
    >
      <CustomerPortalOverview
        activeOrders={activeOrders}
        locale={locale}
        nextTask={nextTask}
        statusLabels={statusLabels}
        text={{
          activeOrders: t("activeOrders"),
          completed: t("completed"),
          delivery: t("delivery"),
          emptyOrders: t("emptyOrders"),
          greeting: t("greeting"),
          history: t("history"),
          historyLink: t("historyLink"),
          nextTask: t("nextTask"),
          orderDate: t("orderDate"),
          orderReceived: t("orderReceived"),
          orders: t("orders"),
          photos: t("photos"),
          pickup: t("pickup"),
          property: t("property"),
          ready: t("ready"),
          status: t("status"),
        }}
      />
    </CustomerPortalShell>
  );
}
