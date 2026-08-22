import { getTranslations } from "next-intl/server";
import { ProductionDetail } from "@/components/production/ProductionDetail";
import { transitionOrderStatusAction } from "@/features/orders/server/actions";
import { getProductionWorkspaceTask } from "@/features/production/server/queries";

type ProductionDetailPageProps = {
  params: Promise<{ locale: string; orderId: string }>;
};

export default async function ProductionDetailPage({ params }: ProductionDetailPageProps) {
  const { locale, orderId } = await params;
  const [{ allowedTransitions, isSupervision, task, timeZone }, t] = await Promise.all([
    getProductionWorkspaceTask(locale, orderId),
    getTranslations({ locale, namespace: "common.production" }),
  ]);

  return (
    <ProductionDetail
      action={transitionOrderStatusAction.bind(null, locale, task.id, "production")}
      allowedTransitions={allowedTransitions}
      isSupervision={isSupervision}
      locale={locale}
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
    />
  );
}
