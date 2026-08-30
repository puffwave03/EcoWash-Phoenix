import type { ExpensePaymentMethod, ExpensePaymentStatus, ExpenseStatus } from "@/features/accounting/expenses";

export type Supplier = {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  countryCode: string | null;
  displayName: string;
  email: string | null;
  fiscalIdentifier: string | null;
  id: string;
  isActive: boolean;
  legalName: string | null;
  notes: string | null;
  phone: string | null;
  postalCode: string | null;
};

export type ExpenseCategory = {
  description: string | null;
  displayOrder: number;
  id: string;
  isActive: boolean;
  name: string;
};

export type Expense = {
  categoryId: string;
  currency: string;
  description: string;
  documentDate: string | null;
  expenseDate: string;
  grossAmount: number;
  id: string;
  locationId: string | null;
  notes: string | null;
  paidDate: string | null;
  paymentMethod: ExpensePaymentMethod | null;
  paymentStatus: ExpensePaymentStatus;
  status: ExpenseStatus;
  supplierId: string | null;
  supplierReference: string | null;
  taxAmount: number | null;
  taxRate: number | null;
};

export type ExpenseActionState = {
  fieldErrors: Record<string, string>;
  formError: "duplicate" | "generic" | "immutable" | "invalidReference" | null;
  id: string | null;
  success: boolean;
};
