import { getTranslations } from "next-intl/server";
import { OperationsControlCenter } from "@/components/control/OperationsControlCenter";
import { getControlCenterData } from "@/features/control/server/queries";

type ControlCenterPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function ControlCenterPage({ params }: ControlCenterPageProps) {
  const { locale } = await params;
  const [data, t, dashboardT] = await Promise.all([
    getControlCenterData(locale),
    getTranslations({ locale, namespace: "common.controlCenter" }),
    getTranslations({ locale, namespace: "common.dashboard.statuses" }),
  ]);

  return (
    <OperationsControlCenter
      data={data}
      locale={locale}
      text={{
        active: t("workload.active"),
        assignedTo: t("assignedTo"),
        description: t("description"),
        exceptionTypes: t.raw("exceptionTypes"),
        exceptionsDescription: t("exceptions.description"),
        exceptionsEmpty: t("exceptions.empty"),
        exceptionsTitle: t("exceptions.title"),
        highestLoad: t("workload.highestLoad"),
        inProgress: t("workload.inProgress"),
        kinds: t.raw("kinds"),
        links: t.raw("links"),
        noTime: t("noTime"),
        open: t("open"),
        order: t("order"),
        overdue: t("workload.overdue"),
        priorities: t.raw("priorities"),
        quickLinksDescription: t("quickLinks.description"),
        quickLinksTitle: t("quickLinks.title"),
        statuses: {
          ...dashboardT.raw("production"),
          ...dashboardT.raw("fulfillment"),
        },
        summary: t.raw("summary.labels"),
        summaryTitle: t("summary.title"),
        title: t("title"),
        today: t("today"),
        unknownAssignee: t("workload.unknownAssignee"),
        upcomingDescription: t("upcoming.description"),
        upcomingEmpty: t("upcoming.empty"),
        upcomingTitle: t("upcoming.title"),
        workloadDescription: t("workload.description"),
        workloadEmpty: t("workload.empty"),
        workloadTitle: t("workload.title"),
      }}
    />
  );
}
