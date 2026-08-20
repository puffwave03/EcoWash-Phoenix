import { getTranslations } from "next-intl/server";
import { PickupWorkspace } from "@/components/pickups/PickupWorkspace";
import { getPickupWorkspaceData } from "@/features/pickups/server/queries";

type PickupWorkspacePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function PickupWorkspacePage({ params }: PickupWorkspacePageProps) {
  const { locale } = await params;
  const [data, t] = await Promise.all([
    getPickupWorkspaceData(locale),
    getTranslations({ locale, namespace: "common.pickupWorkspace" }),
  ]);

  return (
    <PickupWorkspace
      data={data}
      locale={locale}
      text={{
        allCompleted: t("allCompleted"),
        assignedTo: t("assignedTo"),
        empty: t("empty"),
        inProgress: t("summary.inProgress"),
        nextEmpty: t("nextEmpty"),
        nextPickup: t("nextPickup"),
        noTime: t("noTime"),
        openPickup: t("openPickup"),
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
