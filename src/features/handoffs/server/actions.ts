"use server";

import { revalidatePath } from "next/cache";
import { hasOperationalCapability } from "@/lib/auth/capabilities";
import { requireMembership } from "@/lib/auth/require-membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function completeCustomerHandoffAction(
  locale: string,
  orderId: string,
  formData: FormData,
) {
  const { membership } = await requireMembership(locale);
  if (!hasOperationalCapability(membership, "pos")) return;

  const notes = String(formData.get("notes") ?? "").trim().slice(0, 1000);
  const confirmUnpaid = formData.get("confirmUnpaid") === "true";
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("complete_customer_handoff", {
    target_confirm_unpaid: confirmUnpaid,
    target_notes: notes || null,
    target_order_id: orderId,
  });

  if (error) {
    console.error("Customer handoff failed", error.code);
    return;
  }

  revalidatePath(`/${locale}/app`);
  revalidatePath(`/${locale}/app/orders`);
  revalidatePath(`/${locale}/app/orders/${orderId}`);
  revalidatePath(`/${locale}/app/daily-close`);
}
