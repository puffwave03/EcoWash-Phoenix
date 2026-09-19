"use server";

import { revalidatePath } from "next/cache";
import type {
  DailyCloseBlockerResult,
  DailyCloseRequest,
  DailyCloseResult,
  DailyCloseResultStatus,
} from "@/features/daily-close/persisted-types";
import { parseDailyCloseRequest } from "@/features/daily-close/validation";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RpcResult = {
  blockers?: unknown;
  closeId?: unknown;
  code?: unknown;
  snapshotHash?: unknown;
  status?: unknown;
};

const STATUSES = new Set<DailyCloseResultStatus>(["blocked", "created", "existing", "validation"]);

function result(status: DailyCloseResultStatus, code: string | null = null): DailyCloseResult {
  return { blockerCodes: [], blockers: [], closeId: null, code, snapshotHash: null, status };
}

function normalizeBlockers(value: unknown): DailyCloseBlockerResult[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const code = "code" in item && typeof item.code === "string" ? item.code : null;
    const count = "count" in item && typeof item.count === "number" ? item.count : null;
    return code && count !== null ? [{ code, count }] : [];
  });
}

function normalizeRpcResult(value: unknown): DailyCloseResult | null {
  if (!value || typeof value !== "object") return null;
  const rpc = value as RpcResult;
  if (typeof rpc.status !== "string" || !STATUSES.has(rpc.status as DailyCloseResultStatus)) return null;
  const blockers = normalizeBlockers(rpc.blockers);
  return {
    blockerCodes: blockers.map((blocker) => blocker.code),
    blockers,
    closeId: typeof rpc.closeId === "string" ? rpc.closeId : null,
    code: typeof rpc.code === "string" ? rpc.code : null,
    snapshotHash: typeof rpc.snapshotHash === "string" ? rpc.snapshotHash : null,
    status: rpc.status as DailyCloseResultStatus,
  };
}

export async function requestDailyCloseAction(locale: string, request: DailyCloseRequest): Promise<DailyCloseResult> {
  const parsed = parseDailyCloseRequest(request);
  if (!parsed.valid) return result("validation", "invalid_request");

  await requireOwnerOrManager(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("close_daily_close", {
    target_business_date: parsed.input.businessDate,
    target_idempotency_key: parsed.input.idempotencyKey,
    target_location_id: parsed.input.locationId,
    target_note: parsed.input.note,
  });

  if (error) {
    console.error("Daily close creation failed", error.code);
    return result("blocked", error.message === "daily_close_source_unavailable" ? "source_unavailable" : "request_failed");
  }

  const normalized = normalizeRpcResult(data);
  if (!normalized) return result("blocked", "invalid_server_response");
  if (normalized.status === "created") revalidatePath(`/${locale}/app/daily-close`);
  return normalized;
}
