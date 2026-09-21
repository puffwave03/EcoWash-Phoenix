import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/operational/OperationalUi";
import {
  WarehousePositionManagement,
  type WarehousePositionText,
} from "@/components/warehouse/WarehousePositionManagement";
import {
  saveWarehousePositionAction,
  setWarehousePositionActiveAction,
} from "@/features/warehouse/server/actions";
import {
  listWarehouseLocations,
  listWarehousePositions,
} from "@/features/warehouse/server/queries";
import { Link } from "@/i18n/navigation";
import { requireOwnerOrManager } from "@/lib/auth/require-role";

export default async function WarehouseSettingsPage({ params }: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireOwnerOrManager(locale);
  const [locations, positions, t] = await Promise.all([
    listWarehouseLocations(locale),
    listWarehousePositions(locale),
    getTranslations({ locale, namespace: "common.warehousePositions" }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        action={<Link className="inline-flex min-h-11 items-center font-semibold !text-primary hover:underline" href="/app/settings" locale={locale}>← {t("back")}</Link>}
        description={t("description")}
        eyebrow={t("eyebrow")}
        title={t("title")}
      />
      <WarehousePositionManagement
        activeAction={setWarehousePositionActiveAction.bind(null, locale)}
        locations={locations}
        positions={positions}
        saveAction={saveWarehousePositionAction.bind(null, locale)}
        text={t.raw("labels") as WarehousePositionText}
      />
    </div>
  );
}
