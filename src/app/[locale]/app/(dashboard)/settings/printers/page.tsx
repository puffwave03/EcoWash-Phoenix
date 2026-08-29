import { getTranslations } from "next-intl/server";
import { PrinterSettingsWorkspace, type PrinterSettingsText } from "@/components/printer-settings/PrinterSettingsWorkspace";
import { savePrinterProfileAction } from "@/features/printer-settings/server/actions";
import { listPrinterProfiles, listPrinterSettingsLocations } from "@/features/printer-settings/server/queries";

export default async function PrinterSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [profiles, locations, t] = await Promise.all([
    listPrinterProfiles(locale),
    listPrinterSettingsLocations(locale),
    getTranslations({ locale, namespace: "common.printerSettings" }),
  ]);

  return (
    <div className="space-y-6">
      <header className="max-w-3xl space-y-2">
        <p className="text-sm font-bold uppercase tracking-[0.12em] text-secondary">{t("eyebrow")}</p>
        <h1 className="text-3xl font-black tracking-tight text-primary sm:text-4xl">{t("title")}</h1>
        <p className="text-base leading-7 text-muted">{t("description")}</p>
      </header>
      <PrinterSettingsWorkspace
        action={savePrinterProfileAction.bind(null, locale)}
        locations={locations}
        profiles={profiles}
        text={t.raw("labels") as PrinterSettingsText}
      />
    </div>
  );
}
