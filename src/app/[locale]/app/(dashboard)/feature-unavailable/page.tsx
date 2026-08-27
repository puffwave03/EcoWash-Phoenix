import { getTranslations } from "next-intl/server";
import { FeatureUnavailablePanel } from "@/components/entitlements/FeatureUnavailablePanel";
import { requireMembership } from "@/lib/auth/require-membership";

export default async function FeatureUnavailablePage({ params }: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [, t] = await Promise.all([
    requireMembership(locale),
    getTranslations({ locale, namespace: "common.entitlements.unavailable" }),
  ]);

  return (
    <FeatureUnavailablePanel
      backLabel={t("back")}
      description={t("description")}
      eyebrow={t("eyebrow")}
      locale={locale}
      title={t("title")}
    />
  );
}
