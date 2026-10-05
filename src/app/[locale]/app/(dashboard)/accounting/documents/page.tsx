import { Link } from "@/i18n/navigation";
import { salesDocumentHistoryHref } from "@/features/sales-documents/pagination";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/operational/OperationalUi";
import { SalesDocumentsRegistry, type SalesDocumentsText } from "@/components/sales-documents/SalesDocumentsRegistry";
import { cancelOperationalReceiptAction } from "@/features/sales-documents/server/actions";
import { listSalesDocuments } from "@/features/sales-documents/server/queries";

export default async function SalesDocumentsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ cursor?: string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const [history, t] = await Promise.all([
    listSalesDocuments(locale, query.cursor),
    getTranslations({ locale, namespace: "common.salesDocuments" }),
  ]);
  return <div className="space-y-6">
    <PageHeader description={t("description")} eyebrow={t("eyebrow")} title={t("title")} />
    <SalesDocumentsRegistry cancelReceipt={cancelOperationalReceiptAction.bind(null, locale)} documents={history.items} locale={locale} text={t.raw("registry") as SalesDocumentsText} />
    <nav aria-label={t("pagination.label")} className="flex flex-wrap gap-3">
      {history.newerCursor ? <Link className="inline-flex min-h-11 items-center rounded-control border border-border px-4 text-sm font-semibold" href={salesDocumentHistoryHref(history.newerCursor)} locale={locale}>{t("pagination.newer")}</Link> : null}
      {history.olderCursor ? <Link className="inline-flex min-h-11 items-center rounded-control border border-border px-4 text-sm font-semibold" href={salesDocumentHistoryHref(history.olderCursor)} locale={locale}>{t("pagination.older")}</Link> : null}
      {query.cursor ? <Link className="inline-flex min-h-11 items-center px-4 text-sm font-semibold underline" href={salesDocumentHistoryHref()} locale={locale}>{t("pagination.latest")}</Link> : null}
    </nav>
  </div>;
}
