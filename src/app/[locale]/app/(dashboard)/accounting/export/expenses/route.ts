import {
  accountingCsvResponse,
  accountingExpensesCsvChunks,
  getAccountingExportContext,
  InvalidAccountingExportLocationError,
} from "@/features/accounting/server/export-readers";
import { resolveAccountingPeriod } from "@/features/accounting/workspace";

export async function GET(request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const url = new URL(request.url);
  let context;
  try {
    context = await getAccountingExportContext(locale, url.searchParams.get("location"));
  } catch (error) {
    if (error instanceof InvalidAccountingExportLocationError) return new Response("Invalid accounting location", { status: 400 });
    throw error;
  }
  let selection;
  try {
    selection = resolveAccountingPeriod(
      url.searchParams.get("preset") ?? undefined,
      url.searchParams.get("start") ?? undefined,
      url.searchParams.get("end") ?? undefined,
      context.timezone,
    );
  } catch {
    return new Response("Invalid accounting period", { status: 400 });
  }
  return accountingCsvResponse(
    accountingExpensesCsvChunks(context.supabase, context.organizationId, selection.period, context.locationId),
    `accounting-expenses-${selection.period.startDate}-${selection.endDate}.csv`,
  );
}
