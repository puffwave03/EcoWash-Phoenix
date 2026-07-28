import { getTranslations } from "next-intl/server";
import { Card } from "@/components/Card";
import { Container } from "@/components/Container";
import { LogoutButton } from "@/components/dashboard/LogoutButton";
import { requireAuth } from "@/lib/auth/require-auth";

type AccessDeniedPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AccessDeniedPage({ params }: AccessDeniedPageProps) {
  const { locale } = await params;
  await requireAuth(locale);
  const t = await getTranslations({ locale, namespace: "common.auth.accessDenied" });

  return (
    <main className="min-h-screen bg-background py-16">
      <Container className="max-w-2xl">
        <Card className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">
              {t("eyebrow")}
            </p>
            <h1 className="text-3xl font-semibold text-primary">{t("title")}</h1>
            <p className="text-base leading-7 text-muted">{t("description")}</p>
          </div>
          <LogoutButton label={t("logout")} locale={locale} />
        </Card>
      </Container>
    </main>
  );
}
