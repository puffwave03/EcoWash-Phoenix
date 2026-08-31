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
  const rows = workspace.activity.filter((value) => value.type !== "expense").map((value) => [
    value.date,
    value.type,
    value.reference,
    value.customerName,
    value.locationName,
    value.paymentMethod,
    value.amount.toFixed(2),
    value.currency,
  ]);
  const csv = buildUtf8Csv(["date", "type", "order_reference", "customer", "location", "payment_method", "amount", "currency"], rows);
  return new Response(csv, {
    headers: {
      "Content-Disposition": `attachment; filename="accounting-sales-${selection.period.startDate}-${selection.endDate}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
