import { cleanupAccountantPacks, runAccountantPackWorker } from "@/features/accounting/server/accountant-pack-worker";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const cleanup = await cleanupAccountantPacks();
    const work = await runAccountantPackWorker();
    return Response.json({ cleanup, work }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Accountant Pack recovery failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "worker_failed" }, { status: 503 });
  }
}
