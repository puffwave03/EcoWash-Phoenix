import { getTranslations } from "next-intl/server";
import { WorkExperienceLanding } from "@/components/work/WorkExperienceLanding";
import { requireMembership } from "@/lib/auth/require-membership";

type WorkPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function WorkPage({ params }: WorkPageProps) {
  const { locale } = await params;
  const [access, t] = await Promise.all([
    requireMembership(locale),
    getTranslations({ locale, namespace: "common.work" }),
  ]);

  return (
    <WorkExperienceLanding
      isControlRole={access.membership.role === "owner" || access.membership.role === "manager"}
      locale={locale}
      profileName={access.profile.displayName || access.user.email || ""}
      text={{
        controlDescription: t("controlDescription"),
        controlTitle: t("controlTitle"),
        delivery: t("delivery"),
        deliveryDescription: t("deliveryDescription"),
        eyebrow: t("eyebrow"),
        nextDescription: t("nextDescription"),
        nextTitle: t("nextTitle"),
        pickup: t("pickup"),
        pickupDescription: t("pickupDescription"),
        production: t("production"),
        productionDescription: t("productionDescription"),
        quality: t("quality"),
        qualityDescription: t("qualityDescription"),
        staffDescription: t("staffDescription"),
        staffTitle: t("staffTitle"),
        startDelivery: t("startDelivery"),
        startProduction: t("startProduction"),
        title: t("title"),
      }}
    />
  );
}
