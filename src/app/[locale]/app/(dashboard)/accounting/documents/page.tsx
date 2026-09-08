import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/operational/OperationalUi";
import { SalesDocumentsRegistry, type SalesDocumentsText } from "@/components/sales-documents/SalesDocumentsRegistry";
import { cancelOperationalReceiptAction } from "@/features/sales-documents/server/actions";
import { listSalesDocuments } from "@/features/sales-documents/server/queries";

export default async function SalesDocumentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [documents, t] = await Promise.all([
    listSalesDocuments(locale),
    getTranslations({ locale, namespace: "common.salesDocuments" }),
  ]);
  return <div className="space-y-6">
    <PageHeader description={t("description")} eyebrow={t("eyebrow")} title={t("title")} />
    <SalesDocumentsRegistry cancelReceipt={cancelOperationalReceiptAction.bind(null, locale)} documents={documents} locale={locale} text={t.raw("registry") as SalesDocumentsText} />
  </div>;
}
