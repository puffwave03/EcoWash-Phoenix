import { randomUUID } from "node:crypto";
import { getTranslations } from "next-intl/server";
import { PlatformTenantOnboardingForm } from "@/components/platform/PlatformTenantOnboardingForm";
import { bootstrapTenantAction } from "@/features/platform-admin/server/tenant-onboarding";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { Link } from "@/i18n/navigation";

export default async function NewPlatformOrganizationPage({ params }: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requirePlatformAdmin(locale);
  const t = await getTranslations({ locale, namespace: "common.platform.onboarding" });
  const text = {
    title: t("title"), description: t("description"), back: t("back"),
    fields: {
      name: t("fields.name"), slug: t("fields.slug"), currency: t("fields.currency"),
      timezone: t("fields.timezone"), locale: t("fields.locale"), country: t("fields.country"),
      location: t("fields.location"), ownerEmail: t("fields.ownerEmail"), ownerId: t("fields.ownerId"),
    },
    helpers: { slug: t("helpers.slug"), defaults: t("helpers.defaults"), owner: t("helpers.owner"), recovery: t("helpers.recovery") },
    modes: { invite: t("modes.invite"), existing: t("modes.existing") },
    placeholders: { currency: t("placeholders.currency"), timezone: t("placeholders.timezone"), country: t("placeholders.country") },
    actions: { submit: t("actions.submit"), pending: t("actions.pending"), useRecovery: t("actions.useRecovery"), detail: t("actions.detail") },
    results: {
      success: t("results.success"), failed: t("results.failed"), unconfirmed: t("results.unconfirmed"), prepared: t("results.prepared"),
      replayLabel: t("results.replayLabel"), yes: t("results.yes"), no: t("results.no"), requested: t("results.requested"),
      existing: t("results.existing"), organizationId: t("results.organizationId"),
      slug: t("results.slug"), ownerId: t("results.ownerId"), ownerEmail: t("results.ownerEmail"),
      location: t("results.location"), invitation: t("results.invitation"),
    },
    errors: {
      authUnavailable: t("errors.authUnavailable"), inviteFailed: t("errors.inviteFailed"),
      identityIncomplete: t("errors.identityIncomplete"), identityMismatch: t("errors.identityMismatch"),
      platformAdminRequired: t("errors.platformAdminRequired"), idempotencyConflict: t("errors.idempotencyConflict"),
      slugConflict: t("errors.slugConflict"), ownerMembershipConflict: t("errors.ownerMembershipConflict"),
      ownerPortalConflict: t("errors.ownerPortalConflict"), ownerIdentityInvalid: t("errors.ownerIdentityInvalid"),
      invalidInput: t("errors.invalidInput"), unknown: t("errors.unknown"),
      requiredName: t("errors.requiredName"), invalidSlug: t("errors.invalidSlug"),
      invalidCurrency: t("errors.invalidCurrency"), invalidTimezone: t("errors.invalidTimezone"),
      invalidLocale: t("errors.invalidLocale"), invalidCountry: t("errors.invalidCountry"),
      requiredLocation: t("errors.requiredLocation"), invalidEmail: t("errors.invalidEmail"),
      invalidMode: t("errors.invalidMode"), invalidUuid: t("errors.invalidUuid"),
    },
  };
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link className="text-sm font-semibold text-primary underline" href="/platform/organizations" locale={locale}>{text.back}</Link>
      <header>
        <h1 className="text-3xl font-semibold text-primary">{text.title}</h1>
        <p className="mt-2 text-sm text-muted">{text.description}</p>
      </header>
      <PlatformTenantOnboardingForm action={bootstrapTenantAction.bind(null, locale)} initialKey={randomUUID()} locale={locale} text={text} />
    </div>
  );
}
