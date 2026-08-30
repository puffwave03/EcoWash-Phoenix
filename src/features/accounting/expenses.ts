import type { AccountingPeriod } from "@/features/accounting/summary";

export type ExpenseStatus = "draft" | "posted" | "void";
export type ExpensePaymentStatus = "paid" | "unpaid";
export type ExpensePaymentMethod = "bank_transfer" | "card" | "cash" | "other";

export type ExpenseFact = {
  categoryId: string;
  categoryName: string;
  currency: string;
  expenseDate: string;
  grossAmount: number;
  id: string;
  locationId: string | null;
  locationName: string | null;
  status: ExpenseStatus;
  supplierId: string | null;
  supplierName: string | null;
  taxAmount: number | null;
};

export type ExpenseBreakdown = {
  count: number;
  id: string | null;
  label: string;
  totalGross: number;
};

export type ExpensePeriodBreakdown = {
  count: number;
  expenseDate: string;
  totalGross: number;
};

export type ExpenseCurrencySummary = {
  byCategory: ExpenseBreakdown[];
  byLocation: ExpenseBreakdown[];
  byPeriod: ExpensePeriodBreakdown[];
  bySupplier: ExpenseBreakdown[];
  currency: string;
  expenseCount: number;
  expenseIds: string[];
  expensesTotal: number;
  netAmountKnown: number;
  taxAmountKnown: number;
  taxMetadataExpenseCount: number;
};

export type ExpenseSummary = {
  currencies: ExpenseCurrencySummary[];
  dateBasis: "expenses.expense_date";
  locationId: string | null;
  period: AccountingPeriod;
  timezone: string;
};

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function breakdown(
  rows: ExpenseFact[],
  identity: (row: ExpenseFact) => { id: string | null; label: string },
): ExpenseBreakdown[] {
  const groups = new Map<string, ExpenseBreakdown>();
  for (const row of rows) {
    const value = identity(row);
    const key = value.id ?? "__unassigned__";
    const current = groups.get(key) ?? { count: 0, id: value.id, label: value.label, totalGross: 0 };
    current.count += 1;
    current.totalGross = round(current.totalGross + row.grossAmount);
    groups.set(key, current);
  }
  return [...groups.values()].sort((left, right) => right.totalGross - left.totalGross || left.label.localeCompare(right.label));
}

export function buildExpenseSummary(
  facts: ExpenseFact[],
  period: AccountingPeriod,
  locationId: string | null,
  timezone = "UTC",
): ExpenseSummary {
  const posted = facts.filter((expense) => expense.status === "posted");
  const currencies = [...new Set(posted.map((expense) => expense.currency))].sort();
  return {
    currencies: currencies.map((currency) => {
      const rows = posted.filter((expense) => expense.currency === currency);
      const periodGroups = new Map<string, ExpensePeriodBreakdown>();
      for (const row of rows) {
        const current = periodGroups.get(row.expenseDate) ?? { count: 0, expenseDate: row.expenseDate, totalGross: 0 };
        current.count += 1;
        current.totalGross = round(current.totalGross + row.grossAmount);
        periodGroups.set(row.expenseDate, current);
      }
      const taxKnown = rows.filter((expense) => expense.taxAmount !== null);
      const taxAmountKnown = round(taxKnown.reduce((total, expense) => total + (expense.taxAmount ?? 0), 0));
      return {
        byCategory: breakdown(rows, (expense) => ({ id: expense.categoryId, label: expense.categoryName })),
        byLocation: breakdown(rows, (expense) => ({ id: expense.locationId, label: expense.locationName ?? "Unassigned" })),
        byPeriod: [...periodGroups.values()].sort((left, right) => left.expenseDate.localeCompare(right.expenseDate)),
        bySupplier: breakdown(rows, (expense) => ({ id: expense.supplierId, label: expense.supplierName ?? "Unassigned" })),
        currency,
        expenseCount: rows.length,
        expenseIds: rows.map((expense) => expense.id),
        expensesTotal: round(rows.reduce((total, expense) => total + expense.grossAmount, 0)),
        netAmountKnown: round(taxKnown.reduce((total, expense) => total + expense.grossAmount - (expense.taxAmount ?? 0), 0)),
        taxAmountKnown,
        taxMetadataExpenseCount: taxKnown.length,
      };
    }),
    dateBasis: "expenses.expense_date",
    locationId,
    period,
    timezone,
  };
}
