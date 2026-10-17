// A series declaration is not fiscal approval and never enables invoicing.
export function parseBillingSimplifiedSeries(values: readonly unknown[]): string | null {
  if (values.length !== 1 || typeof values[0] !== "string") return null;
  const series = values[0].trim();
  return /^[A-Za-z0-9-]{1,12}$/.test(series) ? series.toUpperCase() : null;
}
