import { getTranslations } from "next-intl/server";
import { Card } from "@/components/Card";
import { Container } from "@/components/Container";
import { LogoutButton } from "@/components/dashboard/LogoutButton";
import { requireAuth } from "@/lib/auth/require-auth";

export default async function SuspendedOrganizationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requireAuth(locale);
  const t = await getTranslations({ locale, namespace: "common.organizationSuspended" });
  return <main className="min-h-screen bg-background py-16"><Container className="max-w-2xl"><Card className="space-y-5 bg-white"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">{t("eyebrow")}</p><h1 className="text-3xl font-semibold text-primary">{t("title")}</h1><p className="leading-7 text-muted">{t("description")}</p><LogoutButton label={t("logout")} locale={locale} /></Card></Container></main>;
}
