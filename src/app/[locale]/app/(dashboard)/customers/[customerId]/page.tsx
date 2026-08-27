import { CustomerAccountView } from "@/components/customers/CustomerAccountView";
import { getCustomerBillingOverview } from "@/features/billing/server/queries";
import { getCustomerSegmentAssignment } from "@/features/catalog-segments/server/queries";
import { getCustomerAccountFinancials } from "@/features/customer-account/server/queries";
import { parseCustomerAccountPeriod } from "@/features/customer-account/validation";
import { getCustomerLifecycleEligibility } from "@/features/customer-lifecycle/server/queries";
import {
  getCustomerById,
  listPropertiesByCustomer,
} from "@/features/customers/server/queries";
import { createStagingCustomerPreviewPath } from "@/features/portal/server/preview";
import { getCustomerPortalAccessSummary } from "@/features/portal/server/queries";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { FEATURES } from "@/features/entitlements/feature-catalog";
import { hasEntitlement } from "@/features/entitlements/server/resolver";

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
  const billingEnabled = await hasEntitlement(locale, FEATURES.billingInvoicing);
  const period = parseCustomerAccountPeriod(rawSearchParams.period);
  const [customer, billingOverview, eligibility, financials, portalAccess, properties, segmentAssignment] = await Promise.all([
    getCustomerById(locale, customerId),
    billingEnabled ? getCustomerBillingOverview(locale, customerId) : null,
    getCustomerLifecycleEligibility(locale, customerId),
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
      billingOverview={billingOverview}
      eligibility={eligibility}
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
