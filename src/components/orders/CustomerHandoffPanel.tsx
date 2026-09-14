"use client";

import { Button } from "@/components/Button";
import type { CustomerHandoff } from "@/features/handoffs/types";
import { formatCurrency } from "@/lib/number-format";
import { formatOrganizationDateTime } from "@/lib/organization-timezone";

export type CustomerHandoffText = {
  acknowledgement: string;
  balanceAtHandoff: string;
  completeAction: string;
  completedAt: string;
  confirmation: string;
  currentOperator: string;
  currentTime: string;
  notes: string;
  notesPlaceholder: string;
  operator: string;
  order: string;
  readOnlyTitle: string;
  title: string;
  unpaidAcknowledged: string;
  unpaidWarning: string;
};

export function CustomerHandoffPanel({
  action,
  balanceDue,
  canComplete,
  currency,
  currentOperator,
  currentTime,
  customerName,
  handoff,
  locale,
  orderNumber,
  text,
  timeZone,
}: {
  action: (formData: FormData) => Promise<void>;
  balanceDue: number;
  canComplete: boolean;
  currency: string;
  currentOperator: string;
  currentTime: string;
  customerName: string;
  handoff: CustomerHandoff | null;
  locale: string;
  orderNumber: string;
  text: CustomerHandoffText;
  timeZone: string;
}) {
  if (handoff) {
    return (
      <div className="rounded-card border border-emerald-200 bg-emerald-50 p-4">
        <h4 className="font-semibold text-emerald-950">{text.readOnlyTitle}</h4>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-emerald-800">{text.completedAt}</dt><dd className="font-semibold text-emerald-950">{formatOrganizationDateTime(handoff.completedAt, locale, timeZone)}</dd></div>
          <div><dt className="text-emerald-800">{text.operator}</dt><dd className="font-semibold text-emerald-950">{handoff.completedByName || "-"}</dd></div>
          <div><dt className="text-emerald-800">{text.balanceAtHandoff}</dt><dd className="font-semibold text-emerald-950">{formatCurrency(handoff.balanceDueAtHandoff, handoff.balanceCurrency, locale)}</dd></div>
          {handoff.unpaidBalanceAcknowledged ? <div><dt className="text-emerald-800">{text.unpaidAcknowledged}</dt><dd className="font-semibold text-emerald-950">✓</dd></div> : null}
        </dl>
        {handoff.notes ? <p className="mt-3 whitespace-pre-wrap text-sm text-emerald-950">{handoff.notes}</p> : null}
      </div>
    );
  }

  if (!canComplete) return null;
  const hasBalance = balanceDue > 0;

  return (
    <form
      action={action}
      className="space-y-4 rounded-card border border-amber-200 bg-amber-50 p-4"
      onSubmit={(event) => {
        if (!window.confirm(text.confirmation)) event.preventDefault();
      }}
    >
      <div>
        <h4 className="font-semibold text-amber-950">{text.title}</h4>
        <p className="mt-1 text-sm text-amber-900">{text.order}: {orderNumber} · {customerName}</p>
        <p className="mt-1 text-sm text-amber-900">{text.currentOperator}: {currentOperator}</p>
        <p className="mt-1 text-sm text-amber-900">{text.currentTime}: {currentTime}</p>
      </div>

      {hasBalance ? (
        <div className="rounded-control border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <p className="font-semibold">{text.unpaidWarning.replace("{amount}", formatCurrency(balanceDue, currency, locale))}</p>
          <label className="mt-3 flex items-start gap-2 font-medium">
            <input className="mt-1 h-4 w-4" name="confirmUnpaid" required type="checkbox" value="true" />
            <span>{text.acknowledgement}</span>
          </label>
        </div>
      ) : null}

      <label className="block space-y-2 text-sm font-semibold text-amber-950">
        <span>{text.notes}</span>
        <textarea className="min-h-24 w-full rounded-control border border-amber-200 bg-white px-3 py-2 font-normal text-foreground" maxLength={1000} name="notes" placeholder={text.notesPlaceholder} />
      </label>
      <Button type="submit">{text.completeAction}</Button>
    </form>
  );
}
