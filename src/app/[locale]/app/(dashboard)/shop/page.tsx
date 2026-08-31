import { getTranslations } from "next-intl/server";
import { ShopTerminalWorkspace, type ShopTerminalText } from "@/components/shop-terminal/ShopTerminalWorkspace";
import type { PrintActionText } from "@/components/printing/PrintOrderActions";
import { entitlementEnabled, FEATURES } from "@/features/entitlements/feature-catalog";
import { getCurrentEntitlements } from "@/features/entitlements/server/resolver";
import { getCurrentPosSession } from "@/features/pos/server/queries";
import {
  createShopCustomerAction,
  loadShopServicesAction,
  resolveShopCodeAction,
  submitShopOrderAction,
} from "@/features/shop-terminal/server/actions";
import { requireShopTerminalAccess } from "@/features/shop-terminal/server/access";
import { listShopCustomers } from "@/features/shop-terminal/server/queries";
import { createQuickDropAction } from "@/features/quick-drop/server/actions";
import { listPendingQuickDrops } from "@/features/quick-drop/server/queries";
import type { QuickDropText } from "@/components/quick-drop/QuickDropTerminalPanel";

type ShopPageProps = { params: Promise<{ locale: string }> };

export default async function ShopPage({ params }: ShopPageProps) {
  const { locale } = await params;
  const [access, customers, session, pendingQuickDrops, entitlements, t, catalogT, printT, barcodeT, quickDropT] = await Promise.all([
    requireShopTerminalAccess(locale),
    listShopCustomers(locale),
    getCurrentPosSession(locale),
    listPendingQuickDrops(locale),
    getCurrentEntitlements(locale, [FEATURES.printing, FEATURES.billingInvoicing, FEATURES.barcode]),
    getTranslations({ locale, namespace: "common.shopTerminal" }),
    getTranslations({ locale, namespace: "common.catalog" }),
    getTranslations({ locale, namespace: "common.print" }),
    getTranslations({ locale, namespace: "common.barcode.terminal" }),
    getTranslations({ locale, namespace: "common.quickDrop" }),
  ]);
  const text = {
    ...(t.raw("labels") as Omit<ShopTerminalText, "unitTypes">),
    scanCode: barcodeT("scanCode"),
    scanInvalid: barcodeT("scanInvalid"),
    scanning: barcodeT("scanning"),
    scanNotFound: barcodeT("scanNotFound"),
    scanPlaceholder: barcodeT("scanPlaceholder"),
    scanSubmit: barcodeT("scanSubmit"),
    unitTypes: catalogT.raw("unitTypes") as Record<string, string>,
  } satisfies ShopTerminalText;

  return (
    <ShopTerminalWorkspace
      actions={{
        createCustomer: createShopCustomerAction.bind(null, locale),
        createQuickDrop: createQuickDropAction.bind(null, locale),
        loadServices: loadShopServicesAction.bind(null, locale),
        resolveCode: resolveShopCodeAction.bind(null, locale),
        submit: submitShopOrderAction.bind(null, locale),
      }}
      canPrint={entitlementEnabled(entitlements, FEATURES.printing)}
      canScan={entitlementEnabled(entitlements, FEATURES.barcode)}
      canInvoice={entitlementEnabled(entitlements, FEATURES.billingInvoicing) && access.membership.role !== "staff"}
      canConfigurePrinters={entitlementEnabled(entitlements, FEATURES.printing) && access.membership.role !== "staff"}
      categoryLabels={catalogT.raw("categories") as Record<string, string>}
      customers={customers}
      locale={locale}
      organizationName={access.membership.organization.name}
      operatorName={access.profile.displayName || access.user.email || access.membership.role}
      pendingQuickDrops={pendingQuickDrops}
      printText={printT.raw("actions") as PrintActionText}
      quickDropText={{
        action: quickDropT("action"),
        cancel: quickDropT("cancel"),
        confirm: quickDropT("confirm"),
        confirming: quickDropT("confirming"),
        detailOrder: quickDropT("detailOrder"),
        dueAt: quickDropT("dueAt"),
        errorGeneric: quickDropT("errorGeneric"),
        errorValidation: quickDropT("errorValidation"),
        help: quickDropT("help"),
        labelsDeferred: quickDropT("labelsDeferred"),
        locationRequired: quickDropT("locationRequired"),
        newOrder: quickDropT("newOrder"),
        newQuickDrop: quickDropT("newQuickDrop"),
        note: quickDropT("note"),
        notePlaceholder: quickDropT("notePlaceholder"),
        openOrder: quickDropT("openOrder"),
        pendingDetail: quickDropT("pendingDetail"),
        pendingList: quickDropT("pendingList"),
        qrAria: quickDropT("qrAria"),
        received: quickDropT("received"),
        success: quickDropT("success"),
        unpriced: quickDropT("unpriced"),
      } satisfies QuickDropText}
      role={access.membership.role}
      session={session}
      text={text}
    />
  );
}
