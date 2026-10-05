import "server-only";

import {
  getAccountingExportContext,
  InvalidAccountingExportLocationError,
} from "@/features/accounting/server/export-readers";
import { resolveAccountingPeriod } from "@/features/accounting/workspace";

export async function accountingExportRequest(request: Request, locale: string) {
  const url = new URL(request.url);
  let context;
  try {
    context = await getAccountingExportContext(locale, url.searchParams.get("location"));
  } catch (error) {
    if (error instanceof InvalidAccountingExportLocationError) {
      return new Response("Invalid accounting location", { status: 400 });
    }
    throw error;
  }
  try {
    const selection = resolveAccountingPeriod(
      url.searchParams.get("preset") ?? undefined,
      url.searchParams.get("start") ?? undefined,
      url.searchParams.get("end") ?? undefined,
      context.timezone,
      undefined,
      { quarter: url.searchParams.get("quarter") ?? undefined, year: url.searchParams.get("year") ?? undefined },
    );
    return { context, selection };
  } catch {
    return new Response("Invalid accounting period", { status: 400 });
  }
}
