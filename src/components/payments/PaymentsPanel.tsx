"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type {
  Payment,
  PaymentActionState,
  PaymentMethod,
  PaymentRecordStatus,
  PaymentSummary,
} from "@/features/payments/types";

type PaymentsPanelText = {
  actor: string;
  amount: string;
  balanceDue: string;
  date: string;
  empty: string;
  error: string;
  method: string;
  methods: Record<PaymentMethod, string>;
  notes: string;
  paidAt: string;
  paymentStatus: string;
  proof: string;
  record: string;
  reference: string;
  refund: string;
  refundReason: string;
  saving: string;
  statuses: Record<PaymentRecordStatus | PaymentSummary["paymentStatus"], string>;
  title: string;
  totalDue: string;
  totalPaid: string;
  void: string;
  voidReason: string;
};

type PaymentsPanelProps = {
  actions: {
    record: (state: PaymentActionState, formData: FormData) => Promise<PaymentActionState>;
    refund: (paymentId: string, formData: FormData) => Promise<void>;
    void: (paymentId: string, formData: FormData) => Promise<void>;
  };
  canManageCorrections: boolean;
  currency: string;
  locale: string;
  payments: Payment[];
  summary: PaymentSummary;
  text: PaymentsPanelText;
};

const initialState: PaymentActionState = { fieldErrors: {}, formError: null };

function fieldClass(hasError = false) {
  return `min-h-11 w-full rounded-control border bg-white px-3 text-sm text-foreground outline-none transition-standard focus:border-primary focus:ring-2 focus:ring-primary/20 ${
    hasError ? "border-red-300" : "border-border"
  }`;
}

function formatMoney(amount: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, { currency, style: "currency" }).format(amount);
}

export function PaymentsPanel({
  actions,
  canManageCorrections,
  currency,
  locale,
  payments,
  summary,
  text,
}: PaymentsPanelProps) {
  const [state, formAction, isPending] = useActionState(actions.record, initialState);

  return (
    <Card className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-primary">{text.title}</h3>
          <p className="mt-1 text-sm text-muted">{text.paymentStatus}: {text.statuses[summary.paymentStatus]}</p>
        </div>
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div><dt className="text-muted">{text.totalDue}</dt><dd className="font-semibold text-primary">{formatMoney(summary.totalDue, currency, locale)}</dd></div>
          <div><dt className="text-muted">{text.totalPaid}</dt><dd className="font-semibold text-primary">{formatMoney(summary.totalPaid, currency, locale)}</dd></div>
          <div><dt className="text-muted">{text.balanceDue}</dt><dd className="font-semibold text-primary">{formatMoney(summary.balanceDue, currency, locale)}</dd></div>
        </dl>
      </div>

      <form action={formAction} className="grid gap-3 md:grid-cols-[8rem_1fr_1fr_1fr_auto] md:items-end">
        {state.formError ? <p className="md:col-span-5 rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{text.error}</p> : null}
        <label className="space-y-2 text-sm font-semibold text-primary">
          <span>{text.amount}</span>
          <input className={fieldClass(Boolean(state.fieldErrors.amount))} max={summary.balanceDue || undefined} min="0.01" name="amount" step="0.01" type="number" />
        </label>
        <label className="space-y-2 text-sm font-semibold text-primary">
          <span>{text.method}</span>
          <select className={fieldClass(Boolean(state.fieldErrors.method))} name="method">
            <option value="cash">{text.methods.cash}</option>
            <option value="card">{text.methods.card}</option>
            <option value="bank_transfer">{text.methods.bank_transfer}</option>
            <option value="other">{text.methods.other}</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold text-primary">
          <span>{text.paidAt}</span>
          <input className={fieldClass(Boolean(state.fieldErrors.paidAt))} name="paidAt" type="datetime-local" />
        </label>
        <label className="space-y-2 text-sm font-semibold text-primary">
          <span>{text.reference}</span>
          <input className={fieldClass()} name="reference" />
        </label>
        <input name="notes" type="hidden" />
        <input name="proofPhotoId" type="hidden" />
        <Button disabled={isPending || summary.balanceDue <= 0} type="submit">{isPending ? text.saving : text.record}</Button>
      </form>

      <div className="divide-y divide-border overflow-hidden rounded-card border border-border">
        {payments.length === 0 ? (
          <p className="p-4 text-sm text-muted">{text.empty}</p>
        ) : payments.map((payment) => (
          <div className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_1fr_1fr] md:items-start" key={payment.id}>
            <div>
              <p className="font-semibold text-primary">{formatMoney(payment.amount, currency, locale)}</p>
              <p className="text-sm text-muted">{text.methods[payment.method]} · {text.statuses[payment.status]}</p>
            </div>
            <p className="text-sm text-muted">{text.date}: {new Date(payment.paidAt).toLocaleString(locale)}</p>
            <p className="text-sm text-muted">{text.reference}: {payment.reference || "-"}</p>
            <div className="space-y-2 text-sm text-muted">
              <p>{text.actor}: {payment.recordedByName || "-"}</p>
              {canManageCorrections && payment.status === "confirmed" ? (
                <div className="flex flex-col gap-2">
                  <form action={actions.void.bind(null, payment.id)} className="flex gap-2">
                    <input className="min-h-11 min-w-0 rounded-control border border-border px-3 text-sm" name="reason" placeholder={text.voidReason} required />
                    <Button type="submit" variant="secondary">{text.void}</Button>
                  </form>
                  <form action={actions.refund.bind(null, payment.id)} className="flex gap-2">
                    <input className="min-h-11 w-24 rounded-control border border-border px-3 text-sm" min="0.01" name="amount" step="0.01" type="number" />
                    <input className="min-h-11 min-w-0 rounded-control border border-border px-3 text-sm" name="reason" placeholder={text.refundReason} required />
                    <Button type="submit" variant="secondary">{text.refund}</Button>
                  </form>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
