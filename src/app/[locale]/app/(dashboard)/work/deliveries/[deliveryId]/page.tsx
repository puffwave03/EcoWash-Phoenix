import { getTranslations } from "next-intl/server";
import { DeliveryDetail } from "@/components/deliveries/DeliveryDetail";
import { getDeliveryWorkspaceTask } from "@/features/deliveries/server/queries";
import { transitionDeliveryAction } from "@/features/logistics/server/actions";

type DeliveryDetailPageProps = {
  params: Promise<{ deliveryId: string; locale: string }>;
};

export default async function DeliveryDetailPage({ params }: DeliveryDetailPageProps) {
  const { deliveryId, locale } = await params;
  const [{ isSupervision, task, timeZone }, t] = await Promise.all([
    getDeliveryWorkspaceTask(locale, deliveryId),
    getTranslations({ locale, namespace: "common.deliveryWorkspace" }),
  ]);

  return (
    <DeliveryDetail
      action={transitionDeliveryAction.bind(null, locale, task.orderId, "workspace")}
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
