import { getTranslations } from "next-intl/server";
import { Card } from "@/components/Card";
import { ServiceForm } from "@/components/services/ServiceForm";
import { updateServiceAction } from "@/features/services/server/actions";
import { getServiceById } from "@/features/services/server/queries";
import { requireOwnerOrManager } from "@/lib/auth/require-role";

type EditServicePageProps = {
  params: Promise<{ locale: string; serviceId: string }>;
};

export default async function EditServicePage({ params }: EditServicePageProps) {
  const { locale, serviceId } = await params;
  await requireOwnerOrManager(locale);
  const [service, t, catalogT] = await Promise.all([
    getServiceById(locale, serviceId),
    getTranslations({ locale, namespace: "common.services.form" }),
    getTranslations({ locale, namespace: "common.catalog" }),
  ]);

  return (
    <Card className="space-y-6">
      <h2 className="text-2xl font-semibold text-primary">{t("editTitle")}</h2>
      <ServiceForm
        action={updateServiceAction.bind(null, locale, serviceId)}
        service={service}
        text={{
          amount: t("amount"),
          category: t("category"),
          code: t("code"),
          currency: t("currency"),
          description: t("description"),
          error: t("error"),
          name: t("name"),
          save: t("save"),
          saving: t("saving"),
          unitType: t("unitType"),
          validFrom: t("validFrom"),
          validTo: t("validTo"),
          unitTypes: catalogT.raw("unitTypes") as Record<import("@/features/services/types").ServiceUnitType, string>,
        }}
      />
    </Card>
  );
}
