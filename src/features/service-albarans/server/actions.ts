"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FEATURES } from "@/features/entitlements/feature-catalog";
import { requireEntitlement } from "@/features/entitlements/server/resolver";
import { requirePrintAccess } from "@/features/printing/server/access";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function issueServiceAlbaranAction(locale: string, orderId: string, formData: FormData) {
  await requirePrintAccess(locale);
  const requestId = String(formData.get("requestId") ?? "");
  const previousId = String(formData.get("previousAlbaranId") ?? "");
  if (!UUID.test(orderId) || !UUID.test(requestId) || (previousId && !UUID.test(previousId))) {
    redirect(`/${locale}/app/orders/${encodeURIComponent(orderId)}?albaranError=1#service-albarans`);
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("issue_service_albaran", {
    target_order_id: orderId, target_request_id: requestId, target_previous_albaran_id: previousId || null,
  });
  if (error || typeof data !== "string" || !UUID.test(data)) {
    console.error("Service albaran issue failed", error?.code ?? "invalid_response");
    redirect(`/${locale}/app/orders/${encodeURIComponent(orderId)}?albaranError=1#service-albarans`);
  }
  revalidatePath(`/${locale}/app/orders/${orderId}`);
  redirect(`/${locale}/app/orders/${orderId}/albarans/${data}/print`);
}

export async function cancelServiceAlbaranAction(locale: string, orderId: string, albaranId: string, formData: FormData) {
  await requireOwnerOrManager(locale);
  await requireEntitlement(locale, FEATURES.printing);
  const reason = String(formData.get("reason") ?? "").trim();
  if (!UUID.test(orderId) || !UUID.test(albaranId) || !reason || reason.length > 500) {
    redirect(`/${locale}/app/orders/${encodeURIComponent(orderId)}?albaranError=1#service-albarans`);
  }
  const supabase = await createSupabaseServerClient();
  // IDs supplied by the browser are identifiers only; the RPC derives authority.
  const { error } = await supabase.rpc("cancel_service_albaran", { target_order_id: orderId, target_albaran_id: albaranId, target_reason: reason });
  if (error) {
    console.error("Service albaran cancellation failed", error.code);
    redirect(`/${locale}/app/orders/${orderId}?albaranError=1#service-albarans`);
  }
  revalidatePath(`/${locale}/app/orders/${orderId}`);
  revalidatePath(`/${locale}/app/orders/${orderId}/albarans/${albaranId}/print`);
  redirect(`/${locale}/app/orders/${orderId}#service-albarans`);
}
