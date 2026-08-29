import { getTranslations } from "next-intl/server";
import { ShopTerminalWorkspace, type ShopTerminalText } from "@/components/shop-terminal/ShopTerminalWorkspace";
import type { PrintActionText } from "@/components/printing/PrintOrderActions";
import { entitlementEnabled, FEATURES } from "@/features/entitlements/feature-catalog";
import { getCurrentEntitlements } from "@/features/entitlements/server/resolver";
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
  const [access, customers, recentOrders, session, entitlements, t, catalogT, printT] = await Promise.all([
    requireShopTerminalAccess(locale),
    listShopCustomers(locale),
    listShopRecentOrders(locale),
    getCurrentPosSession(locale),
    getCurrentEntitlements(locale, [FEATURES.printing]),
    getTranslations({ locale, namespace: "common.shopTerminal" }),
    getTranslations({ locale, namespace: "common.catalog" }),
    getTranslations({ locale, namespace: "common.print" }),
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
      canPrint={entitlementEnabled(entitlements, FEATURES.printing)}
      customers={customers}
      locale={locale}
      organizationName={access.membership.organization.name}
      printText={printT.raw("actions") as PrintActionText}
      recentOrders={recentOrders}
      role={access.membership.role}
      session={session}
      text={text}
    />
  );
}
