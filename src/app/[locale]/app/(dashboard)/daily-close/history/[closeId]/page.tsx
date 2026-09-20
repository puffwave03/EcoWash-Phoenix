import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PersistedSummary } from "@/components/daily-close/DailyCloseWorkflow";
import { PageHeader } from "@/components/operational/OperationalUi";
import { getPersistedDailyCloseById } from "@/features/daily-close/server/persisted-queries";
import { Link } from "@/i18n/navigation";

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
        action={<Link className="inline-flex min-h-11 w-full items-center justify-center rounded-control border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary hover:text-white sm:w-auto" href="/app/daily-close/history" locale={locale}>{t("history.backToHistory")}</Link>}
        description={t("history.detailDescription")}
        title={t("history.detailTitle")}
      />
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
    </div>
  );
}
