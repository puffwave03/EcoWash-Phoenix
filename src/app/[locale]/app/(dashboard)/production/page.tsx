import { getTranslations } from "next-intl/server";
import { ProductionQueue } from "@/components/production/ProductionQueue";
import { listProductionQueueOrders } from "@/features/orders/server/queries";
import { requireMembership } from "@/lib/auth/require-membership";

type ProductionPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function ProductionPage({ params }: ProductionPageProps) {
  const { locale } = await params;
  const [access, orders, t] = await Promise.all([
    requireMembership(locale),
    listProductionQueueOrders(locale),
    getTranslations({ locale, namespace: "common.production" }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-primary">{t("title")}</h2>
        <p className="mt-2 text-sm text-muted">{t("description")}</p>
      </div>

      <ProductionQueue
        currentProfileId={access.profile.id}
        locale={locale}
        orders={orders}
        text={{
          assignedTo: t("assignedTo"),
          due: t("due"),
          empty: t("empty"),
          filters: t.raw("filters"),
          groups: t.raw("groups"),
          order: t("order"),
          priorities: t.raw("priorities"),
          priority: t("priority"),
          property: t("property"),
          statuses: t.raw("statuses"),
          view: t("view"),
        }}
      />
    </div>
  );
}
