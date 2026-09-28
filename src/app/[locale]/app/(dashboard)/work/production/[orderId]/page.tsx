import { getTranslations } from "next-intl/server";
import { ProductionDetail } from "@/components/production/ProductionDetail";
import type { ReadyWarehouseText } from "@/components/warehouse/ReadyWarehouseFields";
import { transitionOrderStatusAction } from "@/features/orders/server/actions";
import { getProductionWorkspaceTask } from "@/features/production/server/queries";
import { getReadyWarehousePlacement } from "@/features/warehouse/server/queries";

type ProductionDetailPageProps = {
  params: Promise<{ locale: string; orderId: string }>;
  searchParams: Promise<{ readyError?: string }>;
};

export default async function ProductionDetailPage({ params, searchParams }: ProductionDetailPageProps) {
  const { locale, orderId } = await params;
  const [{ allowedTransitions, isSupervision, task, timeZone }, t, catalogT, readyT] = await Promise.all([
    getProductionWorkspaceTask(locale, orderId),
    getTranslations({ locale, namespace: "common.production" }),
    getTranslations({ locale, namespace: "common.catalog" }),
    getTranslations({ locale, namespace: "common.readyWarehouse" }),
  ]);
  const readyPlacement = allowedTransitions.includes("ready")
    ? await getReadyWarehousePlacement(locale, task.id)
    : { assignment: null, positions: [] };

  return (
    <ProductionDetail
      action={transitionOrderStatusAction.bind(null, locale, task.id, "production")}
      allowedTransitions={allowedTransitions}
      canConfigureWarehouse={isSupervision}
      isSupervision={isSupervision}
      locale={locale}
      readyError={(await searchParams).readyError}
      readyPlacement={readyPlacement}
      readyText={readyT.raw("labels") as ReadyWarehouseText}
      task={task}
      text={{
        action: t("detail.action"),
        assignedTo: t("assignedTo"),
        back: t("detail.back"),
        blocked: t("detail.blocked"),
        currentPhase: t("detail.currentPhase"),
        customer: t("detail.customer"),
        due: t("due"),
        items: t("detail.items"),
        nextPhase: t("detail.nextPhase"),
        noActions: t("detail.noActions"),
        noDeadline: t("noDeadline"),
        noItems: t("detail.noItems"),
        noNotes: t("detail.noNotes"),
        notes: t("detail.notes"),
        openOrder: t("detail.openOrder"),
        order: t("order"),
        priorities: t.raw("priorities"),
        priority: t("priority"),
        pickupBlocked: t("pickupBlocked"),
        property: t("property"),
        reason: t("detail.reason"),
        selectPhase: t("detail.selectPhase"),
        services: t("services"),
        statuses: t.raw("statuses"),
        title: t("detail.title"),
        urgencies: t.raw("urgencies"),
        units: catalogT.raw("unitTypes") as Record<import("@/features/services/types").ServiceUnitType, string>,
        workflow: t("detail.workflow"),
      }}
      timeZone={timeZone}
    />
  );
}
