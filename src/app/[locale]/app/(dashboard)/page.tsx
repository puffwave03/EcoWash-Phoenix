import { getTranslations } from "next-intl/server";
import { Card } from "@/components/Card";

type DashboardPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common.auth.dashboard" });

  return (
    <Card className="space-y-3">
      <h2 className="text-xl font-semibold text-primary">{t("title")}</h2>
      <p className="text-base leading-7 text-muted">{t("description")}</p>
    </Card>
  );
}
