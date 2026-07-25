"use client";

import { useLocale, useTranslations } from "next-intl";
import { routing, type AppLocale } from "@/i18n/routing";
import { usePathname, useRouter } from "@/i18n/navigation";

export function LanguageSwitcher() {
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("common.language");

  function handleLocaleChange(nextLocale: string) {
    router.replace(pathname, { locale: nextLocale as AppLocale });
  }

  return (
    <label className="inline-flex items-center gap-2 text-sm font-medium text-muted">
      <span className="sr-only">{t("label")}</span>
      <select
        aria-label={t("label")}
        className="min-h-11 rounded-control border border-border bg-surface px-3 text-sm font-medium text-primary transition-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        onChange={(event) => handleLocaleChange(event.target.value)}
        value={locale}
      >
        {routing.locales.map((availableLocale) => (
          <option key={availableLocale} value={availableLocale}>
            {t(`locales.${availableLocale}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
