"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { Expense, ExpenseActionState, ExpenseCategory, Supplier } from "@/features/accounting/expense-types";
import {
  saveExpenseAction,
  saveExpenseCategoryAction,
  saveSupplierAction,
  setExpenseCategoryActiveFormAction,
  setExpenseStatusFormAction,
  setSupplierActiveFormAction,
} from "@/features/accounting/server/expense-actions";
import type { AccountingLocation } from "@/features/accounting/server/workspace-queries";
import { formatCurrency } from "@/lib/number-format";

export type AccountingManagementText = {
  actions: { archive: string; create: string; edit: string; post: string; save: string; saving: string; void: string };
  categories: { description: string; displayOrder: string; empty: string; name: string; new: string; title: string };
  common: { archived: string; active: string; optional: string };
  expenses: {
    category: string; currency: string; description: string; documentDate: string; empty: string; expenseDate: string;
    gross: string; location: string; new: string; notes: string; paidDate: string; paymentMethod: string;
    paymentStatus: string; reference: string; supplier: string; taxAmount: string; taxRate: string; title: string;
  };
  form: { duplicate: string; generic: string; immutable: string; invalidReference: string; saved: string };
  methods: Record<"bank_transfer" | "card" | "cash" | "other", string>;
  paymentStatuses: Record<"paid" | "unpaid", string>;
  statuses: Record<"draft" | "posted" | "void", string>;
  suppliers: {
    address1: string; address2: string; city: string; country: string; displayName: string; email: string; empty: string;
    fiscalId: string; legalName: string; new: string; notes: string; phone: string; postalCode: string; title: string;
  };
};

type Action = (state: ExpenseActionState, formData: FormData) => Promise<ExpenseActionState>;
const initialState: ExpenseActionState = { fieldErrors: {}, formError: null, id: null, success: false };
const input = "min-h-11 w-full rounded-control border border-border bg-white px-3 text-sm text-foreground";

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return <button className="min-h-11 rounded-control bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={pending} type="submit">{pending ? pendingLabel : label}</button>;
}

function Result({ state, text }: { state: ExpenseActionState; text: AccountingManagementText["form"] }) {
  if (state.success) return <p className="text-sm font-semibold text-emerald-700" role="status">{text.saved}</p>;
  if (state.formError) return <p className="text-sm text-red-700" role="alert">{text[state.formError]}</p>;
  if (Object.keys(state.fieldErrors).length) return <p className="text-sm text-red-700" role="alert">{text.generic}</p>;
  return null;
}

function LifecycleForm({ action, confirm, label, text }: { action: Action; confirm?: string; label: string; text: AccountingManagementText }) {
  const [state, formAction] = useActionState(action, initialState);
  return <form action={formAction} className="flex flex-wrap items-center gap-2" onSubmit={(event) => { if (confirm && !window.confirm(confirm)) event.preventDefault(); }}><button className="min-h-11 rounded-control border border-amber-300 px-4 text-sm font-semibold text-amber-800" type="submit">{label}</button><Result state={state} text={text.form} /></form>;
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return <label className="space-y-1.5 text-sm font-semibold text-primary"><span>{label}</span>{children}</label>;
}

function ExpenseForm({ action, categories, defaultCurrency, expense, locations, suppliers, text }: {
  action: Action; categories: ExpenseCategory[]; defaultCurrency: string; expense?: Expense; locations: AccountingLocation[]; suppliers: Supplier[]; text: AccountingManagementText;
}) {
  const [state, formAction] = useActionState(action, initialState);
  return (
    <form action={formAction} className="mt-4 grid gap-4 rounded-card border border-border bg-[#fafcfa] p-4 sm:grid-cols-2 xl:grid-cols-4">
      <Field label={text.expenses.expenseDate}><input className={input} defaultValue={expense?.expenseDate} name="expenseDate" required type="date" /></Field>
      <Field label={text.expenses.category}><select className={input} defaultValue={expense?.categoryId ?? ""} name="categoryId" required><option disabled value="">—</option>{categories.filter((value) => value.isActive || value.id === expense?.categoryId).map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}</select></Field>
      <Field label={text.expenses.supplier}><select className={input} defaultValue={expense?.supplierId ?? ""} name="supplierId"><option value="">—</option>{suppliers.filter((value) => value.isActive || value.id === expense?.supplierId).map((value) => <option key={value.id} value={value.id}>{value.displayName}</option>)}</select></Field>
      <Field label={text.expenses.location}><select className={input} defaultValue={expense?.locationId ?? ""} name="locationId"><option value="">—</option>{locations.map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}</select></Field>
      <Field label={text.expenses.description}><input className={input} defaultValue={expense?.description} maxLength={500} name="description" required /></Field>
      <Field label={text.expenses.gross}><input className={input} defaultValue={expense?.grossAmount} min="0.01" name="grossAmount" required step="0.01" type="number" /></Field>
      <Field label={text.expenses.currency}><input className={`${input} uppercase`} defaultValue={expense?.currency ?? defaultCurrency} maxLength={3} minLength={3} name="currency" required /></Field>
      <Field label={text.expenses.reference}><input className={input} defaultValue={expense?.supplierReference ?? ""} maxLength={160} name="supplierReference" /></Field>
      <Field label={text.expenses.documentDate}><input className={input} defaultValue={expense?.documentDate ?? ""} name="documentDate" type="date" /></Field>
      <Field label={text.expenses.taxAmount}><input className={input} defaultValue={expense?.taxAmount ?? ""} min="0" name="taxAmount" step="0.01" type="number" /></Field>
      <Field label={text.expenses.taxRate}><input className={input} defaultValue={expense?.taxRate ?? ""} min="0" name="taxRate" step="0.0001" type="number" /></Field>
      <Field label={text.expenses.paymentStatus}><select className={input} defaultValue={expense?.paymentStatus ?? "unpaid"} name="paymentStatus">{Object.entries(text.paymentStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <Field label={text.expenses.paidDate}><input className={input} defaultValue={expense?.paidDate ?? ""} name="paidDate" type="date" /></Field>
      <Field label={text.expenses.paymentMethod}><select className={input} defaultValue={expense?.paymentMethod ?? ""} name="paymentMethod"><option value="">—</option>{Object.entries(text.methods).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <Field label={text.expenses.notes}><input className={input} defaultValue={expense?.notes ?? ""} maxLength={2000} name="notes" /></Field>
      <div className="flex flex-wrap items-end justify-between gap-3 sm:col-span-2 xl:col-span-4"><Result state={state} text={text.form} /><Submit label={text.actions.save} pendingLabel={text.actions.saving} /></div>
    </form>
  );
}

function SupplierForm({ action, supplier, text }: { action: Action; supplier?: Supplier; text: AccountingManagementText }) {
  const [state, formAction] = useActionState(action, initialState);
  return <form action={formAction} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <Field label={text.suppliers.displayName}><input className={input} defaultValue={supplier?.displayName} maxLength={160} name="displayName" required /></Field>
    <Field label={text.suppliers.legalName}><input className={input} defaultValue={supplier?.legalName ?? ""} name="legalName" /></Field>
    <Field label={text.suppliers.fiscalId}><input className={input} defaultValue={supplier?.fiscalIdentifier ?? ""} name="fiscalIdentifier" /></Field>
    <Field label={text.suppliers.email}><input className={input} defaultValue={supplier?.email ?? ""} name="email" type="email" /></Field>
    <Field label={text.suppliers.phone}><input className={input} defaultValue={supplier?.phone ?? ""} name="phone" /></Field>
    <Field label={text.suppliers.address1}><input className={input} defaultValue={supplier?.addressLine1 ?? ""} name="addressLine1" /></Field>
    <Field label={text.suppliers.address2}><input className={input} defaultValue={supplier?.addressLine2 ?? ""} name="addressLine2" /></Field>
    <Field label={text.suppliers.city}><input className={input} defaultValue={supplier?.city ?? ""} name="city" /></Field>
    <Field label={text.suppliers.postalCode}><input className={input} defaultValue={supplier?.postalCode ?? ""} name="postalCode" /></Field>
    <Field label={text.suppliers.country}><input className={`${input} uppercase`} defaultValue={supplier?.countryCode ?? ""} maxLength={2} name="countryCode" /></Field>
    <Field label={text.suppliers.notes}><input className={input} defaultValue={supplier?.notes ?? ""} name="notes" /></Field>
    <div className="flex flex-wrap items-end justify-between gap-3 sm:col-span-2 lg:col-span-3"><Result state={state} text={text.form} /><Submit label={text.actions.save} pendingLabel={text.actions.saving} /></div>
  </form>;
}

function CategoryForm({ action, category, text }: { action: Action; category?: ExpenseCategory; text: AccountingManagementText }) {
  const [state, formAction] = useActionState(action, initialState);
  return <form action={formAction} className="mt-3 grid gap-3 sm:grid-cols-[minmax(10rem,1fr)_minmax(7rem,0.25fr)_auto] sm:items-end">
    <Field label={text.categories.name}><input className={input} defaultValue={category?.name} maxLength={120} name="name" required /></Field>
    <Field label={text.categories.displayOrder}><input className={input} defaultValue={category?.displayOrder ?? 0} min={0} name="displayOrder" type="number" /></Field>
    <input name="description" type="hidden" value={category?.description ?? ""} />
    <Submit label={text.actions.save} pendingLabel={text.actions.saving} />
    <div className="sm:col-span-3"><Result state={state} text={text.form} /></div>
  </form>;
}

export function AccountingManagement({ categories, defaultCurrency, expenses, locale, locations, role, suppliers, text }: {
  categories: ExpenseCategory[]; defaultCurrency: string; expenses: Expense[]; locale: string; locations: AccountingLocation[]; role: "owner" | "manager"; suppliers: Supplier[]; text: AccountingManagementText;
}) {
  const owner = role === "owner";
  return <div className="space-y-5">
    <section className="rounded-card border border-border bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold text-primary">{text.expenses.title}</h2><span className="rounded-full bg-primary-soft px-3 py-1 text-sm font-semibold text-primary">{expenses.length}</span></div>
      <details><summary className="mt-4 inline-flex min-h-11 cursor-pointer list-none items-center rounded-control bg-primary px-4 text-sm font-semibold text-white">{text.expenses.new}</summary><ExpenseForm action={saveExpenseAction.bind(null, locale, null)} categories={categories} defaultCurrency={defaultCurrency} locations={locations} suppliers={suppliers} text={text} /></details>
      {expenses.length === 0 ? <p className="mt-4 rounded-card border border-dashed border-border p-5 text-center text-sm text-muted">{text.expenses.empty}</p> : <div className="mt-4 divide-y divide-border">{expenses.map((expense) => <article className="py-4" key={expense.id}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-foreground">{expense.description}</p><p className="mt-1 text-xs text-muted">{expense.expenseDate} · {text.statuses[expense.status]}</p></div><p className="font-semibold tabular-nums text-primary">{formatCurrency(expense.grossAmount, expense.currency, locale)}</p></div>
        <div className="mt-3 flex flex-wrap gap-2">
          {expense.status === "draft" ? <><details className="w-full"><summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-control border border-border px-4 text-sm font-semibold text-primary">{text.actions.edit}</summary><ExpenseForm action={saveExpenseAction.bind(null, locale, expense.id)} categories={categories} defaultCurrency={defaultCurrency} expense={expense} locations={locations} suppliers={suppliers} text={text} /></details><LifecycleForm action={setExpenseStatusFormAction.bind(null, locale, expense.id, "posted")} label={text.actions.post} text={text} /></> : null}
          {expense.status === "posted" ? <LifecycleForm action={setExpenseStatusFormAction.bind(null, locale, expense.id, "void")} confirm={text.actions.void} label={text.actions.void} text={text} /> : null}
        </div>
      </article>)}</div>}
    </section>

    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-card border border-border bg-white p-4 shadow-sm sm:p-5"><h2 className="text-xl font-semibold text-primary">{text.suppliers.title}</h2>
        {owner ? <details><summary className="mt-3 inline-flex min-h-11 cursor-pointer list-none items-center rounded-control border border-primary px-4 text-sm font-semibold text-primary">{text.suppliers.new}</summary><SupplierForm action={saveSupplierAction.bind(null, locale, null)} text={text} /></details> : null}
        {suppliers.length === 0 ? <p className="mt-4 text-sm text-muted">{text.suppliers.empty}</p> : <div className="mt-4 divide-y divide-border">{suppliers.map((supplier) => <article className="py-3" key={supplier.id}><div className="flex items-center justify-between gap-3"><div><p className="font-semibold">{supplier.displayName}</p><p className="text-xs text-muted">{supplier.isActive ? text.common.active : text.common.archived}</p></div>{owner && supplier.isActive ? <LifecycleForm action={setSupplierActiveFormAction.bind(null, locale, supplier.id, false)} label={text.actions.archive} text={text} /> : null}</div>{owner && supplier.isActive ? <details><summary className="mt-2 cursor-pointer text-sm font-semibold text-primary">{text.actions.edit}</summary><SupplierForm action={saveSupplierAction.bind(null, locale, supplier.id)} supplier={supplier} text={text} /></details> : null}</article>)}</div>}
      </section>

      <section className="rounded-card border border-border bg-white p-4 shadow-sm sm:p-5"><h2 className="text-xl font-semibold text-primary">{text.categories.title}</h2>
        {owner ? <details><summary className="mt-3 inline-flex min-h-11 cursor-pointer list-none items-center rounded-control border border-primary px-4 text-sm font-semibold text-primary">{text.categories.new}</summary><CategoryForm action={saveExpenseCategoryAction.bind(null, locale, null)} text={text} /></details> : null}
        {categories.length === 0 ? <p className="mt-4 text-sm text-muted">{text.categories.empty}</p> : <div className="mt-4 divide-y divide-border">{categories.map((category) => <article className="py-3" key={category.id}><div className="flex items-center justify-between gap-3"><div><p className="font-semibold">{category.name}</p><p className="text-xs text-muted">{text.categories.displayOrder} {category.displayOrder} · {category.isActive ? text.common.active : text.common.archived}</p></div>{owner && category.isActive ? <LifecycleForm action={setExpenseCategoryActiveFormAction.bind(null, locale, category.id, false)} label={text.actions.archive} text={text} /> : null}</div>{owner && category.isActive ? <details><summary className="mt-2 cursor-pointer text-sm font-semibold text-primary">{text.actions.edit}</summary><CategoryForm action={saveExpenseCategoryAction.bind(null, locale, category.id)} category={category} text={text} /></details> : null}</article>)}</div>}
      </section>
    </div>
  </div>;
}
