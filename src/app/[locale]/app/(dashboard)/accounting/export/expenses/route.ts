import { getAccountingPeriodContext, getAccountingWorkspace } from "@/features/accounting/server/workspace-queries";
import { buildUtf8Csv, resolveAccountingPeriod } from "@/features/accounting/workspace";

export async function GET(request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const url = new URL(request.url);
  const context = await getAccountingPeriodContext(locale);
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
  const requestedLocation = url.searchParams.get("location");
  const locationId = requestedLocation && context.locations.some((value) => value.id === requestedLocation) ? requestedLocation : null;
  const workspace = await getAccountingWorkspace(locale, selection.period, locationId);
  const supplierNames = new Map(workspace.suppliers.map((value) => [value.id, value.displayName]));
  const categoryNames = new Map(workspace.categories.map((value) => [value.id, value.name]));
  const locationNames = new Map(workspace.locations.map((value) => [value.id, value.name]));
  const rows = workspace.expenses.map((value) => [
    value.expenseDate,
    value.supplierId ? supplierNames.get(value.supplierId) ?? "" : "",
    categoryNames.get(value.categoryId) ?? "",
    value.description,
    value.supplierReference,
    value.locationId ? locationNames.get(value.locationId) ?? "" : "",
    value.grossAmount.toFixed(2),
    value.taxAmount?.toFixed(2) ?? "",
    value.taxRate?.toFixed(4) ?? "",
    value.currency,
    value.status,
  ]);
  const csv = buildUtf8Csv(["expense_date", "supplier", "category", "description", "reference", "location", "gross", "tax_amount", "tax_rate", "currency", "status"], rows);
  return new Response(csv, {
    headers: {
      "Content-Disposition": `attachment; filename="accounting-expenses-${selection.period.startDate}-${selection.endDate}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
