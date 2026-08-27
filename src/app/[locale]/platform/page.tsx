import { getTranslations } from "next-intl/server";
import { Card } from "@/components/Card";
import { getPlatformOverview } from "@/features/platform-admin/server/queries";
import { Link } from "@/i18n/navigation";

export default async function PlatformOverviewPage({ params }: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [overview, t] = await Promise.all([
    getPlatformOverview(locale),
    getTranslations({ locale, namespace: "common.platform" }),
  ]);
  const metrics = [
    ["total", overview.totalOrganizations],
    ["active", overview.activeOrganizations],
    ["suspended", overview.suspendedOrganizations],
    ["billing", overview.billingOrganizations],
    ["segmentPricing", overview.segmentPricingOrganizations],
    ["advancedBranding", overview.advancedBrandingOrganizations],
  ] as const;
  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">{t("overview.eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-semibold text-primary sm:text-4xl">{t("overview.title")}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{t("overview.description")}</p>
      </header>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map(([key, value]) => (
          <Card className="bg-white" key={key}>
            <p className="text-sm font-medium text-muted">{t(`overview.metrics.${key}`)}</p>
            <p className="mt-3 text-3xl font-semibold tabular-nums text-primary">{value}</p>
          </Card>
        ))}
      </section>
      <Link className="inline-flex min-h-11 items-center rounded-control bg-primary px-5 text-sm font-semibold !text-white" href="/platform/organizations" locale={locale}>
        {t("overview.openOrganizations")}
      </Link>
    </div>
  );
}
