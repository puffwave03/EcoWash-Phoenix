import { getTranslations } from "next-intl/server";
import { OperationalDashboard } from "@/components/dashboard/OperationalDashboard";
import { getDashboardOverview } from "@/features/dashboard/server/queries";

type DashboardPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { locale } = await params;
  const [data, t] = await Promise.all([
    getDashboardOverview(locale),
    getTranslations({ locale, namespace: "common.dashboard" }),
  ]);

  return (
    <OperationalDashboard
      data={data}
      locale={locale}
      text={{
        activity: {
          actorFallback: t("activity.actorFallback"),
          empty: t("activity.empty"),
          events: t.raw("activity.events"),
          title: t("activity.title"),
        },
        balances: {
          balanceDue: t("balances.balanceDue"),
          empty: t("balances.empty"),
          paymentStatus: t("balances.paymentStatus"),
          title: t("balances.title"),
          total: t("balances.total"),
          totalPaid: t("balances.totalPaid"),
        },
        labels: {
          assigned: t("labels.assigned"),
          customer: t("labels.customer"),
          due: t("labels.due"),
          late: t("labels.late"),
          order: t("labels.order"),
          priority: t("labels.priority"),
          property: t("labels.property"),
          status: t("labels.status"),
          view: t("labels.view"),
        },
        logistics: {
          attention: t("logistics.attention"),
          delivery: t("logistics.delivery"),
          empty: t("logistics.empty"),
          pickup: t("logistics.pickup"),
          todayDeliveries: t("logistics.todayDeliveries"),
          todayPickups: t("logistics.todayPickups"),
        },
        onHold: {
          empty: t("onHold.empty"),
          holdAt: t("onHold.holdAt"),
          reason: t("onHold.reason"),
          title: t("onHold.title"),
        },
        payments: {
          partiallyPaid: t("payments.partiallyPaid"),
          paymentsToday: t("payments.paymentsToday"),
          recentCorrections: t("payments.recentCorrections"),
          title: t("payments.title"),
          unpaid: t("payments.unpaid"),
        },
        production: {
          empty: t("production.empty"),
          readyAt: t("production.readyAt"),
          readyTitle: t("production.readyTitle"),
          title: t("production.title"),
        },
        statuses: {
          fulfillment: t.raw("statuses.fulfillment"),
          payment: t.raw("statuses.payment"),
          production: t.raw("statuses.production"),
        },
        summary: {
          balanceDue: t("summary.balanceDue"),
          express: t("summary.express"),
          late: t("summary.late"),
          onHold: t("summary.onHold"),
          open: t("summary.open"),
          ready: t("summary.ready"),
          title: t("summary.title"),
        },
      }}
    />
  );
}
