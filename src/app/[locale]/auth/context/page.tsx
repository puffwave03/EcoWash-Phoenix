import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card";
import { Container } from "@/components/Container";
import { Link } from "@/i18n/navigation";
import { resolveAuthLanding } from "@/lib/auth/context-routing";
import { getAuthContexts } from "@/lib/auth/get-auth-contexts";
import { requireAuth } from "@/lib/auth/require-auth";

export default async function AuthContextPage({ params }: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireAuth(locale);
  const [contexts, t] = await Promise.all([
    getAuthContexts(user.id),
    getTranslations({ locale, namespace: "common.auth.context" }),
  ]);
  const landing = resolveAuthLanding(contexts);

  if (landing === "platform") {
    redirect(`/${locale}/platform`);
  }

  if (landing === "tenant") {
    redirect(`/${locale}/app`);
  }

  if (landing === "portal") {
    redirect(`/${locale}/portal`);
  }

  if (landing === "denied") {
    redirect(`/${locale}/app/access-denied`);
  }

  return (
    <main className="min-h-screen bg-background py-16 sm:py-24">
      <Container className="max-w-3xl">
        <div className="space-y-8">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">
              {t("eyebrow")}
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-primary sm:text-4xl">{t("title")}</h1>
            <p className="mx-auto mt-3 max-w-2xl leading-7 text-muted">{t("description")}</p>
          </div>

          <div aria-label={t("selectorLabel")} className="grid gap-4 md:grid-cols-2" role="list">
            <Card className="flex h-full flex-col justify-between gap-6 bg-white" role="listitem">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">{t("platformEyebrow")}</p>
                <h2 className="mt-2 text-2xl font-semibold text-primary">Phoenix Platform</h2>
                <p className="mt-3 leading-7 text-muted">{t("platformDescription")}</p>
              </div>
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-control bg-primary px-5 text-sm font-semibold !text-white transition-standard hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                href="/platform"
                locale={locale}
              >
                {t("platformAction")}
              </Link>
            </Card>

            {contexts.tenantMemberships.map((membership) => (
              <Card className="flex h-full flex-col justify-between gap-6 bg-white" key={membership.membershipId} role="listitem">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">{t("tenantEyebrow")}</p>
                  <h2 className="mt-2 text-2xl font-semibold text-primary">{membership.organization.name}</h2>
                  <p className="mt-3 leading-7 text-muted">{t("tenantDescription")}</p>
                </div>
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-control border border-primary px-5 text-sm font-semibold !text-primary transition-standard hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  href="/app"
                  locale={locale}
                >
                  {t("tenantAction", { organization: membership.organization.name })}
                </Link>
              </Card>
            ))}
          </div>
        </div>
      </Container>
    </main>
  );
}
