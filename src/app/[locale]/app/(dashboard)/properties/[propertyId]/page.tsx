import { getTranslations } from "next-intl/server";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { DeactivateButton } from "@/components/customers/DeactivateButton";
import { Link } from "@/i18n/navigation";
import { deactivatePropertyAction } from "@/features/customers/server/actions";
import { getPropertyById } from "@/features/customers/server/queries";

type PropertyDetailPageProps = {
  params: Promise<{ locale: string; propertyId: string }>;
};

export default async function PropertyDetailPage({
  params,
}: PropertyDetailPageProps) {
  const { locale, propertyId } = await params;
  const [property, t] = await Promise.all([
    getPropertyById(locale, propertyId),
    getTranslations({ locale, namespace: "common.properties" }),
  ]);

  return (
    <Card className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">
            {property.propertyType ? t(`types.${property.propertyType}`) : t("types.other")}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-primary">{property.name}</h2>
          <p className="mt-1 text-sm text-muted">
            {property.isActive ? t("active") : t("inactive")}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={`/app/properties/${property.id}/edit`} locale={locale}>
            <Button variant="secondary">{t("edit")}</Button>
          </Link>
          {property.isActive ? (
            <DeactivateButton
              action={deactivatePropertyAction.bind(null, locale, property.id)}
              confirmLabel={t("confirmDeactivate")}
              label={t("deactivate")}
              pendingLabel={t("deactivating")}
            />
          ) : null}
        </div>
      </div>

      <dl className="grid gap-4 md:grid-cols-3">
        <div><dt className="text-sm text-muted">{t("customer")}</dt><dd className="font-semibold text-primary">{property.customerDisplayName}</dd></div>
        <div><dt className="text-sm text-muted">{t("city")}</dt><dd className="font-semibold text-primary">{property.city || "-"}</dd></div>
        <div><dt className="text-sm text-muted">{t("contactPhone")}</dt><dd className="font-semibold text-primary">{property.contactPhone || "-"}</dd></div>
      </dl>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="font-semibold text-primary">{t("address")}</h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            {[property.addressLine1, property.addressLine2, property.postalCode, property.countryCode]
              .filter(Boolean)
              .join(", ") || "-"}
          </p>
        </div>
        <div>
          <h3 className="font-semibold text-primary">{t("accessInstructions")}</h3>
          <p className="mt-2 text-sm leading-6 text-muted">{property.accessInstructions || "-"}</p>
        </div>
      </div>
      {property.notes ? <p className="text-sm leading-6 text-muted">{property.notes}</p> : null}
    </Card>
  );
}
