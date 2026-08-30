import type { ExpensePaymentMethod, ExpensePaymentStatus } from "@/features/accounting/expenses";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PAYMENT_METHODS: ExpensePaymentMethod[] = ["bank_transfer", "card", "cash", "other"];

function raw(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function optional(formData: FormData, name: string, maximum: number) {
  const value = raw(formData, name);
  return value ? value.slice(0, maximum) : "";
}

function optionalUuid(value: string) {
  return !value || UUID.test(value);
}

function amount(value: string) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round((parsed + Number.EPSILON) * 100) / 100 : null;
}

export function parseSupplierForm(formData: FormData) {
  const fieldErrors: Record<string, string> = {};
  const displayName = raw(formData, "displayName");
  const countryCode = raw(formData, "countryCode").toUpperCase();
  if (!displayName || displayName.length > 160) fieldErrors.displayName = "invalid";
  if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) fieldErrors.countryCode = "invalid";
  return {
    fieldErrors,
    input: {
      addressLine1: optional(formData, "addressLine1", 200),
      addressLine2: optional(formData, "addressLine2", 200),
      city: optional(formData, "city", 120),
      countryCode,
      displayName,
      email: optional(formData, "email", 254).toLowerCase(),
      fiscalIdentifier: optional(formData, "fiscalIdentifier", 80),
      legalName: optional(formData, "legalName", 200),
      notes: optional(formData, "notes", 2000),
      phone: optional(formData, "phone", 80),
      postalCode: optional(formData, "postalCode", 40),
    },
    valid: Object.keys(fieldErrors).length === 0,
  };
}

export function parseExpenseCategoryForm(formData: FormData) {
  const fieldErrors: Record<string, string> = {};
  const name = raw(formData, "name");
  const displayOrder = Number(raw(formData, "displayOrder") || "0");
  if (!name || name.length > 120) fieldErrors.name = "invalid";
  if (!Number.isInteger(displayOrder) || displayOrder < 0 || displayOrder > 100000) fieldErrors.displayOrder = "invalid";
  return {
    fieldErrors,
    input: { description: optional(formData, "description", 1000), displayOrder, name },
    valid: Object.keys(fieldErrors).length === 0,
  };
}

export function parseExpenseForm(formData: FormData) {
  const fieldErrors: Record<string, string> = {};
  const categoryId = raw(formData, "categoryId");
  const locationId = raw(formData, "locationId");
  const supplierId = raw(formData, "supplierId");
  const expenseDate = raw(formData, "expenseDate");
  const documentDate = raw(formData, "documentDate");
  const description = raw(formData, "description");
  const grossAmount = amount(raw(formData, "grossAmount"));
  const currency = raw(formData, "currency").toUpperCase();
  const taxAmountInput = raw(formData, "taxAmount");
  const taxRateInput = raw(formData, "taxRate");
  const taxAmount = amount(taxAmountInput);
  const taxRate = taxRateInput ? Number(taxRateInput) : null;
  const paymentStatus = (raw(formData, "paymentStatus") || "unpaid") as ExpensePaymentStatus;
  const paidDate = raw(formData, "paidDate");
  const paymentMethod = raw(formData, "paymentMethod") as ExpensePaymentMethod | "";

  if (!UUID.test(categoryId)) fieldErrors.categoryId = "invalid";
  if (!optionalUuid(locationId)) fieldErrors.locationId = "invalid";
  if (!optionalUuid(supplierId)) fieldErrors.supplierId = "invalid";
  if (!DATE.test(expenseDate)) fieldErrors.expenseDate = "invalid";
  if (documentDate && !DATE.test(documentDate)) fieldErrors.documentDate = "invalid";
  if (!description || description.length > 500) fieldErrors.description = "invalid";
  if (grossAmount === null || grossAmount <= 0) fieldErrors.grossAmount = "invalid";
  if (!/^[A-Z]{3}$/.test(currency)) fieldErrors.currency = "invalid";
  if (Boolean(taxAmountInput) !== Boolean(taxRateInput)
    || (taxAmount !== null && (taxAmount < 0 || (grossAmount !== null && taxAmount > grossAmount)))
    || (taxRate !== null && (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100))) {
    fieldErrors.tax = "invalid";
  }
  if (!(["paid", "unpaid"] as string[]).includes(paymentStatus)) fieldErrors.paymentStatus = "invalid";
  if (paymentStatus === "paid" && (!DATE.test(paidDate) || !PAYMENT_METHODS.includes(paymentMethod as ExpensePaymentMethod))) fieldErrors.payment = "invalid";
  if (paymentStatus === "unpaid" && (paidDate || paymentMethod)) fieldErrors.payment = "invalid";

  return {
    fieldErrors,
    input: {
      categoryId,
      currency,
      description,
      documentDate,
      expenseDate,
      grossAmount: grossAmount ?? 0,
      locationId,
      notes: optional(formData, "notes", 2000),
      paidDate,
      paymentMethod,
      paymentStatus,
      supplierId,
      supplierReference: optional(formData, "supplierReference", 160),
      taxAmount,
      taxRate,
    },
    valid: Object.keys(fieldErrors).length === 0,
  };
}

export function validOptionalId(value: string | null) {
  return value === null || UUID.test(value);
}
