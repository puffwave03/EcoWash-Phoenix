import "server-only";

import { notFound } from "next/navigation";
import { requirePrintAccess } from "@/features/printing/server/access";
import type { ServiceAlbaran } from "@/features/service-albarans/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SELECT = "id, order_id, document_number, document_status, issued_at, cancelled_at, cancellation_reason, snapshot_version, snapshot";

export async function getServiceAlbaran(locale: string, albaranId: string): Promise<ServiceAlbaran> {
  const { membership } = await requirePrintAccess(locale);
  const supabase = await createSupabaseServerClient();
  const result = await supabase.from("service_albarans").select(SELECT)
    .eq("organization_id", membership.organization.id).eq("id", albaranId).maybeSingle<ServiceAlbaran>();
  if (result.error) throw new Error(`service_albaran_read_failed:${result.error.code}`);
  if (!result.data) notFound();
  if (result.data.snapshot_version !== 1 || result.data.snapshot?.version !== 1) throw new Error("service_albaran_snapshot_unsupported");
  return result.data;
}

export async function getOrderServiceAlbarans(locale: string, orderId: string, customerId: string) {
  const { membership } = await requirePrintAccess(locale);
  const supabase = await createSupabaseServerClient();
  // Authentication failures above keep their normal redirect/denial semantics.
  try {
    const [history, customer] = await Promise.all([
      supabase.from("service_albarans").select(SELECT).eq("organization_id", membership.organization.id)
        .eq("order_id", orderId).order("sequence_year", { ascending: false })
        .order("sequence_number", { ascending: false }).returns<ServiceAlbaran[]>(),
      supabase.from("customers").select("customer_type").eq("organization_id", membership.organization.id)
        .eq("id", customerId).maybeSingle<{ customer_type: string }>(),
    ]);
    if (history.error || customer.error || !Array.isArray(history.data) || !customer.data) {
      console.error("Service albaran history read failed", history.error?.code ?? customer.error?.code ?? "invalid_response");
      return { available: false } as const;
    }
    return { available: true, documents: history.data, businessCustomer: customer.data.customer_type === "business" } as const;
  } catch {
    console.error("Service albaran history transport failed");
    return { available: false } as const;
  }
}
