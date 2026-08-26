import { CustomerAccountView } from "@/components/customers/CustomerAccountView";
import { getCustomerSegmentAssignment } from "@/features/catalog-segments/server/queries";
import { getCustomerAccountFinancials } from "@/features/customer-account/server/queries";
import { parseCustomerAccountPeriod } from "@/features/customer-account/validation";
import {
  getCustomerById,
  listPropertiesByCustomer,
} from "@/features/customers/server/queries";
import { createStagingCustomerPreviewPath } from "@/features/portal/server/preview";
import { getCustomerPortalAccessSummary } from "@/features/portal/server/queries";
import { requireOwnerOrManager } from "@/lib/auth/require-role";

type CustomerDetailPageProps = {
  params: Promise<{ customerId: string; locale: string }>;
  searchParams: Promise<{ period?: string }>;
};

export default async function CustomerDetailPage({
  params,
  searchParams,
}: CustomerDetailPageProps) {
  const [{ customerId, locale }, rawSearchParams] = await Promise.all([params, searchParams]);
  const access = await requireOwnerOrManager(locale);
  const period = parseCustomerAccountPeriod(rawSearchParams.period);
  const [customer, financials, portalAccess, properties, segmentAssignment] = await Promise.all([
    getCustomerById(locale, customerId),
    getCustomerAccountFinancials(locale, customerId, period),
    getCustomerPortalAccessSummary(locale, customerId),
    listPropertiesByCustomer(locale, customerId),
    getCustomerSegmentAssignment(locale, customerId),
  ]);
  const previewUrl = access.membership.role === "owner"
    ? createStagingCustomerPreviewPath(locale, customer.id)
    : null;

  return (
    <CustomerAccountView
      customer={customer}
      financials={financials}
      locale={locale}
      period={period}
      portalAccess={portalAccess}
      previewUrl={previewUrl}
      properties={properties}
      segmentAssignment={segmentAssignment}
    />
  );
}
