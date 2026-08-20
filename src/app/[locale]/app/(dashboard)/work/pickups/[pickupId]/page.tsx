import { getTranslations } from "next-intl/server";
import { PickupDetail } from "@/components/pickups/PickupDetail";
import { transitionPickupAction } from "@/features/logistics/server/actions";
import { getPickupWorkspaceTask } from "@/features/pickups/server/queries";

type PickupDetailPageProps = {
  params: Promise<{ locale: string; pickupId: string }>;
};

export default async function PickupDetailPage({ params }: PickupDetailPageProps) {
  const { locale, pickupId } = await params;
  const [{ isSupervision, task, timeZone }, t] = await Promise.all([
    getPickupWorkspaceTask(locale, pickupId),
    getTranslations({ locale, namespace: "common.pickupWorkspace" }),
  ]);

  return (
    <PickupDetail
      action={transitionPickupAction.bind(null, locale, task.orderId)}
      isSupervision={isSupervision}
      locale={locale}
      task={task}
      text={{
        address: t("detail.address"),
        assignedTo: t("assignedTo"),
        back: t("detail.back"),
        complete: t("actions.complete"),
        contact: t("detail.contact"),
        customer: t("detail.customer"),
        details: t("detail.details"),
        noNotes: t("detail.noNotes"),
        noTime: t("noTime"),
        notes: t("detail.notes"),
        openOrder: t("detail.openOrder"),
        order: t("order"),
        phone: t("detail.phone"),
        property: t("detail.property"),
        scheduledAt: t("detail.scheduledAt"),
        start: t("actions.start"),
        statuses: t.raw("statuses"),
        title: t("detail.title"),
      }}
      timeZone={timeZone}
    />
  );
}
