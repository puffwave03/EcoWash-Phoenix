import "server-only";

import { notFound } from "next/navigation";
import { getTenantBranding } from "@/features/branding/server/queries";
import { getOrderLogistics } from "@/features/logistics/server/queries";
import { getOrderById, listOrderItems } from "@/features/orders/server/queries";
import { getOrderPayments, getOrderPaymentSummary } from "@/features/payments/server/queries";
import { requirePrintAccess } from "@/features/printing/server/access";
import type { PrintOrderContext } from "@/features/printing/types";
import { getDefaultPrinterProfiles } from "@/features/printer-settings/server/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FEATURES } from "@/features/entitlements/feature-catalog";
import { hasEntitlement } from "@/features/entitlements/server/resolver";

type MetadataRow = {
  created_by_profile: { display_name: string } | { display_name: string }[] | null;
  customer: { phone: string | null } | { phone: string | null }[] | null;
  location_id: string | null;
  location: { name: string } | { name: string }[] | null;
};

function relation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function getPrintOrderContext(locale: string, orderId: string): Promise<PrintOrderContext> {
  const access = await requirePrintAccess(locale);
  const supabase = await createSupabaseServerClient();
  const metadataPromise = supabase.from("orders")
    .select("location_id, customer:customers!orders_customer_same_organization!inner(phone), location:locations!orders_location_same_organization(name), created_by_profile:profiles!orders_created_by_fkey(display_name)")
    .eq("organization_id", access.membership.organization.id)
    .eq("id", orderId)
    .maybeSingle<MetadataRow>();
  const [order, items, payments, paymentSummary, logistics, branding, barcodeEnabled, metadataResult] = await Promise.all([
    getOrderById(locale, orderId),
    listOrderItems(locale, orderId),
    getOrderPayments(locale, orderId),
    getOrderPaymentSummary(locale, orderId),
    getOrderLogistics(locale, orderId),
    getTenantBranding(access.membership.organization.id),
    hasEntitlement(locale, FEATURES.barcode),
    metadataPromise,
  ]);

  if (metadataResult.error || !metadataResult.data) notFound();
  const metadata = metadataResult.data;
  const printerProfiles = await getDefaultPrinterProfiles(locale, metadata.location_id);

  return {
    barcodeEnabled,
    branding,
    createdByName: relation(metadata.created_by_profile)?.display_name ?? null,
    customerPhone: order.isSharedWalkIn ? order.walkInPhone : relation(metadata.customer)?.phone ?? null,
    items,
    locationName: relation(metadata.location)?.name ?? null,
    logistics,
    organizationName: access.membership.organization.name,
    order,
    payments,
    paymentSummary,
    printerProfiles,
    timezone: access.membership.organization.timezone,
  };
}
