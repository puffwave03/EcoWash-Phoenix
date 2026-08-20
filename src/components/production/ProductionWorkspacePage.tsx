import { getTranslations } from "next-intl/server";
import { ProductionWorkspace } from "@/components/production/ProductionWorkspace";
import { getProductionWorkspaceData } from "@/features/production/server/queries";

export async function ProductionWorkspacePage({ locale }: { locale: string }) {
  const [data, t] = await Promise.all([
    getProductionWorkspaceData(locale),
    getTranslations({ locale, namespace: "common.production" }),
  ]);

  return (
    <ProductionWorkspace
      data={data}
      locale={locale}
      text={{
        assignedTo: t("assignedTo"),
        due: t("due"),
        empty: t("empty"),
        groups: t.raw("groups"),
        nextEmpty: t("nextEmpty"),
        nextOrder: t("nextOrder"),
        noDeadline: t("noDeadline"),
        openTask: t("openTask"),
        order: t("order"),
        priorities: t.raw("priorities"),
        priority: t("priority"),
        queueMine: t("queueMine"),
        queueTeam: t("queueTeam"),
        services: t("services"),
        statuses: t.raw("statuses"),
        subtitle: t("subtitle"),
        tasks: t("tasks"),
        title: t("title"),
        today: t("today"),
        units: t.raw("units"),
        urgencies: t.raw("urgencies"),
      }}
    />
  );
}
