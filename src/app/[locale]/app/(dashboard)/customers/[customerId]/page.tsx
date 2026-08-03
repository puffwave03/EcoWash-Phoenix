import { getTranslations } from "next-intl/server";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { CustomerPortalAccessPanel } from "@/components/customers/CustomerPortalAccessPanel";
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
import {
  inviteCustomerPortalAction,
  manageCustomerPortalAccessAction,
} from "@/features/portal/server/actions";
import { getCustomerPortalAccessSummary } from "@/features/portal/server/queries";
import { createStagingCustomerPreviewPath } from "@/features/portal/server/preview";
import { requireMembership } from "@/lib/auth/require-membership";

type CustomerDetailPageProps = {
  params: Promise<{ customerId: string; locale: string }>;
};

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const { customerId, locale } = await params;
  const t = await getTranslations({ locale, namespace: "common.customers" });
  const [access, customer, portalAccess, properties] = await Promise.all([
    requireMembership(locale),
    getCustomerById(locale, customerId),
    getCustomerPortalAccessSummary(locale, customerId),
    listPropertiesByCustomer(locale, customerId),
  ]);
  const canManageCustomerPortal = access.membership.role === "owner" || access.membership.role === "manager";
  const previewUrl = access.membership.role === "owner"
    ? createStagingCustomerPreviewPath(locale, customer.id)
    : null;

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

      {canManageCustomerPortal ? (
        <CustomerPortalAccessPanel
          access={portalAccess}
          defaultEmail={customer.email}
          inviteAction={inviteCustomerPortalAction.bind(null, locale, customer.id)}
          locale={locale}
          manageAction={manageCustomerPortalAccessAction.bind(null, locale, customer.id)}
          previewUrl={previewUrl}
          text={{
            active: t("portal.active"),
            accessDisabled: t("portal.accessDisabled"),
            configurationError: t("portal.configurationError"),
            disable: t("portal.disable"),
            disabled: t("portal.disabled"),
            email: t("portal.email"),
            emailInvalid: t("portal.emailInvalid"),
            enable: t("portal.enable"),
            error: t("portal.error"),
            invite: t("portal.invite"),
            invitedAt: t("portal.invitedAt"),
            lastSignIn: t("portal.lastSignIn"),
            inviteError: t("portal.inviteError"),
            membershipError: t("portal.membershipError"),
            noLastSignIn: t("portal.noLastSignIn"),
            pending: t("portal.pending"),
            preview: t("portal.preview"),
            rateLimit: t("portal.rateLimit"),
            resend: t("portal.resend"),
            resetPassword: t("portal.resetPassword"),
            resetPasswordError: t("portal.resetPasswordError"),
            resetPasswordSuccess: t("portal.resetPasswordSuccess"),
            resendSuccess: t("portal.resendSuccess"),
            success: t("portal.success"),
            title: t("portal.title"),
            unauthorized: t("portal.unauthorized"),
          }}
        />
      ) : null}

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
