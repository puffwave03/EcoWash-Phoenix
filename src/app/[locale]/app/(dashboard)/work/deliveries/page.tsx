import { getTranslations } from "next-intl/server";
import { DeliveryWorkspace } from "@/components/deliveries/DeliveryWorkspace";
import { getDeliveryWorkspaceData } from "@/features/deliveries/server/queries";

type DeliveryWorkspacePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function DeliveryWorkspacePage({ params }: DeliveryWorkspacePageProps) {
  const { locale } = await params;
  const [data, t] = await Promise.all([
    getDeliveryWorkspaceData(locale),
    getTranslations({ locale, namespace: "common.deliveryWorkspace" }),
  ]);

  return (
    <DeliveryWorkspace
      data={data}
      locale={locale}
      text={{
        assignedTo: t("assignedTo"),
        empty: t("empty"),
        inProgress: t("summary.inProgress"),
        nextDelivery: t("nextDelivery"),
        nextEmpty: t("nextEmpty"),
        noTime: t("noTime"),
        openDelivery: t("openDelivery"),
        order: t("order"),
        overdue: t("summary.overdue"),
        priorities: t.raw("priorities"),
        queue: t("queue"),
        queueMine: t("queueMine"),
        queueTeam: t("queueTeam"),
        status: t("status"),
        statuses: t.raw("statuses"),
        subtitle: t("subtitle"),
        tasks: t("tasks"),
        title: t("title"),
        today: t("today"),
        toDo: t("summary.toDo"),
      }}
    />
  );
}
