"use client";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Link } from "@/i18n/navigation";
import type {
  Payment,
  PaymentActionState,
  PaymentMethod,
  PaymentRecordStatus,
  PaymentSummary,
} from "@/features/payments/types";
import { formatCurrency } from "@/lib/number-format";

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
  canRecord: boolean;
  currency: string;
  locale: string;
  payments: Payment[];
  posHref: string;
  summary: PaymentSummary;
  text: PaymentsPanelText;
};

export function PaymentsPanel({
  actions,
  canManageCorrections,
  canRecord,
  currency,
  locale,
  payments,
  posHref,
  summary,
  text,
}: PaymentsPanelProps) {
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

      {canRecord && summary.balanceDue > 0 ? (
        <Link className="inline-flex" href={posHref} locale={locale}>
          <Button>{text.record}</Button>
        </Link>
      ) : null}

      <div className="divide-y divide-border overflow-hidden rounded-card border border-border">
        {payments.length === 0 ? (
          <p className="p-4 text-sm text-muted">{text.empty}</p>
        ) : payments.map((payment) => (
          <div className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_1fr_1fr] md:items-start" key={payment.id}>
            <div>
              <p className="font-semibold text-primary">{formatCurrency(payment.amount, currency, locale)}</p>
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
