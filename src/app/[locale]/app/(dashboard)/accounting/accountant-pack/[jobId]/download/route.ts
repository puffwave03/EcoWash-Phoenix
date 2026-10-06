import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAccountantPackUuid } from "@/features/accounting/accountant-pack-validation";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string; jobId: string }> }) {
  const { locale, jobId } = await params;
  await requireOwnerOrManager(locale);
  if (!isAccountantPackUuid(jobId)) return new Response("Not found", { status: 404 });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_accountant_pack_download", { target_job_id: jobId });
  if (error || !data?.length) return new Response("Not found", { status: 404 });
  const artifact = data[0];
  const admin = createSupabaseAdminClient();
  const signed = await admin.storage.from(artifact.artifact_bucket).createSignedUrl(
    artifact.artifact_path, 90, { download: artifact.artifact_filename },
  );
  if (signed.error || !signed.data?.signedUrl) return new Response("Download unavailable", { status: 503 });
  return new Response(null, {
    status: 302,
    headers: { Location: signed.data.signedUrl, "Cache-Control": "private, no-store" },
  });
}
