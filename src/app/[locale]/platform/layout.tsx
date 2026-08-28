import { getTranslations } from "next-intl/server";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { getAuthContexts } from "@/lib/auth/get-auth-contexts";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";

export default async function PlatformLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [access, t] = await Promise.all([
    requirePlatformAdmin(locale),
    getTranslations({ locale, namespace: "common.platform" }),
  ]);
  const contexts = await getAuthContexts(access.user.id);
  const tenant = contexts.tenantMemberships[0];
  return (
    <PlatformShell
      locale={locale}
      operatorName={access.profile?.displayName ?? access.user.email ?? t("shell.operator")}
      tenantName={tenant?.organization.name}
      text={{
        logout: t("shell.logout"),
        navigationLabel: t("shell.navigationLabel"),
        organizations: t("shell.organizations"),
        overview: t("shell.overview"),
        product: t("shell.product"),
        role: t("shell.role"),
        switchToTenant: t("shell.switchToTenant", { organization: tenant?.organization.name ?? "" }),
      }}
    >
      {children}
    </PlatformShell>
  );
}
