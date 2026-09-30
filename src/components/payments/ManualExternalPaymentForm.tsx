"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/Button";
import { DisclosureSection } from "@/components/DisclosureSection";
import type { ManualExternalPaymentState } from "@/features/payments/server/manual-external-actions";

const initialState: ManualExternalPaymentState = { fieldErrors: {}, formError: null, success: false };
const inputClass = "min-h-11 w-full rounded-control border border-border px-3 text-sm";

export type ManualExternalPaymentText = {
  amount: string;
  bankTransfer: string;
  closedDay: string;
  error: string;
  method: string;
  notes: string;
  notesRequired: string;
  other: string;
  record: string;
  reference: string;
  required: string;
  saving: string;
  success: string;
  title: string;
};

export function ManualExternalPaymentForm({ action, balanceDue, text }: {
  action: (state: ManualExternalPaymentState, formData: FormData) => Promise<ManualExternalPaymentState>;
  balanceDue: number;
  text: ManualExternalPaymentText;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [method, setMethod] = useState<"bank_transfer" | "other">("bank_transfer");

  return (
    <DisclosureSection defaultOpen={false} summary={text.record} title={text.title}>
      <form action={formAction} className="grid gap-3 sm:grid-cols-2">
        <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
        <label className="space-y-1 text-sm font-medium"><span>{text.amount}</span>
          <input className={inputClass} defaultValue={balanceDue.toFixed(2)} max={balanceDue} min="0.01" name="amount" required step="0.01" type="number" />
        </label>
        <label className="space-y-1 text-sm font-medium"><span>{text.method}</span>
          <select className={inputClass} name="method" onChange={(event) => setMethod(event.target.value as "bank_transfer" | "other")} value={method}>
            <option value="bank_transfer">{text.bankTransfer}</option>
            <option value="other">{text.other}</option>
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium"><span>{text.reference}</span>
          <input className={inputClass} maxLength={180} name="reference" required />
        </label>
        <label className="space-y-1 text-sm font-medium"><span>{text.notes}{method === "other" ? ` · ${text.notesRequired}` : ""}</span>
          <input className={inputClass} maxLength={600} name="notes" required={method === "other"} />
        </label>
        <div className="space-y-2 sm:col-span-2">
          <Button disabled={pending} type="submit">{pending ? text.saving : text.record}</Button>
          {state.fieldErrors.amount || state.fieldErrors.method || state.fieldErrors.reference || state.fieldErrors.notes ? <p className="text-sm text-red-700" role="alert">{text.required}</p> : null}
          {state.formError ? <p className="text-sm text-red-700" role="alert">{state.formError === "closedDay" ? text.closedDay : text.error}</p> : null}
          {state.success ? <p className="text-sm text-green-700" role="status">{text.success}</p> : null}
        </div>
      </form>
    </DisclosureSection>
  );
}
