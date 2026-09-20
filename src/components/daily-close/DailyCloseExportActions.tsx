"use client";

import { Link } from "@/i18n/navigation";

export function DailyCloseExportActions({ closeId, locale, text }: {
  closeId: string;
  locale: string;
  text: { back: string; csv: string; pdf: string; print: string };
}) {
  const buttonClass = "inline-flex min-h-11 w-full items-center justify-center rounded-control border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary hover:text-white sm:w-auto";

  return (
    <div className="flex w-full flex-col gap-2 print:hidden sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
      <Link className={buttonClass} href="/app/daily-close/history" locale={locale}>{text.back}</Link>
      <Link className={buttonClass} href={`/app/daily-close/history/${closeId}/export/csv`} locale={locale}>{text.csv}</Link>
      <Link className={buttonClass} href={`/app/daily-close/history/${closeId}/export/pdf`} locale={locale}>{text.pdf}</Link>
      <button className={buttonClass} onClick={() => window.print()} type="button">{text.print}</button>
    </div>
  );
}
