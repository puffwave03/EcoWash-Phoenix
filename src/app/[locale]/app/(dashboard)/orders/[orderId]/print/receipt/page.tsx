import { notFound, redirect } from "next/navigation";
import { requirePrintAccess } from "@/features/printing/server/access";

export default async function OrderReceiptPrintPage({ params, searchParams }: {
  params: Promise<{ locale: string; orderId: string }>;
  searchParams?: Promise<{ document?: string | string[] }>;
}) {
  const { locale, orderId } = await params;
  const query = await searchParams;
  // Explicit future fiscal entry only. The existing operational receipt route
  // remains non-fiscal. Never issue an operational receipt as a fiscal fallback.
  if (query?.document !== undefined) {
    if (query.document !== "fiscal") notFound();
    const { getBillingOrderEntry } = await import("@/features/billing/server/order-entry");
    const entry = await getBillingOrderEntry(locale, orderId);
    if (entry.kind === "issued") redirect(`/${locale}${entry.href}/print`);
    if (entry.kind === "draft") redirect(`/${locale}${entry.href}`);
    // No fiscal record exists or the order is not eligible. The canonical page
    // enforces eligibility/recipient rules and shows the disabled-type message.
    redirect(`/${locale}/app/billing/new?orderId=${encodeURIComponent(orderId)}&error=simplifiedUnavailable`);
  }
  // Legacy operational URL: opening or refreshing must never issue a REC.
  await requirePrintAccess(locale);
  redirect(`/${locale}/app/orders/${encodeURIComponent(orderId)}`);
}
