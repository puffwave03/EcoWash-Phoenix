import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DailyCloseDashboard } from "@/components/daily-close/DailyCloseDashboard";
import { getDailyCloseData } from "@/features/daily-close/server/queries";
import { requireMembership } from "@/lib/auth/require-membership";

type DailyClosePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function DailyClosePage({ params }: DailyClosePageProps) {
  const { locale } = await params;
  const access = await requireMembership(locale);

  if (access.membership.role === "staff") {
    redirect(`/${locale}/app/access-denied`);
  }

  const [data, t] = await Promise.all([
    getDailyCloseData(locale),
    getTranslations({ locale, namespace: "common.dailyClose" }),
  ]);

  return (
    <DailyCloseDashboard
      data={data}
      locale={locale}
      text={{
        anomalies: t.raw("anomalies"),
        description: t("description"),
        empty: t("empty"),
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
        paymentStatuses: t.raw("paymentStatuses"),
        statuses: t.raw("statuses"),
        summary: t.raw("summary"),
        title: t("title"),
      }}
    />
  );
}
