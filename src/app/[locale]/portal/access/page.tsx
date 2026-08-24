import { getTranslations } from "next-intl/server";
import { Card } from "@/components/Card";
import { CustomerPortalShell } from "@/components/portal/CustomerPortalShell";
import { requireAuth } from "@/lib/auth/require-auth";

type CustomerPortalAccessPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function CustomerPortalAccessPage({
  params,
}: CustomerPortalAccessPageProps) {
  const { locale } = await params;
  await requireAuth(locale);
  const t = await getTranslations({ locale, namespace: "common.portal" });

  return (
    <CustomerPortalShell
      locale={locale}
      text={{
        assistance: t("assistance"),
        logout: t("logout"),
        navigationLabel: t("navigationLabel"),
        orders: t("orders"),
        overview: t("overview"),
        profile: t("profile"),
        title: t("title"),
      }}
    >
      <Card className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">
          {t("unauthorized")}
        </p>
        <h2 className="text-2xl font-semibold text-primary">{t("unauthorizedTitle")}</h2>
        <p className="text-sm leading-6 text-muted">{t("unauthorizedDescription")}</p>
      </Card>
    </CustomerPortalShell>
  );
}
