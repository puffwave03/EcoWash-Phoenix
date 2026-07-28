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
        organizationLabel: t("organizationLabel"),
        overview: t("overview"),
        roleLabel: t("roleLabel"),
        userLabel: t("userLabel"),
      }}
    >
      {children}
    </DashboardShell>
  );
}
