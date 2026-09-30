import { getTranslations } from "next-intl/server";
import { DeliveryDetail } from "@/components/deliveries/DeliveryDetail";
import { getDeliveryWorkspaceTask } from "@/features/deliveries/server/queries";
import { returnDeliveryToWarehouseAction, transitionDeliveryAction } from "@/features/logistics/server/actions";

type DeliveryDetailPageProps = {
  params: Promise<{ deliveryId: string; locale: string }>;
  searchParams: Promise<{ itemsError?: string; returnError?: string }>;
};

export default async function DeliveryDetailPage({ params, searchParams }: DeliveryDetailPageProps) {
  const { deliveryId, locale } = await params;
  const [{ isSupervision, legacyStorage, returnPositions, task, timeZone }, t, commonT] = await Promise.all([
    getDeliveryWorkspaceTask(locale, deliveryId),
    getTranslations({ locale, namespace: "common.deliveryWorkspace" }),
    getTranslations({ locale, namespace: "common" }),
  ]);

  return (
    <div className="space-y-4">
      {(await searchParams).itemsError === "1" ? (
        <p className="rounded-control border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900" role="alert">{commonT("orderItemsRequired")}</p>
      ) : null}
      {(await searchParams).returnError === "1" ? <p className="rounded-control border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900" role="alert">{t("returnError")}</p> : null}
      <DeliveryDetail
        action={transitionDeliveryAction.bind(null, locale, task.orderId, "workspace")}
        returnAction={returnDeliveryToWarehouseAction.bind(null, locale, task.orderId, "workspace")}
        returnPositions={returnPositions}
        legacyStorage={legacyStorage}
        isSupervision={isSupervision}
        locale={locale}
        task={task}
        text={{
          address: t("detail.address"),
          assignedTo: t("assignedTo"),
          back: t("detail.back"),
          cancelReason: commonT("orders.logistics.cancelledReason"),
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
          returnDelivery: t("returnDelivery"),
          returnReason: t("returnReason"),
          returnPosition: t("returnPosition"),
          noReturnPositions: t("noReturnPositions"),
          returnError: t("returnError"),
          statuses: t.raw("statuses"),
          title: t("detail.title"),
        }}
        timeZone={timeZone}
      />
    </div>
  );
}
