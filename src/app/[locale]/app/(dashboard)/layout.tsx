import { getTranslations } from "next-intl/server";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
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

  return (
    <DashboardShell
      access={access}
      locale={locale}
      text={{
        foundation: t("foundation"),
        logout: t("logout"),
        navigationLabel: t("navigationLabel"),
        customers: t("customers"),
        orders: t("orders"),
        organizationLabel: t("organizationLabel"),
        overview: t("overview"),
        production: t("production"),
        roleLabel: t("roleLabel"),
        services: t("services"),
        userLabel: t("userLabel"),
      }}
    >
      {children}
    </DashboardShell>
  );
}
