import "server-only";
import { requirePosAccess } from "@/features/pos/server/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseFiscalCoverage, type FiscalCoverage } from "@/features/billing/fiscal-coverage";

export async function getPosFiscalCoverage(locale: string, paymentIds: string[]): Promise<FiscalCoverage> {
  await requirePosAccess(locale);
  if (paymentIds.length > 100) return { state: "unavailable" };
  try {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.rpc("get_pos_fiscal_coverage", { target_payment_ids: paymentIds });
    const parsed = error ? { state: "unavailable" } as const : parseFiscalCoverage(data);
    if (parsed.state === "ready" && (parsed.payments.length !== new Set(paymentIds).size
      || parsed.payments.some(p => !paymentIds.includes(p.paymentId)))) return { state: "unavailable" };
    return parsed;
  } catch {
    return { state: "unavailable" };
  }
}
