import { getTranslations } from "next-intl/server";
import { Card } from "@/components/Card";
import { Container } from "@/components/Container";
import { loginAction } from "@/app/[locale]/login/actions";
import { LoginForm } from "@/components/auth/LoginForm";

type LoginPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function LoginPage({ params }: LoginPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common.auth.login" });

  return (
    <main className="bg-background py-16 sm:py-24">
      <Container className="max-w-lg">
        <Card className="space-y-8">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">
              {t("eyebrow")}
            </p>
            <h1 className="text-3xl font-semibold text-primary">{t("title")}</h1>
            <p className="text-base leading-7 text-muted">{t("description")}</p>
          </div>

          <LoginForm
            action={loginAction}
            locale={locale}
            text={{
              emailLabel: t("emailLabel"),
              emailPlaceholder: t("emailPlaceholder"),
              errorConfiguration: t("errors.configuration"),
              errorInvalidCredentials: t("errors.invalidCredentials"),
              errorMissingFields: t("errors.missingFields"),
              passwordLabel: t("passwordLabel"),
              submit: t("submit"),
              submitting: t("submitting"),
            }}
          />
        </Card>
      </Container>
    </main>
  );
}
