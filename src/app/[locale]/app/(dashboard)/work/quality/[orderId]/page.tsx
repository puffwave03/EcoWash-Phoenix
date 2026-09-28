import { getTranslations } from "next-intl/server";
import { ProductionDetail } from "@/components/production/ProductionDetail";
import type { ReadyWarehouseText } from "@/components/warehouse/ReadyWarehouseFields";
import { transitionOrderStatusAction } from "@/features/orders/server/actions";
import { getQualityWorkspaceTask } from "@/features/production/server/queries";
import { getReadyWarehousePlacement } from "@/features/warehouse/server/queries";

type QualityDetailPageProps = {
  params: Promise<{ locale: string; orderId: string }>;
  searchParams: Promise<{ readyError?: string; itemsError?: string }>;
};

export default async function QualityDetailPage({ params, searchParams }: QualityDetailPageProps) {
  const { locale, orderId } = await params;
  const [{ allowedTransitions, isSupervision, task, timeZone }, t, catalogT, readyT, commonT] = await Promise.all([
    getQualityWorkspaceTask(locale, orderId),
    getTranslations({ locale, namespace: "common.qualityWorkspace" }),
    getTranslations({ locale, namespace: "common.catalog" }),
    getTranslations({ locale, namespace: "common.readyWarehouse" }),
    getTranslations({ locale, namespace: "common" }),
  ]);
  const readyPlacement = allowedTransitions.includes("ready")
    ? await getReadyWarehousePlacement(locale, task.id)
    : { assignment: null, positions: [] };
  const actionLabel = task.productionStatus === "quality_check"
    ? t("detail.passToPacking")
    : t("detail.markReady");

  return (
    <ProductionDetail
      action={transitionOrderStatusAction.bind(null, locale, task.id, "quality")}
      allowedTransitions={allowedTransitions}
      backHref="/app/work/quality"
      canConfigureWarehouse={isSupervision}
      isSupervision={isSupervision}
      locale={locale}
      readyError={(await searchParams).readyError}
      itemsError={(await searchParams).itemsError}
      itemsRequiredText={commonT("orderItemsRequired")}
      readyPlacement={readyPlacement}
      readyText={readyT.raw("labels") as ReadyWarehouseText}
      task={task}
      text={{
        action: actionLabel,
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
      workflowPhases={["quality_check", "packing", "ready"]}
    />
  );
}
