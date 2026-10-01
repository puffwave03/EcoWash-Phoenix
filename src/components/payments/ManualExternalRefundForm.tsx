"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/Button";
import type { ManualExternalRefundState } from "@/features/payments/server/manual-external-refund-actions";
import type { Payment } from "@/features/payments/types";

const initialState: ManualExternalRefundState = { fieldErrors: {}, formError: null, success: false };
const inputClass = "min-h-11 w-full rounded-control border border-border px-3 text-sm";

export type ManualExternalRefundText = {
  amount: string;
  closedDay: string;
  description: string;
  error: string;
  notes: string;
  notesRequired: string;
  reason: string;
  record: string;
  reference: string;
  referenceNotDistinct: string;
  required: string;
  saving: string;
  success: string;
};

export function ManualExternalRefundForm({
  action,
  payment,
  refundableAmount,
  text,
}: {
  action: (state: ManualExternalRefundState, formData: FormData) => Promise<ManualExternalRefundState>;
  payment: Payment;
  refundableAmount: number;
  text: ManualExternalRefundText;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const notesRequired = payment.method === "other";

  return (
    <form action={formAction} className="grid gap-2 border-t border-border pt-3">
      <p className="text-xs text-muted">{text.description}</p>
      <input name="paymentId" type="hidden" value={payment.id} />
      <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      <label className="space-y-1"><span>{text.amount}</span>
        <input className={inputClass} defaultValue={refundableAmount.toFixed(2)} max={refundableAmount} min="0.01" name="amount" required step="0.01" type="number" />
      </label>
      <label className="space-y-1"><span>{text.reason}</span>
        <input className={inputClass} maxLength={600} name="reason" required />
      </label>
      <label className="space-y-1"><span>{text.reference}</span>
        <input className={inputClass} maxLength={180} name="reference" required />
      </label>
      <label className="space-y-1"><span>{text.notes}{notesRequired ? ` · ${text.notesRequired}` : ""}</span>
        <input className={inputClass} maxLength={600} name="notes" required={notesRequired} />
      </label>
      <Button disabled={pending} type="submit" variant="secondary">{pending ? text.saving : text.record}</Button>
      {Object.keys(state.fieldErrors).length > 0 ? <p className="text-xs text-red-700" role="alert">{text.required}</p> : null}
      {state.formError ? <p className="text-xs text-red-700" role="alert">{state.formError === "closedDay" ? text.closedDay : state.formError === "referenceNotDistinct" ? text.referenceNotDistinct : text.error}</p> : null}
      {state.success ? <p className="text-xs text-green-700" role="status">{text.success}</p> : null}
    </form>
  );
}
