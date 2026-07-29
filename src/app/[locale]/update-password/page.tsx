import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { Card } from "@/components/Card";
import { Container } from "@/components/Container";
import { Link } from "@/i18n/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UpdatePasswordForm } from "@/app/[locale]/update-password/UpdatePasswordForm";

type UpdatePasswordPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function UpdatePasswordPage({
  params,
  searchParams,
}: UpdatePasswordPageProps) {
  const { locale } = await params;
  const { error } = await searchParams;
  const t = await getTranslations({ locale, namespace: "common.auth.updatePassword" });
  const cookieStore = await cookies();
  let hasRecoverySession = false;

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    hasRecoverySession = Boolean(user) && cookieStore.get("ecowash-password-recovery")?.value === "1";
  } catch (configurationError) {
    console.error("Password update page configuration error", configurationError);
  }

  const sessionError = error === "recovery" || !hasRecoverySession;

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

          {sessionError ? (
            <div className="space-y-5">
              <p className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {t("errors.expired")}
              </p>
              <Link
                className="inline-flex text-sm font-semibold text-primary underline-offset-4 transition-standard hover:text-secondary hover:underline"
                href="/forgot-password"
                locale={locale}
              >
                {t("requestNewLink")}
              </Link>
            </div>
          ) : (
            <UpdatePasswordForm
              locale={locale}
              text={{
                confirmPasswordLabel: t("confirmPasswordLabel"),
                errorConfiguration: t("errors.configuration"),
                errorExpired: t("errors.expired"),
                errorMissingFields: t("errors.missingFields"),
                errorMismatch: t("errors.mismatch"),
                errorUpdateFailed: t("errors.updateFailed"),
                errorWeakPassword: t("errors.weakPassword"),
                passwordHelp: t("passwordHelp"),
                passwordLabel: t("passwordLabel"),
                submit: t("submit"),
                submitting: t("submitting"),
              }}
            />
          )}
        </Card>
      </Container>
    </main>
  );
}
