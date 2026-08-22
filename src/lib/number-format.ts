type NumericValue = number | string;

function numericValue(value: NumericValue) {
  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

export function formatCurrency(
  value: NumericValue,
  currency: string,
  locale: string,
) {
  const amount = numericValue(value);
  if (amount === null) return "-";

  return new Intl.NumberFormat(locale, {
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(amount);
}

export function formatQuantity(value: NumericValue, locale: string) {
  const quantity = numericValue(value);
  if (quantity === null) return "-";

  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(quantity);
}

export function formatNumberInput(
  value: NumericValue,
  maximumFractionDigits: number,
) {
  const amount = numericValue(value);
  if (amount === null) return "";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
    minimumFractionDigits: 0,
    useGrouping: false,
  }).format(Object.is(amount, -0) ? 0 : amount);
}
