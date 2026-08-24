import { getTranslations } from "next-intl/server";
import { Card } from "@/components/Card";
import { ServiceForm } from "@/components/services/ServiceForm";
import { createServiceAction } from "@/features/services/server/actions";
import { requireOwnerOrManager } from "@/lib/auth/require-role";

type NewServicePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function NewServicePage({ params }: NewServicePageProps) {
  const { locale } = await params;
  await requireOwnerOrManager(locale);
  const [t, catalogT] = await Promise.all([
    getTranslations({ locale, namespace: "common.services.form" }),
    getTranslations({ locale, namespace: "common.catalog" }),
  ]);

  return (
    <Card className="space-y-6">
      <h2 className="text-2xl font-semibold text-primary">{t("newTitle")}</h2>
      <ServiceForm
        action={createServiceAction.bind(null, locale)}
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
