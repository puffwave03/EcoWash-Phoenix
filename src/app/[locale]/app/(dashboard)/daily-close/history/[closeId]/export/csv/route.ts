import { buildDailyCloseExportRows, serializeDailyCloseCsv } from "@/features/daily-close/export";
import { getPersistedDailyCloseById } from "@/features/daily-close/server/persisted-queries";

export async function GET(_request: Request, { params }: {
  params: Promise<{ closeId: string; locale: string }>;
}) {
  const { closeId, locale } = await params;
  const close = await getPersistedDailyCloseById(locale, closeId);
  if (!close) return new Response("Not found", { status: 404 });

  const rows = buildDailyCloseExportRows(close, close.locationName ?? "organization_wide");
  const csv = serializeDailyCloseCsv(rows);
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="daily-close-${close.businessDate}-${close.id}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
