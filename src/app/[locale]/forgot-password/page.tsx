import { getTranslations } from "next-intl/server";
import { Card } from "@/components/Card";
import { Container } from "@/components/Container";
import { Link } from "@/i18n/navigation";
import { ForgotPasswordForm } from "@/app/[locale]/forgot-password/ForgotPasswordForm";

type ForgotPasswordPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
};

const resetResultKeys = ["sent", "missingEmail", "configuration", "rateLimited"] as const;

type ResetResultKey = (typeof resetResultKeys)[number];

function isResetResultKey(value: string | undefined): value is ResetResultKey {
  return resetResultKeys.includes(value as ResetResultKey);
}

function messageClass(status: string) {
  return status === "sent"
    ? "border-green-200 bg-green-50 text-green-700"
    : "border-red-200 bg-red-50 text-red-700";
}

export default async function ForgotPasswordPage({
  params,
  searchParams,
}: ForgotPasswordPageProps) {
  const { locale } = await params;
  const { status: rawStatus } = await searchParams;
  const status = isResetResultKey(rawStatus) ? rawStatus : null;
  const t = await getTranslations({ locale, namespace: "common.auth.forgotPassword" });

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

          {status ? (
            <p
              className={`rounded-control border px-4 py-3 text-sm ${messageClass(status)}`}
              role="status"
            >
              {t(`messages.${status}`)}
            </p>
          ) : null}

          <ForgotPasswordForm
            locale={locale}
            text={{
              emailLabel: t("emailLabel"),
              emailPlaceholder: t("emailPlaceholder"),
              submit: t("submit"),
              submitting: t("submitting"),
            }}
          />

          <Link
            className="inline-flex text-sm font-semibold text-primary underline-offset-4 transition-standard hover:text-secondary hover:underline"
            href="/login"
            locale={locale}
          >
            {t("backToLogin")}
          </Link>
        </Card>
      </Container>
    </main>
  );
}
