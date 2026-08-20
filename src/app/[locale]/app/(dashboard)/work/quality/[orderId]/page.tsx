import { getTranslations } from "next-intl/server";
import { ProductionDetail } from "@/components/production/ProductionDetail";
import { transitionOrderStatusAction } from "@/features/orders/server/actions";
import { getQualityWorkspaceTask } from "@/features/production/server/queries";

type QualityDetailPageProps = {
  params: Promise<{ locale: string; orderId: string }>;
};

export default async function QualityDetailPage({ params }: QualityDetailPageProps) {
  const { locale, orderId } = await params;
  const [{ allowedTransitions, isSupervision, task, timeZone }, t] = await Promise.all([
    getQualityWorkspaceTask(locale, orderId),
    getTranslations({ locale, namespace: "common.qualityWorkspace" }),
  ]);
  const actionLabel = task.productionStatus === "quality_check"
    ? t("detail.passToPacking")
    : t("detail.markReady");

  return (
    <ProductionDetail
      action={transitionOrderStatusAction.bind(null, locale, task.id)}
      allowedTransitions={allowedTransitions}
      backHref="/app/work/quality"
      isSupervision={isSupervision}
      locale={locale}
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
        piece: t("units.piece"),
        priorities: t.raw("priorities"),
        priority: t("priority"),
        property: t("property"),
        reason: t("detail.reason"),
        selectPhase: t("detail.selectPhase"),
        services: t("services"),
        statuses: t.raw("statuses"),
        title: t("detail.title"),
        urgencies: t.raw("urgencies"),
        weight: t("units.weight"),
        workflow: t("detail.workflow"),
      }}
      timeZone={timeZone}
      workflowPhases={["quality_check", "packing", "ready"]}
    />
  );
}
