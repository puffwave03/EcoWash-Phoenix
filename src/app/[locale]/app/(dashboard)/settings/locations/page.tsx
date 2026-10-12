import { getTranslations } from "next-intl/server";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/operational/OperationalUi";
import { listOwnerLocations } from "@/features/location-settings/server/queries";
import { Link } from "@/i18n/navigation";

export default async function LocationSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [locations, t] = await Promise.all([
    listOwnerLocations(locale),
    getTranslations({ locale, namespace: "common.locationSettings" }),
  ]);
  return <div className="space-y-6">
    <PageHeader
      action={<Link className="font-semibold !text-primary hover:underline" href="/app/settings" locale={locale}>← {t("back")}</Link>}
      description={t("description")}
      eyebrow={t("eyebrow")}
      title={t("title")}
    />
    {locations.length === 0 ? <p className="text-sm text-muted">{t("empty")}</p> : null}
    <div className="grid gap-4 md:grid-cols-2">
      {locations.map((location) => <Card className="bg-white" key={location.id}>
        <Link className="block min-h-11 font-semibold !text-primary hover:underline" href={`/app/settings/locations/${location.id}`} locale={locale}>{location.name} →</Link>
        <p className="text-sm text-muted">{location.is_active ? t("active") : t("inactive")}</p>
      </Card>)}
    </div>
  </div>;
}
