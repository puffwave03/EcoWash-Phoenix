import "server-only";

import type { AccountingPeriod } from "@/features/accounting/summary";
import { buildExpenseSummary, type ExpenseFact, type ExpenseStatus, type ExpenseSummary } from "@/features/accounting/expenses";
import type { Expense, ExpenseCategory, Supplier } from "@/features/accounting/expense-types";
import { requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DbError = { code?: string };
type PageResult<T> = PromiseLike<{ data: T[] | null; error: DbError | null }>;

type SupplierRow = {
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  country_code: string | null;
  display_name: string;
  email: string | null;
  fiscal_identifier: string | null;
  id: string;
  is_active: boolean;
  legal_name: string | null;
  notes: string | null;
  phone: string | null;
  postal_code: string | null;
};

type CategoryRow = {
  description: string | null;
  display_order: number;
  id: string;
  is_active: boolean;
  name: string;
};

type ExpenseRow = {
  category_id: string;
  currency: string;
  description: string;
  document_date: string | null;
  expense_date: string;
  gross_amount: number;
  id: string;
  location_id: string | null;
  notes: string | null;
  paid_date: string | null;
  payment_method: Expense["paymentMethod"];
  payment_status: Expense["paymentStatus"];
  status: ExpenseStatus;
  supplier_id: string | null;
  supplier_reference: string | null;
  tax_amount: number | null;
  tax_rate: number | null;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function pages<T>(query: (from: number, to: number) => PageResult<T>) {
  const result: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await query(from, from + size - 1);
    if (error) throw new Error(`expense_query_failed:${error.code ?? "unknown"}`);
    const rows = data ?? [];
    result.push(...rows);
    if (rows.length < size) return result;
  }
}

function validatePeriod(period: AccountingPeriod) {
  if (!DATE.test(period.startDate) || !DATE.test(period.endDateExclusive) || period.endDateExclusive <= period.startDate) {
    throw new Error("expense_period_invalid");
  }
}

function supplier(row: SupplierRow): Supplier {
  return {
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    countryCode: row.country_code,
    displayName: row.display_name,
    email: row.email,
    fiscalIdentifier: row.fiscal_identifier,
    id: row.id,
    isActive: row.is_active,
    legalName: row.legal_name,
    notes: row.notes,
    phone: row.phone,
    postalCode: row.postal_code,
  };
}

function category(row: CategoryRow): ExpenseCategory {
  return {
    description: row.description,
    displayOrder: row.display_order,
    id: row.id,
    isActive: row.is_active,
    name: row.name,
  };
}

function expense(row: ExpenseRow): Expense {
  return {
    categoryId: row.category_id,
    currency: row.currency,
    description: row.description,
    documentDate: row.document_date,
    expenseDate: row.expense_date,
    grossAmount: Number(row.gross_amount),
    id: row.id,
    locationId: row.location_id,
    notes: row.notes,
    paidDate: row.paid_date,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    status: row.status,
    supplierId: row.supplier_id,
    supplierReference: row.supplier_reference,
    taxAmount: row.tax_amount === null ? null : Number(row.tax_amount),
    taxRate: row.tax_rate === null ? null : Number(row.tax_rate),
  };
}

export async function listSuppliers(locale: string, includeInactive = false): Promise<Supplier[]> {
  const { membership } = await requireOwnerOrManager(locale);
  const supabase = await createSupabaseServerClient();
  const rows = await pages<SupplierRow>((from, to) => {
    let query = supabase.from("suppliers")
      .select("id, display_name, legal_name, fiscal_identifier, email, phone, address_line1, address_line2, city, postal_code, country_code, notes, is_active")
      .eq("organization_id", membership.organization.id).order("display_name").order("id").range(from, to);
    if (!includeInactive) query = query.eq("is_active", true);
    return query;
  });
  return rows.map(supplier);
}

export async function listExpenseCategories(locale: string, includeInactive = false): Promise<ExpenseCategory[]> {
  const { membership } = await requireOwnerOrManager(locale);
  const supabase = await createSupabaseServerClient();
  const rows = await pages<CategoryRow>((from, to) => {
    let query = supabase.from("expense_categories")
      .select("id, name, description, display_order, is_active")
      .eq("organization_id", membership.organization.id).order("display_order").order("name").order("id").range(from, to);
    if (!includeInactive) query = query.eq("is_active", true);
    return query;
  });
  return rows.map(category);
}

export async function listExpenses(
  locale: string,
  period: AccountingPeriod,
  status: ExpenseStatus | "all" = "all",
  locationId: string | null = null,
): Promise<Expense[]> {
  validatePeriod(period);
  const { membership } = await requireOwnerOrManager(locale);
  const organizationId = membership.organization.id;
  const supabase = await createSupabaseServerClient();
  if (locationId) {
    const { data, error } = await supabase.from("locations").select("id")
      .eq("organization_id", organizationId).eq("id", locationId).eq("is_active", true).is("deleted_at", null).maybeSingle();
    if (error || !data) throw new Error("expense_location_invalid");
  }
  const rows = await pages<ExpenseRow>((from, to) => {
    let query = supabase.from("expenses")
      .select("id, location_id, supplier_id, category_id, expense_date, description, gross_amount, currency, tax_amount, tax_rate, supplier_reference, document_date, payment_status, paid_date, payment_method, notes, status")
      .eq("organization_id", organizationId).gte("expense_date", period.startDate).lt("expense_date", period.endDateExclusive)
      .order("expense_date").order("id").range(from, to);
    if (status !== "all") query = query.eq("status", status);
    if (locationId) query = query.eq("location_id", locationId);
    return query;
  });
  return rows.map(expense);
}

export async function getExpenseSummary(
  locale: string,
  period: AccountingPeriod,
  locationId: string | null = null,
): Promise<ExpenseSummary> {
  const { membership } = await requireOwnerOrManager(locale);
  const [expenses, categories, suppliers] = await Promise.all([
    listExpenses(locale, period, "posted", locationId),
    listExpenseCategories(locale, true),
    listSuppliers(locale, true),
  ]);
  const supabase = await createSupabaseServerClient();
  const { data: locations, error } = await supabase.from("locations").select("id, name")
    .eq("organization_id", membership.organization.id).returns<{ id: string; name: string }[]>();
  if (error) throw new Error(`expense_query_failed:${error.code}`);
  const categoryNames = new Map(categories.map((value) => [value.id, value.name]));
  const supplierNames = new Map(suppliers.map((value) => [value.id, value.displayName]));
  const locationNames = new Map((locations ?? []).map((value) => [value.id, value.name]));
  const facts: ExpenseFact[] = expenses.map((value) => ({
    categoryId: value.categoryId,
    categoryName: categoryNames.get(value.categoryId) ?? "Unknown category",
    currency: value.currency,
    expenseDate: value.expenseDate,
    grossAmount: value.grossAmount,
    id: value.id,
    locationId: value.locationId,
    locationName: value.locationId ? locationNames.get(value.locationId) ?? null : null,
    status: value.status,
    supplierId: value.supplierId,
    supplierName: value.supplierId ? supplierNames.get(value.supplierId) ?? null : null,
    taxAmount: value.taxAmount,
  }));
  return buildExpenseSummary(facts, period, locationId, membership.organization.timezone);
}
