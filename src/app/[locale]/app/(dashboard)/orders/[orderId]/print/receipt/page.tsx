import { redirect } from "next/navigation";
import { requirePrintAccess } from "@/features/printing/server/access";

export default async function OrderReceiptPrintPage({ params }: {
  params: Promise<{ locale: string; orderId: string }>;
}) {
  const { locale, orderId } = await params;
  await requirePrintAccess(locale);
  // Legacy GET/refresh never issues a document. Issuance is an explicit POST.
  redirect(`/${locale}/app/orders/${encodeURIComponent(orderId)}`);
}
