import { getTranslations } from "next-intl/server";
import { Card } from "@/components/Card";
import { Container } from "@/components/Container";
import { loginAction } from "@/app/[locale]/login/actions";
import { LoginForm } from "@/components/auth/LoginForm";
import { Link } from "@/i18n/navigation";

type LoginPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
};

export default async function LoginPage({ params, searchParams }: LoginPageProps) {
  const { locale } = await params;
  const { status } = await searchParams;
  const t = await getTranslations({ locale, namespace: "common.auth.login" });
  const passwordUpdated = status === "passwordUpdated";
  const authCallbackError = status === "authCallbackError";

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

          {passwordUpdated ? (
            <p className="rounded-control border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {t("messages.passwordUpdated")}
            </p>
          ) : null}

          {authCallbackError ? (
            <p className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {t("messages.authCallbackError")}
            </p>
          ) : null}

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

          <Link
            className="inline-flex text-sm font-semibold text-primary underline-offset-4 transition-standard hover:text-secondary hover:underline"
            href="/forgot-password"
            locale={locale}
          >
            {t("forgotPassword")}
          </Link>
        </Card>
      </Container>
    </main>
  );
}
