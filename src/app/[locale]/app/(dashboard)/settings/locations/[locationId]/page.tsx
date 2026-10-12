import { getTranslations } from "next-intl/server";
import { LocationSettingsForm } from "@/components/location-settings/LocationSettingsForm";
import { PageHeader } from "@/components/operational/OperationalUi";
import { saveOwnerLocationAction } from "@/features/location-settings/server/actions";
import { getOwnerLocation } from "@/features/location-settings/server/queries";
import { Link } from "@/i18n/navigation";

export default async function LocationSettingsDetailPage({ params }: {
  params: Promise<{ locale: string; locationId: string }>;
}) {
  const { locale, locationId } = await params;
  const [location, t] = await Promise.all([
    getOwnerLocation(locale, locationId),
    getTranslations({ locale, namespace: "common.locationSettings" }),
  ]);
  return <div className="space-y-6">
    <PageHeader
      action={<Link className="font-semibold !text-primary hover:underline" href="/app/settings/locations" locale={locale}>← {t("backToLocations")}</Link>}
      description={t("editDescription")}
      eyebrow={t("eyebrow")}
      title={location.name}
    />
    <LocationSettingsForm
      action={saveOwnerLocationAction.bind(null, locale, locationId)}
      location={location}
      text={{
        name: t("fields.name"),
        addressLine1: t("fields.addressLine1"),
        addressLine2: t("fields.addressLine2"),
        city: t("fields.city"),
        region: t("fields.region"),
        postalCode: t("fields.postalCode"),
        countryCode: t("fields.countryCode"),
        phone: t("fields.phone"),
        save: t("save"),
        saving: t("saving"),
        saved: t("saved"),
        invalid: t("invalid"),
        unavailable: t("unavailable"),
        failure: t("failure"),
      }}
    />
  </div>;
}
