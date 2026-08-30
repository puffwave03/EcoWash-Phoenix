"use server";

import { revalidatePath } from "next/cache";
import type { ExpenseStatus } from "@/features/accounting/expenses";
import type { ExpenseActionState } from "@/features/accounting/expense-types";
import {
  parseExpenseCategoryForm,
  parseExpenseForm,
  parseSupplierForm,
  validOptionalId,
} from "@/features/accounting/expense-validation";
import { requireOwner, requireOwnerOrManager } from "@/lib/auth/require-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const initialState: ExpenseActionState = { fieldErrors: {}, formError: null, id: null, success: false };

function fail(
  fieldErrors: Record<string, string> = {},
  formError: ExpenseActionState["formError"] = null,
): ExpenseActionState {
  return { fieldErrors, formError, id: null, success: false };
}

function errorState(error: { code?: string; message?: string } | null) {
  if (error?.code === "23505") return fail({}, "duplicate");
  if (error?.code === "55000") return fail({}, "immutable");
  if (error?.code === "22023" || error?.code === "P0002") return fail({}, "invalidReference");
  return fail({}, "generic");
}

function revalidateAccounting(locale: string) {
  revalidatePath(`/${locale}/app/accounting`);
}

export async function saveSupplierAction(
  locale: string,
  supplierId: string | null,
  _state: ExpenseActionState = initialState,
  formData: FormData,
): Promise<ExpenseActionState> {
  void _state;
  if (!validOptionalId(supplierId)) return fail({ supplierId: "invalid" });
  const parsed = parseSupplierForm(formData);
  if (!parsed.valid) return fail(parsed.fieldErrors);
  await requireOwner(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("save_supplier", {
    target_address_line1: parsed.input.addressLine1 || null,
    target_address_line2: parsed.input.addressLine2 || null,
    target_city: parsed.input.city || null,
    target_country_code: parsed.input.countryCode || null,
    target_display_name: parsed.input.displayName,
    target_email: parsed.input.email || null,
    target_fiscal_identifier: parsed.input.fiscalIdentifier || null,
    target_legal_name: parsed.input.legalName || null,
    target_notes: parsed.input.notes || null,
    target_phone: parsed.input.phone || null,
    target_postal_code: parsed.input.postalCode || null,
    target_supplier_id: supplierId,
  });
  if (error || !data) return errorState(error);
  revalidateAccounting(locale);
  return { ...initialState, id: String(data), success: true };
}

export async function setSupplierActiveAction(locale: string, supplierId: string, isActive: boolean) {
  if (!validOptionalId(supplierId)) return fail({ supplierId: "invalid" });
  await requireOwner(locale);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_supplier_active", {
    target_is_active: isActive,
    target_supplier_id: supplierId,
  });
  if (error) return errorState(error);
  revalidateAccounting(locale);
  return { ...initialState, id: supplierId, success: true };
}

export async function saveExpenseCategoryAction(
  locale: string,
  categoryId: string | null,
  _state: ExpenseActionState = initialState,
  formData: FormData,
): Promise<ExpenseActionState> {
  void _state;
  if (!validOptionalId(categoryId)) return fail({ categoryId: "invalid" });
  const parsed = parseExpenseCategoryForm(formData);
  if (!parsed.valid) return fail(parsed.fieldErrors);
  await requireOwner(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("save_expense_category", {
    target_category_id: categoryId,
    target_description: parsed.input.description || null,
    target_display_order: parsed.input.displayOrder,
    target_name: parsed.input.name,
  });
  if (error || !data) return errorState(error);
  revalidateAccounting(locale);
  return { ...initialState, id: String(data), success: true };
}

export async function setExpenseCategoryActiveAction(locale: string, categoryId: string, isActive: boolean) {
  if (!validOptionalId(categoryId)) return fail({ categoryId: "invalid" });
  await requireOwner(locale);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_expense_category_active", {
    target_category_id: categoryId,
    target_is_active: isActive,
  });
  if (error) return errorState(error);
  revalidateAccounting(locale);
  return { ...initialState, id: categoryId, success: true };
}

export async function saveExpenseAction(
  locale: string,
  expenseId: string | null,
  _state: ExpenseActionState = initialState,
  formData: FormData,
): Promise<ExpenseActionState> {
  void _state;
  if (!validOptionalId(expenseId)) return fail({ expenseId: "invalid" });
  const parsed = parseExpenseForm(formData);
  if (!parsed.valid) return fail(parsed.fieldErrors);
  await requireOwnerOrManager(locale);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("save_expense", {
    target_category_id: parsed.input.categoryId,
    target_currency: parsed.input.currency,
    target_description: parsed.input.description,
    target_document_date: parsed.input.documentDate || null,
    target_expense_date: parsed.input.expenseDate,
    target_expense_id: expenseId,
    target_gross_amount: parsed.input.grossAmount,
    target_location_id: parsed.input.locationId || null,
    target_notes: parsed.input.notes || null,
    target_paid_date: parsed.input.paidDate || null,
    target_payment_method: parsed.input.paymentMethod || null,
    target_payment_status: parsed.input.paymentStatus,
    target_supplier_id: parsed.input.supplierId || null,
    target_supplier_reference: parsed.input.supplierReference || null,
    target_tax_amount: parsed.input.taxAmount,
    target_tax_rate: parsed.input.taxRate,
  });
  if (error || !data) return errorState(error);
  revalidateAccounting(locale);
  return { ...initialState, id: String(data), success: true };
}

export async function setExpenseStatusAction(locale: string, expenseId: string, status: Extract<ExpenseStatus, "posted" | "void">) {
  if (!validOptionalId(expenseId)) return fail({ expenseId: "invalid" });
  await requireOwnerOrManager(locale);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_expense_status", {
    target_expense_id: expenseId,
    target_status: status,
  });
  if (error) return errorState(error);
  revalidateAccounting(locale);
  return { ...initialState, id: expenseId, success: true };
}
