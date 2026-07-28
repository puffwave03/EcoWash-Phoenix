import { getTranslations } from "next-intl/server";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { DeactivateButton } from "@/components/customers/DeactivateButton";
import { PropertyList } from "@/components/properties/PropertyList";
import { Link } from "@/i18n/navigation";
import {
  deactivateCustomerAction,
} from "@/features/customers/server/actions";
import {
  getCustomerById,
  listPropertiesByCustomer,
} from "@/features/customers/server/queries";

type CustomerDetailPageProps = {
  params: Promise<{ customerId: string; locale: string }>;
};

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const { customerId, locale } = await params;
  const t = await getTranslations({ locale, namespace: "common.customers" });
  const [customer, properties] = await Promise.all([
    getCustomerById(locale, customerId),
    listPropertiesByCustomer(locale, customerId),
  ]);

  return (
    <div className="space-y-6">
      <Card className="space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">
              {customer.customerType === "business" ? t("types.business") : t("types.individual")}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-primary">{customer.displayName}</h2>
            <p className="mt-1 text-sm text-muted">
              {customer.isActive ? t("active") : t("inactive")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={`/app/customers/${customer.id}/edit`} locale={locale}>
              <Button variant="secondary">{t("edit")}</Button>
            </Link>
            {customer.isActive ? (
              <DeactivateButton
                action={deactivateCustomerAction.bind(null, locale, customer.id)}
                confirmLabel={t("confirmDeactivate")}
                label={t("deactivate")}
                pendingLabel={t("deactivating")}
              />
            ) : null}
          </div>
        </div>
        <dl className="grid gap-4 md:grid-cols-3">
          <div><dt className="text-sm text-muted">{t("email")}</dt><dd className="font-semibold text-primary">{customer.email || "-"}</dd></div>
          <div><dt className="text-sm text-muted">{t("phone")}</dt><dd className="font-semibold text-primary">{customer.phone || "-"}</dd></div>
          <div><dt className="text-sm text-muted">{t("taxId")}</dt><dd className="font-semibold text-primary">{customer.taxId || "-"}</dd></div>
        </dl>
        {customer.notes ? <p className="text-sm leading-6 text-muted">{customer.notes}</p> : null}
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-primary">{t("properties")}</h3>
        <Link href={`/app/customers/${customer.id}/properties/new`} locale={locale}>
          <Button>{t("newProperty")}</Button>
        </Link>
      </div>
      <PropertyList
        empty={t("propertiesEmpty")}
        locale={locale}
        properties={properties}
        view={t("view")}
      />
    </div>
  );
}
