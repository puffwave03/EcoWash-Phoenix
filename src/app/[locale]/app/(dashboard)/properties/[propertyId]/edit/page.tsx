import { getTranslations } from "next-intl/server";
import { Card } from "@/components/Card";
import { PropertyForm } from "@/components/properties/PropertyForm";
import { updatePropertyAction } from "@/features/customers/server/actions";
import { getPropertyById } from "@/features/customers/server/queries";

type EditPropertyPageProps = {
  params: Promise<{ locale: string; propertyId: string }>;
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

export default async function EditPropertyPage({ params }: EditPropertyPageProps) {
  const { locale, propertyId } = await params;
  const [property, t] = await Promise.all([
    getPropertyById(locale, propertyId),
    getTranslations({ locale, namespace: "common.properties.form" }),
  ]);

  return (
    <Card className="space-y-6">
      <h2 className="text-2xl font-semibold text-primary">{t("editTitle")}</h2>
      <PropertyForm
        action={updatePropertyAction.bind(null, locale, propertyId)}
        customerId={property.customerId}
        property={property}
        text={formText(t)}
      />
    </Card>
  );
}
