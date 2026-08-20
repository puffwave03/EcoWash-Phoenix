import { ProductionWorkspacePage } from "@/components/production/ProductionWorkspacePage";

type WorkProductionPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function WorkProductionPage({ params }: WorkProductionPageProps) {
  const { locale } = await params;

  return <ProductionWorkspacePage locale={locale} />;
}
