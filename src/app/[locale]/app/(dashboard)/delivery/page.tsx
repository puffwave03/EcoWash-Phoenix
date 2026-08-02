import { getTranslations } from "next-intl/server";
import { DeliveryQueue } from "@/components/delivery/DeliveryQueue";
import { listDeliveryQueueTasks } from "@/features/logistics/server/queries";
import { requireMembership } from "@/lib/auth/require-membership";

type DeliveryPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function DeliveryPage({ params }: DeliveryPageProps) {
  const { locale } = await params;
  const [access, tasks, t] = await Promise.all([
    requireMembership(locale),
    listDeliveryQueueTasks(locale),
    getTranslations({ locale, namespace: "common.deliveryQueue" }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-primary">{t("title")}</h2>
        <p className="mt-2 text-sm text-muted">{t("description")}</p>
      </div>

      <DeliveryQueue
        locale={locale}
        tasks={tasks}
        text={{
          address: t("address"),
          assignedTo: t("assignedTo"),
          customer: t("customer"),
          delivery: t("delivery"),
          dueSoon: t("dueSoon"),
          empty: t("empty"),
          groups: t.raw("groups"),
          late: t("late"),
          order: t("order"),
          phone: t("phone"),
          pickup: t("pickup"),
          property: t("property"),
          statuses: t.raw("statuses"),
          view: t("view"),
        }}
        timeZone={access.membership.organization.timezone}
      />
    </div>
  );
}
