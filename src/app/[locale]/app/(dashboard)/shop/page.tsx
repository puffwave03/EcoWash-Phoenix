import { getTranslations } from "next-intl/server";
import { ShopTerminalWorkspace, type ShopTerminalText } from "@/components/shop-terminal/ShopTerminalWorkspace";
import { getCurrentPosSession } from "@/features/pos/server/queries";
import {
  createShopCustomerAction,
  loadShopServicesAction,
  submitShopOrderAction,
} from "@/features/shop-terminal/server/actions";
import { requireShopTerminalAccess } from "@/features/shop-terminal/server/access";
import { listShopCustomers, listShopRecentOrders } from "@/features/shop-terminal/server/queries";

type ShopPageProps = { params: Promise<{ locale: string }> };

export default async function ShopPage({ params }: ShopPageProps) {
  const { locale } = await params;
  const [access, customers, recentOrders, session, t, catalogT] = await Promise.all([
    requireShopTerminalAccess(locale),
    listShopCustomers(locale),
    listShopRecentOrders(locale),
    getCurrentPosSession(locale),
    getTranslations({ locale, namespace: "common.shopTerminal" }),
    getTranslations({ locale, namespace: "common.catalog" }),
  ]);
  const text = {
    ...(t.raw("labels") as Omit<ShopTerminalText, "unitTypes">),
    unitTypes: catalogT.raw("unitTypes") as Record<string, string>,
  } satisfies ShopTerminalText;

  return (
    <ShopTerminalWorkspace
      actions={{
        createCustomer: createShopCustomerAction.bind(null, locale),
        loadServices: loadShopServicesAction.bind(null, locale),
        submit: submitShopOrderAction.bind(null, locale),
      }}
      customers={customers}
      locale={locale}
      organizationName={access.membership.organization.name}
      recentOrders={recentOrders}
      role={access.membership.role}
      session={session}
      text={text}
    />
  );
}
