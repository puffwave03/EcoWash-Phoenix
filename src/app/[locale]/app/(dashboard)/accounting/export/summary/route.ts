import { accountingSummaryCsvChunks } from "@/features/accounting/server/accountant-support";
import { accountingCsvResponse } from "@/features/accounting/server/export-readers";
import { accountingExportRequest } from "@/features/accounting/server/export-request";
import { accountingExportPeriodLabel } from "@/features/accounting/workspace";

export async function GET(request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const resolved = await accountingExportRequest(request, locale);
  if (resolved instanceof Response) return resolved;
  const { context, selection } = resolved;
  return accountingCsvResponse(
    accountingSummaryCsvChunks(context.supabase, context.organizationId, selection.period, selection.endDate, context.timezone, context.locationId),
    `accounting-summary-${accountingExportPeriodLabel(selection)}.csv`,
  );
}
