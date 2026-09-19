import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DailyCloseDashboard } from "@/components/daily-close/DailyCloseDashboard";
import { requestDailyCloseAction } from "@/features/daily-close/server/actions";
import { getPersistedDailyClose } from "@/features/daily-close/server/persisted-queries";
import { getDailyCloseData } from "@/features/daily-close/server/queries";
import { requireMembership } from "@/lib/auth/require-membership";

type DailyClosePageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string; location?: string }>;
};

export default async function DailyClosePage({ params, searchParams }: DailyClosePageProps) {
  const { locale } = await params;
  const { date, location } = await searchParams;
  const access = await requireMembership(locale);

  if (access.membership.role === "staff") {
    redirect(`/${locale}/app/access-denied`);
  }

  const [data, t] = await Promise.all([
    getDailyCloseData(locale, { businessDate: date, locationId: location }),
    getTranslations({ locale, namespace: "common.dailyClose" }),
  ]);
  const persistedClose = await getPersistedDailyClose(locale, {
    businessDate: data.businessDate,
    locationId: data.selectedLocationId,
  });

  return (
    <DailyCloseDashboard
      closeAction={requestDailyCloseAction.bind(null, locale)}
      data={data}
      locale={locale}
      persistedClose={persistedClose}
      text={{
        anomalies: t.raw("anomalies"),
        blockers: t.raw("blockers"),
        description: t("description"),
        definitive: {
          ...t.raw("definitive"),
          metrics: t.raw("metrics"),
          sourceLabels: t.raw("sourceLabels"),
        },
        empty: t("empty"),
        filter: t.raw("filter"),
        groups: t.raw("groups"),
        labels: {
          assignedTo: t("labels.assignedTo"),
          customer: t("labels.customer"),
          missingAmount: t("labels.missingAmount"),
          order: t("labels.order"),
          property: t("labels.property"),
          status: t("labels.status"),
          time: t("labels.time"),
          view: t("labels.view"),
        },
        metrics: t.raw("metrics"),
        nonFiscal: t("nonFiscal"),
        paymentStatuses: t.raw("paymentStatuses"),
        previewLabel: t("previewLabel"),
        semantics: t.raw("semantics"),
        sections: t.raw("sections"),
        sourceLabels: t.raw("sourceLabels"),
        statuses: t.raw("statuses"),
        title: t("title"),
        unavailable: t("unavailable"),
      }}
    />
  );
}
