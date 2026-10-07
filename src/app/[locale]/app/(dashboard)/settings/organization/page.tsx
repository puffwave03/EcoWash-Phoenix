import { getTranslations } from "next-intl/server";
import { OrganizationSettingsForm } from "@/components/organization-settings/OrganizationSettingsForm";
import { saveOrganizationSettingsAction } from "@/features/organization-settings/server/actions";
import { requireOwner } from "@/lib/auth/require-role";

export default async function OrganizationSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [access, t] = await Promise.all([
    requireOwner(locale),
    getTranslations({ locale, namespace: "common.organizationSettings" }),
  ]);
  const organization = access.membership.organization;
  return <div className="space-y-6">
    <header className="max-w-3xl space-y-2">
      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">{t("eyebrow")}</p>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{t("title")}</h1>
      <p className="text-base leading-7 text-muted">{t("description")}</p>
    </header>
    <OrganizationSettingsForm
      action={saveOrganizationSettingsAction.bind(null, locale)}
      settings={organization}
      text={{ name: t("name"), currency: t("currency"), currencyHelp: t("currencyHelp"), currencyLocked: t("currencyLocked"), timezone: t("timezone"), timezoneLocked: t("timezoneLocked"), locale: t("locale"), country: t("country"), countryHelp: t("countryHelp"), save: t("save"), saving: t("saving"), saved: t("saved"), invalid: t("invalid"), unavailable: t("unavailable") }}
    />
  </div>;
}
