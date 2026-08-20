import { getTranslations } from "next-intl/server";
import { QualityWorkspace } from "@/components/quality/QualityWorkspace";
import { getQualityWorkspaceData } from "@/features/production/server/queries";

type QualityWorkspacePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function QualityWorkspacePage({ params }: QualityWorkspacePageProps) {
  const { locale } = await params;
  const [data, t] = await Promise.all([
    getQualityWorkspaceData(locale),
    getTranslations({ locale, namespace: "common.qualityWorkspace" }),
  ]);

  return (
    <QualityWorkspace
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
