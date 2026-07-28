import { getTranslations } from "next-intl/server";
import { Card } from "@/components/Card";
import { CustomerForm } from "@/components/customers/CustomerForm";
import { updateCustomerAction } from "@/features/customers/server/actions";
import { getCustomerById } from "@/features/customers/server/queries";

type EditCustomerPageProps = {
  params: Promise<{ customerId: string; locale: string }>;
};

export default async function EditCustomerPage({ params }: EditCustomerPageProps) {
  const { customerId, locale } = await params;
  const [customer, t] = await Promise.all([
    getCustomerById(locale, customerId),
    getTranslations({ locale, namespace: "common.customers.form" }),
  ]);

  return (
    <Card className="space-y-6">
      <h2 className="text-2xl font-semibold text-primary">{t("editTitle")}</h2>
      <CustomerForm
        action={updateCustomerAction.bind(null, locale, customerId)}
        customer={customer}
        text={{
          active: t("active"),
          alternatePhone: t("alternatePhone"),
          billingAddressLine1: t("billingAddressLine1"),
          billingAddressLine2: t("billingAddressLine2"),
          billingCity: t("billingCity"),
          billingCountryCode: t("billingCountryCode"),
          billingPostalCode: t("billingPostalCode"),
          business: t("business"),
          companyName: t("companyName"),
          customerCode: t("customerCode"),
          customerType: t("customerType"),
          displayName: t("displayName"),
          email: t("email"),
          error: t("error"),
          firstName: t("firstName"),
          inactive: t("inactive"),
          individual: t("individual"),
          lastName: t("lastName"),
          notes: t("notes"),
          phone: t("phone"),
          preferredLocale: t("preferredLocale"),
          save: t("save"),
          saving: t("saving"),
          taxId: t("taxId"),
        }}
      />
    </Card>
  );
}
