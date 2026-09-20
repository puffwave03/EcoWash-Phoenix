import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DailyCloseExportActions } from "@/components/daily-close/DailyCloseExportActions";
import { PersistedSummary } from "@/components/daily-close/DailyCloseWorkflow";
import { PageHeader } from "@/components/operational/OperationalUi";
import { getPersistedDailyCloseById } from "@/features/daily-close/server/persisted-queries";

export default async function DailyCloseHistoryDetailPage({ params }: {
  params: Promise<{ closeId: string; locale: string }>;
}) {
  const { closeId, locale } = await params;
  const [close, t] = await Promise.all([
    getPersistedDailyCloseById(locale, closeId),
    getTranslations({ locale, namespace: "common.dailyClose" }),
  ]);
  if (!close) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        action={<DailyCloseExportActions closeId={close.id} locale={locale} text={{ back: t("history.backToHistory"), csv: t("export.csv"), pdf: t("export.pdf"), print: t("export.print") }} />}
        description={t("history.detailDescription")}
        title={t("history.detailTitle")}
      />
      <article className="daily-close-print-document">
        <div className="mb-6 hidden print:block">
          <h1 className="text-3xl font-semibold text-primary">{t("export.reportTitle")}</h1>
          <p className="mt-2 text-sm font-semibold text-muted">{t("export.nonFiscal")}</p>
        </div>
        <PersistedSummary
          close={close}
          locale={locale}
          scopeLabel={close.locationName ?? t("history.organizationWide")}
          text={{
            ...t.raw("definitive"),
            metrics: t.raw("metrics"),
            sourceLabels: t.raw("sourceLabels"),
          }}
        />
      </article>
    </div>
  );
}
