import {
  accountingCsvResponse,
  accountingSalesCsvChunks,
} from "@/features/accounting/server/export-readers";
import { accountingExportRequest } from "@/features/accounting/server/export-request";

export async function GET(request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const resolved = await accountingExportRequest(request, locale);
  if (resolved instanceof Response) return resolved;
  const { context, selection } = resolved;
  return accountingCsvResponse(
    accountingSalesCsvChunks(context.supabase, selection.period, context.timezone, context.locationId),
    `accounting-sales-${selection.period.startDate}-${selection.endDate}.csv`,
  );
}
