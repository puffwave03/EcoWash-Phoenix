"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button";
import type { Service, ServiceActionState } from "@/features/services/types";
import { formatNumberInput } from "@/lib/number-format";

type ServiceFormText = {
  amount: string;
  category: string;
  code: string;
  currency: string;
  description: string;
  error: string;
  name: string;
  unitTypes: Record<Service["unitType"], string>;
  save: string;
  saving: string;
  unitType: string;
  validFrom: string;
  validTo: string;
};

type ServiceFormProps = {
  action: (state: ServiceActionState, formData: FormData) => Promise<ServiceActionState>;
  service?: Service;
  text: ServiceFormText;
};

const initialState: ServiceActionState = { fieldErrors: {}, formError: null };

function fieldClass(hasError: boolean) {
  return `min-h-11 w-full rounded-control border bg-white px-3 text-sm text-foreground outline-none transition-standard focus:border-primary focus:ring-2 focus:ring-primary/20 ${
    hasError ? "border-red-300" : "border-border"
  }`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function ServiceForm({ action, service, text }: ServiceFormProps) {
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
          <span>{text.name}</span>
          <input aria-invalid={Boolean(state.fieldErrors.name)} className={fieldClass(Boolean(state.fieldErrors.name))} defaultValue={service?.name ?? ""} maxLength={160} name="name" required />
        </label>
        <label className="space-y-2 text-sm font-semibold text-primary">
          <span>{text.code}</span>
          <input className={fieldClass(false)} defaultValue={service?.code ?? ""} name="code" />
        </label>
        <label className="space-y-2 text-sm font-semibold text-primary">
          <span>{text.unitType}</span>
          <select className={fieldClass(Boolean(state.fieldErrors.unitType))} defaultValue={service?.unitType ?? "piece"} name="unitType">
            {Object.entries(text.unitTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold text-primary">
          <span>{text.category}</span>
          <input className={fieldClass(false)} defaultValue={service?.category ?? ""} name="category" />
        </label>
        <label className="space-y-2 text-sm font-semibold text-primary">
          <span>{text.amount}</span>
          <input className={fieldClass(Boolean(state.fieldErrors.amount))} defaultValue={formatNumberInput(service?.amount ?? 0, 2)} min="0" name="amount" step="0.01" type="number" />
        </label>
        <label className="space-y-2 text-sm font-semibold text-primary">
          <span>{text.currency}</span>
          <input className={fieldClass(Boolean(state.fieldErrors.currency))} defaultValue={service?.currency ?? "EUR"} name="currency" />
        </label>
        <label className="space-y-2 text-sm font-semibold text-primary">
          <span>{text.validFrom}</span>
          <input className={fieldClass(Boolean(state.fieldErrors.validFrom))} defaultValue={service?.validFrom ?? today()} name="validFrom" type="date" />
        </label>
        <label className="space-y-2 text-sm font-semibold text-primary">
          <span>{text.validTo}</span>
          <input className={fieldClass(Boolean(state.fieldErrors.validTo))} defaultValue={service?.validTo ?? ""} name="validTo" type="date" />
        </label>
      </div>

      <label className="space-y-2 text-sm font-semibold text-primary">
        <span>{text.description}</span>
        <textarea className="min-h-28 w-full rounded-control border border-border bg-white px-3 py-3 text-sm text-foreground outline-none transition-standard focus:border-primary focus:ring-2 focus:ring-primary/20" defaultValue={service?.description ?? ""} name="description" />
      </label>

      <input name="isActive" type="hidden" value={service?.isActive === false ? "false" : "true"} />
      <input name="priceIsFrom" type="hidden" value={service?.priceIsFrom ? "true" : "false"} />

      <Button disabled={isPending} type="submit">
        {isPending ? text.saving : text.save}
      </Button>
    </form>
  );
}
