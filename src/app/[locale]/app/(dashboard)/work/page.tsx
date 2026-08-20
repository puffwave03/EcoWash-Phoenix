import { getTranslations } from "next-intl/server";
import { MyDayDashboard } from "@/components/work/MyDayDashboard";
import { getMyDayData } from "@/features/work/server/queries";

type WorkPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function WorkPage({ params }: WorkPageProps) {
  const { locale } = await params;
  const [data, t] = await Promise.all([
    getMyDayData(locale),
    getTranslations({ locale, namespace: "common.work" }),
  ]);

  return (
    <MyDayDashboard
      data={data}
      locale={locale}
      text={{
        activityKinds: t.raw("activityKinds"),
        assignedTo: t("assignedTo"),
        emptyDescription: t("emptyDescription"),
        emptyTitle: t("emptyTitle"),
        greeting: t("greeting"),
        myActivities: t("myActivities"),
        nextActivity: t("nextActivity"),
        nextEmpty: t("nextEmpty"),
        noTime: t("noTime"),
        openDelivery: t("openDelivery"),
        openPickup: t("openPickup"),
        openProduction: t("openProduction"),
        order: t("order"),
        priorityLabels: t.raw("priorityLabels"),
        resumeActivity: t("resumeActivity"),
        teamActivities: t("teamActivities"),
        today: t("today"),
        todaySummary: t("todaySummary"),
        urgent: t("urgent"),
        viewDeliveries: t("viewDeliveries"),
        viewPickups: t("viewPickups"),
        viewProduction: t("viewProduction"),
        viewQuality: t("viewQuality"),
        workflowStatuses: t.raw("workflowStatuses"),
      }}
    />
  );
}
