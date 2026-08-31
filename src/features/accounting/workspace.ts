import type { ExpenseSummary } from "@/features/accounting/expenses";
import type { AccountingPeriod, AccountingSummary } from "@/features/accounting/summary";

export const ACCOUNTING_PERIOD_PRESETS = ["today", "week", "month", "previousMonth", "custom"] as const;
export type AccountingPeriodPreset = (typeof ACCOUNTING_PERIOD_PRESETS)[number];

export type AccountingPeriodSelection = {
  endDate: string;
  period: AccountingPeriod;
  preset: AccountingPeriodPreset;
};

export type OperationalCurrencySummary = {
  bankTransferCollected: number;
  cardCollected: number;
  cashCollected: number;
  collectedGross: number;
  collectedNet: number;
  currency: string;
  expensesTotal: number;
  onlineCollected: number;
  operationalResult: number;
  otherCollected: number;
  outstanding: number;
  refunds: number;
  salesNet: number;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function dateParts(value: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  });
  const parts = Object.fromEntries(formatter.formatToParts(value).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function addLocalDays(date: string, days: number) {
  if (!DATE.test(date)) throw new Error("accounting_period_invalid");
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function resolveAccountingPeriod(
  presetInput: string | undefined,
  startInput: string | undefined,
  endInput: string | undefined,
  timezone: string,
  now = new Date(),
): AccountingPeriodSelection {
  const preset = ACCOUNTING_PERIOD_PRESETS.includes(presetInput as AccountingPeriodPreset)
    ? presetInput as AccountingPeriodPreset
    : "month";
  const today = dateParts(now, timezone);
  let startDate = today;
  let endDate = today;

  if (preset === "week") {
    const [year, month, day] = today.split("-").map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay() || 7;
    startDate = addLocalDays(today, 1 - weekday);
  } else if (preset === "month") {
    startDate = `${today.slice(0, 8)}01`;
  } else if (preset === "previousMonth") {
    const [year, month] = today.split("-").map(Number);
    endDate = new Date(Date.UTC(year, month - 1, 0)).toISOString().slice(0, 10);
    startDate = `${endDate.slice(0, 8)}01`;
  } else if (preset === "custom") {
    if (!startInput || !endInput || !DATE.test(startInput) || !DATE.test(endInput) || endInput < startInput) {
      throw new Error("accounting_period_invalid");
    }
    startDate = startInput;
    endDate = endInput;
  }

  return {
    endDate,
    period: { endDateExclusive: addLocalDays(endDate, 1), startDate },
    preset,
  };
}

export function buildOperationalCurrencySummaries(
  accounting: AccountingSummary,
  expenses: ExpenseSummary,
): OperationalCurrencySummary[] {
  const salesByCurrency = new Map(accounting.currencies.map((value) => [value.currency, value]));
  const expensesByCurrency = new Map(expenses.currencies.map((value) => [value.currency, value]));
  const currencies = [...new Set([...salesByCurrency.keys(), ...expensesByCurrency.keys()])].sort();
  return currencies.map((currency) => {
    const sales = salesByCurrency.get(currency);
    const expense = expensesByCurrency.get(currency);
    const salesNet = sales?.salesNet ?? 0;
    const expensesTotal = expense?.expensesTotal ?? 0;
    return {
      bankTransferCollected: sales?.bankTransferCollected ?? 0,
      cardCollected: sales?.cardCollected ?? 0,
      cashCollected: sales?.cashCollected ?? 0,
      collectedGross: sales?.collectedGross ?? 0,
      collectedNet: sales?.collectedNet ?? 0,
      currency,
      expensesTotal,
      onlineCollected: sales?.onlineCollected ?? 0,
      operationalResult: round(salesNet - expensesTotal),
      otherCollected: sales?.otherCollected ?? 0,
      outstanding: sales?.outstanding ?? 0,
      refunds: sales?.refunds ?? 0,
      salesNet,
    };
  });
}

export function csvValue(value: unknown) {
  const raw = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function buildUtf8Csv(headers: string[], rows: unknown[][]) {
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\r\n")}\r\n`;
}
