import { getTranslations } from "next-intl/server";
import { Card } from "@/components/Card";
import { PropertyForm } from "@/components/properties/PropertyForm";
import { createPropertyAction } from "@/features/customers/server/actions";
import { getCustomerById } from "@/features/customers/server/queries";

type NewPropertyPageProps = {
  params: Promise<{ customerId: string; locale: string }>;
};

function formText(t: Awaited<ReturnType<typeof getTranslations>>) {
  return {
    accessInstructions: t("accessInstructions"),
    active: t("active"),
    addressLine1: t("addressLine1"),
    addressLine2: t("addressLine2"),
    apartment: t("types.apartment"),
    business: t("types.business"),
    city: t("city"),
    contactName: t("contactName"),
    contactPhone: t("contactPhone"),
    countryCode: t("countryCode"),
    error: t("error"),
    holidayHome: t("types.holiday_home"),
    hotel: t("types.hotel"),
    inactive: t("inactive"),
    name: t("name"),
    notes: t("notes"),
    other: t("types.other"),
    postalCode: t("postalCode"),
    propertyCode: t("propertyCode"),
    propertyType: t("propertyType"),
    save: t("save"),
    saving: t("saving"),
  };
}

export default async function NewPropertyPage({ params }: NewPropertyPageProps) {
  const { customerId, locale } = await params;
  const [customer, t] = await Promise.all([
    getCustomerById(locale, customerId),
    getTranslations({ locale, namespace: "common.properties.form" }),
  ]);

  return (
    <Card className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-primary">{t("newTitle")}</h2>
        <p className="mt-2 text-sm text-muted">{customer.displayName}</p>
      </div>
      <PropertyForm
        action={createPropertyAction.bind(null, locale, customerId)}
        customerId={customerId}
        text={formText(t)}
      />
    </Card>
  );
}
