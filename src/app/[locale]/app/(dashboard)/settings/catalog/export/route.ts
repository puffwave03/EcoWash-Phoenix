import { serializeCatalogCsv } from "@/features/catalog-productization/csv";
import { getCatalogExportData } from "@/features/catalog-productization/server/queries";

export async function GET(_request: Request, context: { params: Promise<{ locale: string }> }) {
  const { locale } = await context.params;
  const { mediaPaths, rows } = await getCatalogExportData(locale);
  return new Response(serializeCatalogCsv(rows, mediaPaths), {
    headers: {
      "Content-Disposition": 'attachment; filename="phoenix-catalog.csv"',
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
