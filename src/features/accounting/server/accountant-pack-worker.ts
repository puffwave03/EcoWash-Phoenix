import "server-only";

import { createReadStream } from "node:fs";
import { rm, stat } from "node:fs/promises";
import { Upload } from "tus-js-client";
import { isAccountantPackUuid } from "@/features/accounting/accountant-pack-validation";
import { accountingSummaryCsvChunks } from "@/features/accounting/server/accountant-support";
import { ArtifactRuntimeLimitError, createAccountantPackZip, type CsvSource } from "@/features/accounting/server/accountant-pack-stream";
import { dailyCloseRegisterCsvChunks } from "@/features/accounting/server/daily-close-register";
import { accountantExpensesCsvChunks, accountingSalesCsvChunks, type SalesEvent, type SalesPageReader, type SupabaseServerClient } from "@/features/accounting/server/export-readers";
import { addLocalDays, resolveAccountingPeriod } from "@/features/accounting/workspace";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseAdminConfig } from "@/lib/supabase/env";

const BUCKET = "accounting-exports";

type Job = {
  id: string; organization_id: string; period_start: string; period_end_exclusive: string;
  timezone: string; location_id: string | null; location_name_snapshot: string | null;
  organization_name_snapshot: string; pack_schema_version: number; attempt_count: number;
  lease_token: string; source_read_started_at: string;
};

function filename(job: Job) {
  const year = job.period_start.slice(0, 4);
  for (const quarter of [1, 2, 3, 4]) {
    const selected = resolveAccountingPeriod("quarter", undefined, undefined, job.timezone, undefined,
      { year, quarter: String(quarter) });
    if (selected.period.startDate === job.period_start && selected.period.endDateExclusive === job.period_end_exclusive) {
      return `accountant-pack-${year}-Q${quarter}.zip`;
    }
  }
  return `accountant-pack-${job.period_start}_${addLocalDays(job.period_end_exclusive, -1)}.zip`;
}

export function accountantPackStoragePath(job: Job) {
  return `${job.organization_id}/${job.id}/attempt-${job.attempt_count}-${job.lease_token}.zip`;
}

function tusEndpoint(urlString: string) {
  const url = new URL(urlString);
  const match = /^([a-z0-9-]+)\.supabase\.co$/.exec(url.hostname);
  if (url.protocol !== "https:" || !match || url.pathname !== "/") throw new Error("storage_endpoint_invalid");
  return `https://${match[1]}.storage.supabase.co/storage/v1/upload/resumable`;
}

async function uploadZip(path: string, objectPath: string, sizeBytes: number) {
  const { serviceRoleKey, url } = getSupabaseAdminConfig();
  const source = createReadStream(path);
  try {
    await new Promise<void>((resolve, reject) => {
      const upload = new Upload(source, {
        endpoint: tusEndpoint(url), uploadSize: sizeBytes, chunkSize: 6 * 1024 * 1024,
        storeFingerprintForResuming: false, retryDelays: [0, 1000, 3000],
        headers: { authorization: `Bearer ${serviceRoleKey}` },
        metadata: { bucketName: BUCKET, objectName: objectPath, contentType: "application/zip", cacheControl: "0" },
        onError: reject, onSuccess: () => resolve(),
      });
      upload.start();
    });
  } finally {
    source.destroy();
  }
}

async function processClaimedJob(job: Job) {
  const admin = createSupabaseAdminClient();
  const client = admin as unknown as SupabaseServerClient;
  const period = { startDate: job.period_start, endDateExclusive: job.period_end_exclusive };
  const locationId = job.location_id;
  const rows = [{ rowCount: 0, currencies: [] as string[] }, { rowCount: 0 }, { rowCount: 0 }, { rowCount: 0 }];
  const workerPageReader: SalesPageReader = async ({ cursor, limit }) => {
    const { data, error } = await admin.rpc("list_accountant_pack_worker_sales_page", {
      target_job_id: job.id, target_lease_token: job.lease_token,
      target_cursor_event_date: cursor?.date ?? null, target_cursor_event_type: cursor?.type ?? null,
      target_cursor_event_id: cursor?.id ?? null, target_limit: limit,
    }).returns<SalesEvent[]>() as unknown as { data: SalesEvent[] | null; error: { code?: string } | null };
    if (error) throw new Error(`source_read_failed:${error.code}`);
    return data ?? [];
  };
  const sources: CsvSource[] = [
    { name: "summary.csv", rows: rows[0], chunks: accountingSummaryCsvChunks(client, job.organization_id, period,
      addLocalDays(job.period_end_exclusive, -1), job.timezone, locationId, workerPageReader, rows[0]) },
    { name: "sales.csv", rows: rows[1], chunks: accountingSalesCsvChunks(client, period, job.timezone, locationId, workerPageReader, rows[1]) },
    { name: "expenses.csv", rows: rows[2], chunks: accountantExpensesCsvChunks(client, job.organization_id, period, locationId, rows[2]) },
    { name: "daily-closes.csv", rows: rows[3], chunks: dailyCloseRegisterCsvChunks(client, job.organization_id, period, locationId, rows[3]) },
  ];
  const objectPath = accountantPackStoragePath(job);
  let uploaded = false;
  let phase: "reading" | "uploading" | "completing" = "reading";
  let directory: string | null = null;
  let leaseLost = false;
  const heartbeat = setInterval(() => {
    void admin.rpc("heartbeat_accountant_pack", { target_job_id: job.id, target_lease_token: job.lease_token })
      .then(({ data, error }) => { if (error || data !== true) leaseLost = true; });
  }, 30_000);
  try {
    const zip = await createAccountantPackZip(sources, async (files) => {
      if (leaseLost) throw new Error("worker_lease_lost");
      const { data: completedAt, error } = await admin.rpc("mark_accountant_pack_sources_read", {
        target_job_id: job.id, target_lease_token: job.lease_token,
      });
      if (error || !completedAt) throw new Error("worker_lease_lost");
      return {
        schemaVersion: 1, packageId: job.id, reportType: "accounting_support_non_fiscal",
        packSchemaVersion: job.pack_schema_version,
        organization: { id: job.organization_id, name: job.organization_name_snapshot },
        period: { start: job.period_start, endExclusive: job.period_end_exclusive, timezone: job.timezone },
        location: { scope: locationId ? "location" : "all", id: locationId, name: job.location_name_snapshot },
        sourceReadWindow: { startedAt: job.source_read_started_at, completedAt },
        sourceSemantics: { salesDateBasis: "orders.created_at", paymentsDateBasis: "payments.paid_at",
          expensesDateBasis: "expenses.expense_date", dailyCloseDateBasis: "daily_closes.business_date" },
        files, currencies: rows[0].currencies, warnings: [],
        consistency: "Source files were read during the recorded preparation window; source records may have changed during or since preparation. The completed ZIP is not modified. A new package may differ.",
        nonFiscalDisclaimer: "Accounting support material only. Not a tax filing or fiscal record.",
      };
    });
    directory = zip.directory;
    if (leaseLost) throw new Error("worker_lease_lost");
    const fileStat = await stat(zip.path);
    if (fileStat.size !== zip.sizeBytes) throw new Error("generation_failed");
    phase = "uploading";
    await uploadZip(zip.path, objectPath, zip.sizeBytes);
    uploaded = true;
    phase = "completing";
    const { data: completed, error } = await admin.rpc("complete_accountant_pack", {
      target_job_id: job.id, target_lease_token: job.lease_token,
      target_artifact_path: objectPath, target_artifact_filename: filename(job),
      target_artifact_size_bytes: zip.sizeBytes, target_artifact_sha256: zip.sha256,
      target_manifest: zip.manifest,
    });
    if (error || completed !== true) throw new Error("worker_lease_lost");
    uploaded = false;
  } catch (error) {
    if (uploaded) await admin.storage.from(BUCKET).remove([objectPath]);
    const code = error instanceof ArtifactRuntimeLimitError ? "artifact_runtime_limit_exceeded"
      : error instanceof Error && error.message === "worker_lease_lost" ? "worker_lease_lost"
        : phase === "reading" ? "source_read_failed"
          : phase === "uploading" ? "storage_upload_failed" : "generation_failed";
    await admin.rpc("fail_accountant_pack", { target_job_id: job.id, target_lease_token: job.lease_token,
      target_error_code: code, target_retryable: code !== "artifact_runtime_limit_exceeded" });
    console.error("Accountant Pack worker failed", job.id, code);
  } finally {
    clearInterval(heartbeat);
    if (directory) await rm(directory, { recursive: true, force: true });
  }
}

export async function runAccountantPackWorker(targetJobId?: string) {
  const admin = createSupabaseAdminClient();
  if (targetJobId && !isAccountantPackUuid(targetJobId)) return { processed: 0 };
  const { data, error } = await admin.rpc("claim_accountant_pack", { target_job_id: targetJobId ?? null });
  if (error) throw new Error(`accountant_pack_claim_failed:${error.code}`);
  if (!data?.id) return { processed: 0 };
  await processClaimedJob(data as Job);
  return { processed: 1 };
}

export async function cleanupAccountantPacks() {
  const admin = createSupabaseAdminClient();
  const now = new Date();
  const { data: expiring, error: expiryError } = await admin.from("accountant_pack_jobs")
    .select("id, organization_id, artifact_path").eq("status", "completed")
    .lte("expires_at", now.toISOString()).order("expires_at").limit(10);
  if (expiryError) throw new Error(`accountant_pack_cleanup_failed:${expiryError.code}`);
  let expired = 0;
  for (const job of expiring ?? []) {
    if (!job.artifact_path) continue;
    const removed = await admin.storage.from(BUCKET).remove([job.artifact_path]);
    if (removed.error && removed.error.message !== "Object not found") continue;
    const { error } = await admin.from("accountant_pack_jobs")
      .update({ status: "expired", artifact_bucket: null, artifact_path: null,
        artifact_filename: null, updated_at: new Date().toISOString() })
      .eq("id", job.id).eq("organization_id", job.organization_id).eq("status", "completed")
      .lte("expires_at", new Date().toISOString());
    if (!error) expired += 1;
  }

  // Rotate through old jobs, removing abandoned attempt objects while retaining a completed artifact.
  const checkedBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const oldEnough = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const { data: candidates, error: candidateError } = await admin.from("accountant_pack_jobs")
    .select("id, organization_id, artifact_path, status")
    .lt("requested_at", oldEnough).neq("status", "processing")
    .or(`cleanup_checked_at.is.null,cleanup_checked_at.lt.${checkedBefore}`)
    .order("cleanup_checked_at", { ascending: true, nullsFirst: true }).limit(10);
  if (candidateError) throw new Error(`accountant_pack_cleanup_failed:${candidateError.code}`);
  for (const job of candidates ?? []) {
    const prefix = `${job.organization_id}/${job.id}`;
    const objects = await admin.storage.from(BUCKET).list(prefix, { limit: 10 });
    if (objects.error) continue;
    const abandoned = (objects.data ?? []).map((object) => `${prefix}/${object.name}`)
      .filter((path) => path.endsWith(".zip") && path !== job.artifact_path);
    if (abandoned.length) {
      const removed = await admin.storage.from(BUCKET).remove(abandoned);
      if (removed.error) continue;
    }
    await admin.from("accountant_pack_jobs").update({ cleanup_checked_at: new Date().toISOString() })
      .eq("id", job.id).eq("organization_id", job.organization_id);
  }

  const terminalBefore = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  let purged = 0;
  for (const [status, column] of [["failed", "failed_at"], ["expired", "updated_at"]] as const) {
    const { data: stale } = await admin.from("accountant_pack_jobs")
      .select("id").eq("status", status).lt(column, terminalBefore)
      .gte("cleanup_checked_at", checkedBefore).order(column).limit(10);
    if (stale?.length) {
      const { error } = await admin.from("accountant_pack_jobs").delete().in("id", stale.map((job) => job.id)).eq("status", status);
      if (!error) purged += stale.length;
    }
  }
  return { expired, purged };
}
