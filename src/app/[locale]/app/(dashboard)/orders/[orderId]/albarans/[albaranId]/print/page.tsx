import { notFound } from "next/navigation";
import { ServiceAlbaranDocument } from "@/components/service-albarans/ServiceAlbaranDocument";
import { getServiceAlbaran } from "@/features/service-albarans/server/queries";

export default async function ServiceAlbaranPrintPage({ params }: {
  params: Promise<{ locale: string; orderId: string; albaranId: string }>;
}) {
  const { locale, orderId, albaranId } = await params;
  const albaran = await getServiceAlbaran(locale, albaranId);
  if (albaran.order_id !== orderId) notFound();
  return <ServiceAlbaranDocument albaran={albaran} locale={locale} />;
}
