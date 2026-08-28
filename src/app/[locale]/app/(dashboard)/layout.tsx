import { getTranslations } from "next-intl/server";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { getOperationalAlertCount } from "@/features/alerts/server/queries";
import { getTenantBranding } from "@/features/branding/server/queries";
import { FEATURES } from "@/features/entitlements/feature-catalog";
import { getCurrentEntitlements } from "@/features/entitlements/server/resolver";
import { getAuthContexts } from "@/lib/auth/get-auth-contexts";
import { requireMembership } from "@/lib/auth/require-membership";

type DashboardLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function DashboardLayout({
  children,
  params,
}: DashboardLayoutProps) {
  const { locale } = await params;
  const [access, t] = await Promise.all([
    requireMembership(locale),
    getTranslations({ locale, namespace: "common.auth.dashboard" }),
  ]);
  const [alertCount, branding, entitlements, contexts] = await Promise.all([
    access.membership.role === "staff" ? 0 : getOperationalAlertCount(locale),
    getTenantBranding(access.membership.organization.id),
    getCurrentEntitlements(locale, [FEATURES.billingInvoicing, FEATURES.fullWhiteLabel, FEATURES.pos]),
    getAuthContexts(access.user.id),
  ]);

  return (
    <DashboardShell
      access={access}
      alertCount={alertCount}
      brand={branding.brand}
      entitlements={entitlements}
      locale={locale}
      platformAccess={contexts.isPlatformAdmin}
      text={{
        alerts: t("alerts"),
        billing: t("billing"),
        branding: t("branding"),
        catalogAdmin: t("catalogAdmin"),
        controlCenter: t("controlCenter"),
        controlGroup: t("controlGroup"),
        dailyClose: t("dailyClose"),
        delivery: t("delivery"),
        foundation: t("foundation"),
        logout: t("logout"),
        logoutError: t("logoutError"),
        managementGroup: t("managementGroup"),
        navigationLabel: t("navigationLabel"),
        customers: t("customers"),
        orders: t("orders"),
        pos: t("pos"),
        organizationLabel: t("organizationLabel"),
        overview: t("overview"),
        production: t("production"),
        quality: t("quality"),
        roleLabel: t("roleLabel"),
        services: t("services"),
        staff: t("staff"),
        switchToPlatform: t("switchToPlatform"),
        toolsGroup: t("toolsGroup"),
        userLabel: t("userLabel"),
        work: t("work"),
        workExperience: t("workExperience"),
        workGroup: t("workGroup"),
      }}
    >
      {children}
    </DashboardShell>
  );
}
