export function parseTaxRate(value: string) {
  const parsed = Number(value.trim().replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return null;
  return Math.round(parsed * 10000) / 10000;
}

export function taxRateInputValue(value: number) {
  const normalized = Number.isFinite(value) ? Math.min(Math.max(value, 0), 100) : 0;
  return String(Math.round(normalized * 10000) / 10000);
}

export function formatTaxRate(value: number, locale: string) {
  const normalized = Number.isFinite(value) ? Math.min(Math.max(value, 0), 100) : 0;
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(normalized);
}
