"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button";
import type { ActionState, Customer } from "@/features/customers/types";

type CustomerFormText = {
  active: string;
  alternatePhone: string;
  billingAddressLine1: string;
  billingAddressLine2: string;
  billingCity: string;
  billingCountryCode: string;
  billingPostalCode: string;
  business: string;
  companyName: string;
  customerCode: string;
  customerType: string;
  displayName: string;
  email: string;
  error: string;
  firstName: string;
  inactive: string;
  individual: string;
  lastName: string;
  notes: string;
  phone: string;
  preferredLocale: string;
  save: string;
  saving: string;
  taxId: string;
};

type CustomerFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  customer?: Customer;
  text: CustomerFormText;
};

const initialState: ActionState = { fieldErrors: {}, formError: null };

function fieldClass(hasError: boolean) {
  return `min-h-11 w-full rounded-control border bg-white px-3 text-sm text-foreground outline-none transition-standard focus:border-primary focus:ring-2 focus:ring-primary/20 ${
    hasError ? "border-red-300" : "border-border"
  }`;
}

function Field({
  defaultValue,
  error,
  label,
  name,
  type = "text",
  autoComplete,
}: {
  autoComplete?: string;
  defaultValue?: string | null;
  error?: string;
  label: string;
  name: string;
  type?: string;
}) {
  return (
    <label className="space-y-2 text-sm font-semibold text-primary">
      <span>{label}</span>
      <input
        autoComplete={autoComplete}
        className={fieldClass(Boolean(error))}
        defaultValue={defaultValue ?? ""}
        name={name}
        type={type}
      />
    </label>
  );
}

export function CustomerForm({ action, customer, text }: CustomerFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-6">
      {state.formError ? (
        <p className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {text.error}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold text-primary">
          <span>{text.customerType}</span>
          <select
            className={fieldClass(Boolean(state.fieldErrors.customerType))}
            defaultValue={customer?.customerType ?? "individual"}
            name="customerType"
          >
            <option value="individual">{text.individual}</option>
            <option value="business">{text.business}</option>
          </select>
        </label>
        <Field
          defaultValue={customer?.displayName}
          error={state.fieldErrors.displayName}
          label={text.displayName}
          name="displayName"
        />
        <Field defaultValue={customer?.customerCode} label={text.customerCode} name="customerCode" />
        <Field defaultValue={customer?.companyName} label={text.companyName} name="companyName" />
        <Field defaultValue={customer?.firstName} label={text.firstName} name="firstName" />
        <Field defaultValue={customer?.lastName} label={text.lastName} name="lastName" />
        <Field
          autoComplete="email"
          defaultValue={customer?.email}
          error={state.fieldErrors.email}
          label={text.email}
          name="email"
          type="email"
        />
        <Field autoComplete="tel" defaultValue={customer?.phone} error={state.fieldErrors.phone} label={text.phone} name="phone" />
        <Field autoComplete="tel" defaultValue={customer?.alternatePhone} error={state.fieldErrors.alternatePhone} label={text.alternatePhone} name="alternatePhone" />
        <Field defaultValue={customer?.taxId} label={text.taxId} name="taxId" />
        <Field autoComplete="address-line1" defaultValue={customer?.billingAddressLine1} label={text.billingAddressLine1} name="billingAddressLine1" />
        <Field autoComplete="address-line2" defaultValue={customer?.billingAddressLine2} label={text.billingAddressLine2} name="billingAddressLine2" />
        <Field defaultValue={customer?.billingCity} label={text.billingCity} name="billingCity" />
        <Field defaultValue={customer?.billingPostalCode} label={text.billingPostalCode} name="billingPostalCode" />
        <Field defaultValue={customer?.billingCountryCode ?? "ES"} error={state.fieldErrors.billingCountryCode} label={text.billingCountryCode} name="billingCountryCode" />
        <Field defaultValue={customer?.preferredLocale ?? "es"} error={state.fieldErrors.preferredLocale} label={text.preferredLocale} name="preferredLocale" />
      </div>

      <label className="space-y-2 text-sm font-semibold text-primary">
        <span>{text.notes}</span>
        <textarea
          className="min-h-28 w-full rounded-control border border-border bg-white px-3 py-3 text-sm text-foreground outline-none transition-standard focus:border-primary focus:ring-2 focus:ring-primary/20"
          defaultValue={customer?.notes ?? ""}
          name="notes"
        />
      </label>

      <input name="isActive" type="hidden" value={customer?.isActive === false ? "false" : "true"} />

      <Button disabled={isPending} type="submit">
        {isPending ? text.saving : text.save}
      </Button>
    </form>
  );
}
