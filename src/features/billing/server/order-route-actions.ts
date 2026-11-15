"use server";
import { ticketUnicoEnabled } from "@/features/billing/server/ticket-unico";
import { redirect } from "next/navigation";
import { getBillingOrderEntry } from "./order-entry";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function prepareOrdinaryBillingForOrder(locale: string, orderId: string) {
  // Recompute the authorized destination; no browser-provided tenant or URL.
  const entry = await getBillingOrderEntry(locale, orderId);
  if (entry.kind === "unavailable") redirect(`/${locale}/app/orders/${orderId}`);
  if (entry.kind === "prepare" && await ticketUnicoEnabled(locale)) {
    const client = await createSupabaseServerClient();
    const { error } = await client.rpc("request_order_ordinary_invoice", { target_order_id: orderId });
    if (error) redirect(`/${locale}/app/orders/${orderId}?fiscalReview=1`);
  }
  redirect(`/${locale}${entry.href}`);
}
