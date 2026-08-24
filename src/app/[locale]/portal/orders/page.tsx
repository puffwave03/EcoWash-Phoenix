import { getTranslations } from "next-intl/server";
import { CustomerPortalShell } from "@/components/portal/CustomerPortalShell";
import {
  CustomerPortalOrderList,
  type PortalFinanceText,
} from "@/components/portal/CustomerPortalViews";
import {
  listCustomerPortalOrders,
  requireCustomerPortalAccess,
} from "@/features/portal/server/queries";
import type { ProductionStatus } from "@/features/orders/types";
import { getTenantBranding } from "@/features/branding/server/queries";

type CustomerPortalOrdersPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function CustomerPortalOrdersPage({
  params,
}: CustomerPortalOrdersPageProps) {
  const { locale } = await params;
  const access = await requireCustomerPortalAccess(locale);
  const [orders, branding, t, catalogT] = await Promise.all([
    listCustomerPortalOrders(locale),
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
        locale={locale}
        orders={orders}
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
