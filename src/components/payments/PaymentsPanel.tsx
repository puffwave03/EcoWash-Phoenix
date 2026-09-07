"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { DisclosureSection } from "@/components/DisclosureSection";
import { Link } from "@/i18n/navigation";
import type {
  Payment,
  PaymentMethod,
  PaymentRecordStatus,
  PaymentSummary,
} from "@/features/payments/types";
import { getNetCollected, getRefundableAmount } from "@/features/payments/refunds";
import type { PosActionState } from "@/features/pos/types";
import { formatCurrency } from "@/lib/number-format";

type RefundAction = (state: PosActionState, formData: FormData) => Promise<PosActionState>;

const initialRefundState: PosActionState = { fieldErrors: {}, formError: null, success: false };
const inputClass = "min-h-11 min-w-0 rounded-control border border-border px-3 text-sm";

type PaymentsPanelText = {
  actor: string;
  amount: string;
  balanceDue: string;
  cancelledPaidWarning: string;
  cashRefundRequiresTill: string;
  date: string;
  empty: string;
  error: string;
  history: string;
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
  refundSuccess: string;
  saving: string;
  statuses: Record<PaymentRecordStatus | PaymentSummary["paymentStatus"], string>;
  title: string;
  totalDue: string;
  totalPaid: string;
};

type PaymentsPanelProps = {
  actions: {
    refund: RefundAction;
  };
  canManageCorrections: boolean;
  canRecord: boolean;
  currency: string;
  isOrderCancelled: boolean;
  locale: string;
  orderId: string;
  payments: Payment[];
  posHref: string;
  summary: PaymentSummary;
  text: PaymentsPanelText;
  posSessionId: string | null;
};

function RefundForm({
  action,
  cashRequiresSession,
  orderId,
  payment,
  refundableAmount,
  sessionId,
  text,
}: {
  action: RefundAction;
  cashRequiresSession: boolean;
  orderId: string;
  payment: Payment;
  refundableAmount: number;
  sessionId: string | null;
  text: PaymentsPanelText;
}) {
  const [state, formAction, pending] = useActionState(action, initialRefundState);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  return (
    <form action={formAction} className="grid gap-2">
      <input name="orderId" type="hidden" value={orderId} />
      <input name="paymentId" type="hidden" value={payment.id} />
      <input name="sessionId" type="hidden" value={sessionId ?? ""} />
      <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          aria-label={text.amount}
          className={`${inputClass} w-28`}
          defaultValue={refundableAmount.toFixed(2)}
          max={refundableAmount}
          min="0.01"
          name="amount"
          required
          step="0.01"
          type="number"
        />
        <input aria-label={text.refundReason} className={inputClass} name="reason" placeholder={text.refundReason} required />
        <Button disabled={pending || cashRequiresSession} type="submit" variant="secondary">{pending ? text.saving : text.refund}</Button>
      </div>
      {cashRequiresSession ? <p className="text-xs font-medium text-amber-800">{text.cashRefundRequiresTill}</p> : null}
      {state.formError ? <p className="text-xs font-medium text-red-700">{text.error}</p> : null}
      {state.success ? <p className="text-xs font-medium text-green-700">{text.refundSuccess}</p> : null}
    </form>
  );
}

export function PaymentsPanel({
  actions,
  canManageCorrections,
  canRecord,
  currency,
  isOrderCancelled,
  locale,
  orderId,
  payments,
  posHref,
  posSessionId,
  summary,
  text,
}: PaymentsPanelProps) {
  const netCollected = getNetCollected(payments);

  return (
    <Card className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-primary">{text.title}</h3>
          <p className="mt-1 text-sm text-muted">{text.paymentStatus}: {text.statuses[summary.paymentStatus]}</p>
        </div>
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div><dt className="text-muted">{text.totalDue}</dt><dd className="font-semibold text-primary">{formatCurrency(summary.totalDue, currency, locale)}</dd></div>
          <div><dt className="text-muted">{text.totalPaid}</dt><dd className="font-semibold text-primary">{formatCurrency(summary.totalPaid, currency, locale)}</dd></div>
          <div><dt className="text-muted">{text.balanceDue}</dt><dd className="font-semibold text-primary">{formatCurrency(summary.balanceDue, currency, locale)}</dd></div>
        </dl>
      </div>

      {isOrderCancelled && netCollected > 0 ? (
        <p className="rounded-control border border-amber-300 bg-amber-50 px-4 py-3 font-semibold text-amber-950" role="alert">
          {text.cancelledPaidWarning.replace("{amount}", formatCurrency(netCollected, currency, locale))}
        </p>
      ) : null}

      {canRecord && summary.balanceDue > 0 ? (
        <Link className="inline-flex" href={posHref} locale={locale}>
          <Button>{text.record}</Button>
        </Link>
      ) : null}

      <DisclosureSection
        count={payments.length}
        defaultOpen={payments.length <= 3}
        summary={payments[0]
          ? `${new Date(payments[0].paidAt).toLocaleString(locale)} · ${formatCurrency(payments[0].amount, currency, locale)}`
          : text.empty}
        title={text.history}
      >
        <div className="divide-y divide-border overflow-hidden rounded-card border border-border">
          {payments.length === 0 ? (
            <p className="p-4 text-sm text-muted">{text.empty}</p>
          ) : payments.map((payment) => {
            const refundableAmount = getRefundableAmount(payment, payments);
            const cashRequiresSession = payment.method === "cash" && !posSessionId;
            return (
            <div className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_1fr_1fr] md:items-start" key={payment.id}>
              <div>
                <p className="font-semibold text-primary">{formatCurrency(payment.amount, currency, locale)}</p>
                <p className="text-sm text-muted">{text.methods[payment.method]} · {text.statuses[payment.status]}</p>
              </div>
              <p className="text-sm text-muted">{text.date}: {new Date(payment.paidAt).toLocaleString(locale)}</p>
              <p className="text-sm text-muted">{text.reference}: {payment.reference || "-"}</p>
              <div className="space-y-2 text-sm text-muted">
                <p>{text.actor}: {payment.recordedByName || "-"}</p>
                {canManageCorrections && refundableAmount > 0 ? (
                  <RefundForm
                    action={actions.refund}
                    cashRequiresSession={cashRequiresSession}
                    key={`${payment.id}:${refundableAmount}`}
                    orderId={orderId}
                    payment={payment}
                    refundableAmount={refundableAmount}
                    sessionId={posSessionId}
                    text={text}
                  />
                ) : null}
              </div>
            </div>
            );
          })}
        </div>
      </DisclosureSection>
    </Card>
  );
}
