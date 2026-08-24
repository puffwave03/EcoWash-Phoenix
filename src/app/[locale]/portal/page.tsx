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
import { getTenantBranding } from "@/features/branding/server/queries";

type CustomerPortalPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function CustomerPortalPage({
  params,
}: CustomerPortalPageProps) {
  const { locale } = await params;
  const access = await requireCustomerPortalAccess(locale);
  const [orders, nextTask, options, branding, t, catalogT] = await Promise.all([
    listCustomerPortalOrders(locale),
    getNextCustomerPortalTask(locale),
    getCustomerPortalOrderRequestOptions(locale),
    getTenantBranding(access.organizationId),
    getTranslations({ locale, namespace: "common.portal" }),
    getTranslations({ locale, namespace: "common.catalog" }),
  ]);
  const statusLabels = t.raw("statuses") as Record<ProductionStatus, string>;
  const activeOrders = orders.filter((order) => !["completed", "cancelled"].includes(order.productionStatus));

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
      <CustomerPortalOverview
        activeOrders={activeOrders}
        branding={branding}
        customerName={access.customerName}
        locale={locale}
        nextTask={nextTask}
        orders={orders}
        segment={options.segment}
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
          categoryDescription: catalogT("categoryDescription"),
          categoryDescriptions: catalogT.raw("categoryDescriptions") as Record<string, string>,
          categoryLabels: catalogT.raw("categories") as Record<string, string>,
          fromPrice: catalogT("fromPrice"),
          inDelivery: t("inDelivery"),
          informationOnly: catalogT("informationOnly"),
          newRequest: t("request.nav"),
          promotion: t("promotion"),
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
          servicesForYou: t("segments.servicesForYou"),
          servicesForYouDescription: t("segments.servicesForYouDescription"),
          servicesCount: catalogT("servicesCount"),
          supportDetails: t("supportDetails"),
          status: t("status"),
          unitTypes: catalogT.raw("unitTypes") as Record<import("@/features/services/types").ServiceUnitType, string>,
          viewOrder: t("viewOrder"),
          visitWebsite: t("visitWebsite"),
          whatsapp: t("whatsapp"),
        }}
      />
    </CustomerPortalShell>
  );
}
