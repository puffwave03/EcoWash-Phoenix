import { getTranslations } from "next-intl/server";
import { OperationalAlertsPanel } from "@/components/alerts/OperationalAlertsPanel";
import { getOperationalAlerts } from "@/features/alerts/server/queries";

type AlertsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AlertsPage({ params }: AlertsPageProps) {
  const { locale } = await params;
  const [data, t] = await Promise.all([
    getOperationalAlerts(locale),
    getTranslations({ locale, namespace: "common.alerts" }),
  ]);

  return (
    <OperationalAlertsPanel
      data={data}
      locale={locale}
      text={{
        description: t("description"),
        empty: t("empty"),
        labels: t.raw("labels"),
        paymentStatuses: t.raw("paymentStatuses"),
        sections: t.raw("sections"),
        severities: t.raw("severities"),
        statuses: t.raw("statuses"),
        summary: t.raw("summary"),
        title: t("title"),
        types: t.raw("types"),
      }}
    />
  );
}
