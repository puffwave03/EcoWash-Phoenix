import { getTranslations } from "next-intl/server";
import { PrinterSettingsWorkspace, type PrinterSettingsText } from "@/components/printer-settings/PrinterSettingsWorkspace";
import { savePrinterProfileAction } from "@/features/printer-settings/server/actions";
import { listPrinterProfiles, listPrinterSettingsLocations } from "@/features/printer-settings/server/queries";
import { DocumentPrintPreferences, type DocumentPreferencesText } from "@/components/printer-settings/DocumentPrintPreferences";
import { listDocumentPrintPreferences } from "@/features/printer-settings/server/document-preference-queries";
import { saveDocumentPrintPreferenceAction } from "@/features/printer-settings/server/document-preference-actions";

export default async function PrinterSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [profiles, locations, t, documentSettings] = await Promise.all([
    listPrinterProfiles(locale),
    listPrinterSettingsLocations(locale),
    getTranslations({ locale, namespace: "common.printerSettings" }),
    listDocumentPrintPreferences(locale),
  ]);

  return (
    <div className="space-y-6">
      <header className="max-w-3xl space-y-2">
        <p className="text-sm font-bold uppercase tracking-[0.12em] text-secondary">{t("eyebrow")}</p>
        <h1 className="text-3xl font-black tracking-tight text-primary sm:text-4xl">{t("title")}</h1>
        <p className="text-base leading-7 text-muted">{t("description")}</p>
      </header>
      <DocumentPrintPreferences
        action={saveDocumentPrintPreferenceAction.bind(null, locale)}
        available={documentSettings.available}
        locations={locations}
        preferences={documentSettings.preferences}
        profiles={profiles}
        text={t.raw("documentPreferences") as DocumentPreferencesText}
      />
      <PrinterSettingsWorkspace
        action={savePrinterProfileAction.bind(null, locale)}
        locations={locations}
        profiles={profiles}
        text={t.raw("labels") as PrinterSettingsText}
      />
    </div>
  );
}
