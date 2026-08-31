import "server-only";

import type { Expense, ExpenseCategory, Supplier } from "@/features/accounting/expense-types";
import { getExpenseSummary, listExpenseCategories, listExpenses, listSuppliers } from "@/features/accounting/server/expense-queries";
import { getAccountingSummary } from "@/features/accounting/server/queries";
import type { AccountingPeriod, AccountingSummary } from "@/features/accounting/summary";
import { accountingPeriodBounds } from "@/features/accounting/summary";
import { buildOperationalCurrencySummaries, type OperationalCurrencySummary } from "@/features/accounting/workspace";
import type { AppRole } from "@/lib/auth/types";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AccountingLocation = { id: string; name: string };

export type AccountingActivity = {
  amount: number;
  currency: string;
  customerName: string | null;
  date: string;
  expenseStatus: Expense["status"] | null;
  id: string;
  locationName: string | null;
  paymentMethod: string | null;
  reference: string;
  type: "expense" | "payment" | "refund" | "sale";
};

export type AccountingWorkspaceData = {
  activity: AccountingActivity[];
  categories: ExpenseCategory[];
  defaultCurrency: string;
  expenses: Expense[];
  locations: AccountingLocation[];
  operational: OperationalCurrencySummary[];
  role: AppRole;
  summary: AccountingSummary;
  expenseSummary: Awaited<ReturnType<typeof getExpenseSummary>>;
  suppliers: Supplier[];
  timezone: string;
};

type OrderActivityRow = {
  created_at: string;
  currency: string;
  customer: { display_name: string } | { display_name: string }[] | null;
  id: string;
  location_id: string | null;
  order_number: string;
  total: number;
};

type PaymentActivityRow = {
  amount: number;
  id: string;
  method: string;
  order: {
    currency: string;
    customer: { display_name: string } | { display_name: string }[] | null;
    location_id: string | null;
    order_number: string;
  } | {
    currency: string;
    customer: { display_name: string } | { display_name: string }[] | null;
    location_id: string | null;
    order_number: string;
  }[] | null;
  paid_at: string;
  status: "confirmed" | "refunded";
};

function relation<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function chunks<T>(values: T[], size = 100) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

async function workspaceContext(locale: string) {
  const access = await requireOwnerOrManager(locale);
  const supabase = await createSupabaseServerClient();
  const [organizationResult, locationResult] = await Promise.all([
    supabase.from("organizations").select("default_currency")
      .eq("id", access.membership.organization.id).single<{ default_currency: string }>(),
    supabase.from("locations").select("id, name")
      .eq("organization_id", access.membership.organization.id).eq("is_active", true).is("deleted_at", null)
      .order("name").limit(100).returns<AccountingLocation[]>(),
  ]);
  if (organizationResult.error || !organizationResult.data || locationResult.error) {
    throw new Error("accounting_workspace_context_failed");
  }
  return {
    access,
    defaultCurrency: organizationResult.data.default_currency,
    locations: locationResult.data ?? [],
    supabase,
  };
}

async function activityForSummary(
  locale: string,
  summary: AccountingSummary,
  expenses: Expense[],
  categories: ExpenseCategory[],
  suppliers: Supplier[],
  locations: AccountingLocation[],
) {
  const { membership } = await requireOwnerOrManager(locale);
  const organizationId = membership.organization.id;
  const supabase = await createSupabaseServerClient();
  const orderIds = [...new Set(summary.currencies.flatMap((value) => value.orderIds))];
  const paymentIds = [...new Set(summary.currencies.flatMap((value) => [...value.paymentIds, ...value.refundIds]))];
  const orders: OrderActivityRow[] = [];
  const payments: PaymentActivityRow[] = [];

  for (const ids of chunks(orderIds)) {
    const { data, error } = await supabase.from("orders")
      .select("id, order_number, created_at, total, currency, location_id, customer:customers!orders_customer_same_organization!inner(display_name)")
      .eq("organization_id", organizationId).in("id", ids).returns<OrderActivityRow[]>();
    if (error) throw new Error(`accounting_activity_failed:${error.code}`);
    orders.push(...(data ?? []));
  }
  for (const ids of chunks(paymentIds)) {
    const { data, error } = await supabase.from("payments")
      .select("id, amount, method, status, paid_at, order:orders!payments_order_same_org!inner(order_number, currency, location_id, customer:customers!orders_customer_same_organization!inner(display_name))")
      .eq("organization_id", organizationId).in("id", ids).returns<PaymentActivityRow[]>();
    if (error) throw new Error(`accounting_activity_failed:${error.code}`);
    payments.push(...(data ?? []));
  }

  const locationNames = new Map(locations.map((value) => [value.id, value.name]));
  const categoryNames = new Map(categories.map((value) => [value.id, value.name]));
  const supplierNames = new Map(suppliers.map((value) => [value.id, value.displayName]));
  return [
    ...orders.map<AccountingActivity>((order) => ({
      amount: Number(order.total),
      currency: order.currency,
      customerName: relation(order.customer)?.display_name ?? null,
      date: order.created_at,
      expenseStatus: null,
      id: order.id,
      locationName: order.location_id ? locationNames.get(order.location_id) ?? null : null,
      paymentMethod: null,
      reference: order.order_number,
      type: "sale",
    })),
    ...payments.flatMap<AccountingActivity>((payment) => {
      const order = relation(payment.order);
      if (!order) return [];
      return [{
        amount: Number(payment.amount),
        currency: order.currency,
        customerName: relation(order.customer)?.display_name ?? null,
        date: payment.paid_at,
        expenseStatus: null,
        id: payment.id,
        locationName: order.location_id ? locationNames.get(order.location_id) ?? null : null,
        paymentMethod: payment.method,
        reference: order.order_number,
        type: payment.status === "refunded" ? "refund" : "payment",
      }];
    }),
    ...expenses.map<AccountingActivity>((expense) => ({
      amount: expense.grossAmount,
      currency: expense.currency,
      customerName: expense.supplierId ? supplierNames.get(expense.supplierId) ?? null : null,
      date: expense.expenseDate,
      expenseStatus: expense.status,
      id: expense.id,
      locationName: expense.locationId ? locationNames.get(expense.locationId) ?? null : null,
      paymentMethod: expense.paymentMethod,
      reference: expense.supplierReference || categoryNames.get(expense.categoryId) || expense.description,
      type: "expense",
    })),
  ].sort((left, right) => right.date.localeCompare(left.date) || left.type.localeCompare(right.type) || left.id.localeCompare(right.id));
}

export async function getAccountingWorkspace(
  locale: string,
  period: AccountingPeriod,
  locationId: string | null,
): Promise<AccountingWorkspaceData> {
  const context = await workspaceContext(locale);
  const [summary, expenseSummary, expenses, categories, suppliers] = await Promise.all([
    getAccountingSummary(locale, { locationId, paymentPeriod: period, salesPeriod: period }),
    getExpenseSummary(locale, period, locationId),
    listExpenses(locale, period, "all", locationId),
    listExpenseCategories(locale, true),
    listSuppliers(locale, true),
  ]);
  const activity = await activityForSummary(locale, summary, expenses, categories, suppliers, context.locations);
  return {
    activity,
    categories,
    defaultCurrency: context.defaultCurrency,
    expenseSummary,
    expenses,
    locations: context.locations,
    operational: buildOperationalCurrencySummaries(summary, expenseSummary),
    role: context.access.membership.role,
    summary,
    suppliers,
    timezone: context.access.membership.organization.timezone,
  };
}

export async function getAccountingPeriodContext(locale: string) {
  const context = await workspaceContext(locale);
  return {
    defaultCurrency: context.defaultCurrency,
    locations: context.locations,
    role: context.access.membership.role,
    timezone: context.access.membership.organization.timezone,
  };
}

export function periodUtcBounds(period: AccountingPeriod, timezone: string) {
  return accountingPeriodBounds(period, timezone);
}
