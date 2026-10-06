import { after } from "next/server";
import { isAccountantPackUuid } from "@/features/accounting/accountant-pack-validation";
import { getAccountingExportContext, InvalidAccountingExportLocationError } from "@/features/accounting/server/export-readers";
import { runAccountantPackWorker } from "@/features/accounting/server/accountant-pack-worker";
import { resolveAccountingPeriod } from "@/features/accounting/workspace";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

function kick(jobId: string) {
  after(async () => {
    try { await runAccountantPackWorker(jobId); }
    catch (error) { console.error("Accountant Pack kick failed", jobId, error instanceof Error ? error.message : "unknown"); }
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireOwnerOrManager(locale);
  const supabase = await createSupabaseServerClient();
  const value = new URL(request.url).searchParams.get("cursor");
  let cursor: { at: string; id: string } | null = null;
  try {
    if (value && value.length < 300) {
      const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
      if (typeof decoded.at === "string" && !Number.isNaN(Date.parse(decoded.at))
        && typeof decoded.id === "string" && isAccountantPackUuid(decoded.id)) cursor = decoded;
    }
  } catch { /* malformed cursor resets to latest */ }
  const { data, error } = await supabase.rpc("list_accountant_pack_jobs", {
    target_cursor_requested_at: cursor?.at ?? null, target_cursor_id: cursor?.id ?? null,
  });
  if (error) return Response.json({ error: "history_unavailable" }, { status: 503 });
  const rows = (data ?? []).slice(0, 20);
  const last = rows.at(-1);
  const nextCursor = (data?.length ?? 0) > 20 && last
    ? Buffer.from(JSON.stringify({ at: last.requested_at, id: last.id })).toString("base64url") : null;
  return Response.json({ rows, nextCursor }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return Response.json({ error: "invalid_request" }, { status: 400 }); }
  const supabase = await createSupabaseServerClient();
  const repeatJobId = typeof body.retryJobId === "string" ? body.retryJobId
    : typeof body.prepareAgainJobId === "string" ? body.prepareAgainJobId : null;
  if (repeatJobId) {
    await requireOwnerOrManager(locale);
    if (!isAccountantPackUuid(repeatJobId)) return Response.json({ error: "invalid_request" }, { status: 400 });
    const { data: id, error } = await supabase.rpc("retry_accountant_pack", { target_job_id: repeatJobId });
    if (error || !id) return Response.json({ error: "retry_unavailable" }, { status: 400 });
    kick(id);
    return Response.json({ id }, { status: 202, headers: { "Cache-Control": "private, no-store" } });
  }
  const location = body.location === null || body.location === undefined || body.location === ""
    ? null : typeof body.location === "string" ? body.location : "invalid";
  let context;
  try { context = await getAccountingExportContext(locale, location); }
  catch (error) {
    if (error instanceof InvalidAccountingExportLocationError) return Response.json({ error: "invalid_location" }, { status: 400 });
    throw error;
  }
  let selection;
  try {
    selection = resolveAccountingPeriod(
      typeof body.preset === "string" ? body.preset : undefined,
      typeof body.start === "string" ? body.start : undefined,
      typeof body.end === "string" ? body.end : undefined,
      context.timezone, undefined,
      { year: typeof body.year === "string" ? body.year : undefined,
        quarter: typeof body.quarter === "string" ? body.quarter : undefined },
    );
  } catch { return Response.json({ error: "invalid_period" }, { status: 400 }); }
  const { data: id, error } = await supabase.rpc("request_accountant_pack", {
    target_period_start: selection.period.startDate,
    target_period_end_exclusive: selection.period.endDateExclusive,
    target_location_id: location,
  });
  if (error || !id) return Response.json({ error: "request_unavailable" }, { status: 503 });
  kick(id);
  return Response.json({ id }, { status: 202, headers: { "Cache-Control": "private, no-store" } });
}
