"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { PaymentMethod, PaymentRecordStatus } from "@/features/payments/types";
import type { PosActionState, PosLocation, PosOrderDue, PosPayment, PosSession, PosSessionSummary } from "@/features/pos/types";
import { formatCurrency } from "@/lib/number-format";

export type PosText = {
  actions: { close: string; open: string; pay: string; refund: string; search: string };
  close: { counted: string; description: string; difference: string; notes: string; title: string };
  common: { actor: string; amount: string; date: string; location: string; noLocation: string; reference: string };
  errors: { alreadyOpen: string; close: string; generic: string; payment: string; refund: string; validation: string };
  history: { counted: string; difference: string; empty: string; expected: string; title: string };
  methods: Record<PaymentMethod, string>;
  orders: { customer: string; empty: string; method: string; notes: string; outstanding: string; paid: string; placeholder: string; title: string; total: string };
  payments: { empty: string; manualCard: string; phoenixRefund: string; reason: string; title: string };
  session: { cashPayments: string; cashRefunds: string; closed: string; expected: string; opening: string; openingAmount: string; open: string; selectLocation: string; title: string; transactions: string };
  statuses: Record<PaymentRecordStatus, string>;
  subtitle: string;
  success: string;
  title: string;
};

type Action = (state: PosActionState, data: FormData) => Promise<PosActionState>;
const initialState: PosActionState = { fieldErrors: {}, formError: null, success: false };
const inputClass = "min-h-12 w-full rounded-control border border-border bg-white px-3 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function result(state: PosActionState, text: PosText) {
  if (state.success) return <p className="rounded-control bg-green-50 px-3 py-2 text-sm font-medium text-green-800">{text.success}</p>;
  if (!state.formError) return null;
  return <p className="rounded-control bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{text.errors[state.formError as keyof PosText["errors"]] ?? text.errors.generic}</p>;
}

function OpenSessionForm({ action, locations, text }: { action: Action; locations: PosLocation[]; text: PosText }) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
      <label className="space-y-2 text-sm font-semibold text-primary"><span>{text.session.selectLocation}</span>
        <select className={inputClass} name="locationId"><option value="">{text.common.noLocation}</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select>
      </label>
      <label className="space-y-2 text-sm font-semibold text-primary"><span>{text.session.openingAmount}</span><input className={inputClass} min="0" name="openingCash" required step="0.01" type="number" /></label>
      <input name="notes" type="hidden" />
      <Button className="min-h-12" disabled={pending} type="submit">{text.actions.open}</Button>
      <div className="md:col-span-3">{result(state, text)}</div>
    </form>
  );
}

function PaymentForm({ action, order, session, text }: { action: Action; order: PosOrderDue; session: PosSession | null; text: PosText }) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  return (
    <form action={formAction} className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 xl:grid-cols-[8rem_1fr_1fr_auto] xl:items-end">
      <input name="orderId" type="hidden" value={order.id} /><input name="sessionId" type="hidden" value={session?.id ?? ""} /><input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      <label className="space-y-2 text-sm font-semibold text-primary"><span>{text.common.amount}</span><input className={inputClass} defaultValue={order.outstanding.toFixed(2)} max={order.outstanding} min="0.01" name="amount" required step="0.01" type="number" /></label>
      <label className="space-y-2 text-sm font-semibold text-primary"><span>{text.orders.method}</span><select className={inputClass} defaultValue={session ? "cash" : "card"} name="method">
        <option disabled={!session} value="cash">{text.methods.cash}</option><option value="card">{text.methods.card}</option><option value="bank_transfer">{text.methods.bank_transfer}</option><option value="other">{text.methods.other}</option>
      </select></label>
      <label className="space-y-2 text-sm font-semibold text-primary"><span>{text.common.reference}</span><input autoComplete="off" className={inputClass} name="reference" /></label>
      <input name="notes" type="hidden" /><Button className="min-h-12" disabled={pending} type="submit">{text.actions.pay}</Button>
      <div className="sm:col-span-2 xl:col-span-4">{result(state, text)}</div>
    </form>
  );
}

function RefundForm({ action, payment, sessionId, text }: { action: Action; payment: PosPayment; sessionId: string; text: PosText }) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  return (
    <form action={formAction} className="mt-3 grid gap-2 sm:grid-cols-[7rem_1fr_auto]">
      <input name="paymentId" type="hidden" value={payment.id} /><input name="sessionId" type="hidden" value={sessionId} /><input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      <input aria-label={text.common.amount} className={inputClass} max={payment.amount} min="0.01" name="amount" placeholder={text.common.amount} required step="0.01" type="number" />
      <input aria-label={text.payments.reason} className={inputClass} name="reason" placeholder={text.payments.reason} required />
      <Button disabled={pending} type="submit" variant="secondary">{text.actions.refund}</Button>
      <div className="sm:col-span-3">{result(state, text)}</div>
    </form>
  );
}

function CloseSessionForm({ action, session, summary, text }: { action: Action; session: PosSession; summary: PosSessionSummary; text: PosText }) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <Card className="space-y-4">
      <div><h3 className="text-xl font-semibold text-primary">{text.close.title}</h3><p className="mt-1 text-sm text-muted">{text.close.description}</p></div>
      <form action={formAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <input name="sessionId" type="hidden" value={session.id} />
        <label className="space-y-2 text-sm font-semibold text-primary"><span>{text.close.counted}</span><input className={inputClass} defaultValue={summary.expectedCash.toFixed(2)} min="0" name="countedCash" required step="0.01" type="number" /></label>
        <label className="space-y-2 text-sm font-semibold text-primary"><span>{text.close.notes}</span><input className={inputClass} name="notes" /></label>
        <Button className="min-h-12" disabled={pending} type="submit" variant="secondary">{text.actions.close}</Button>
        <div className="sm:col-span-3">{result(state, text)}</div>
      </form>
    </Card>
  );
}

export function PosWorkspace({ actions, canSeeHistory, currency, history, locale, locations, orders, payments, query, session, summary, text }: {
  actions: { close: Action; open: Action; pay: Action; refund: Action };
  canSeeHistory: boolean; currency: string; history: PosSession[]; locale: string; locations: PosLocation[]; orders: PosOrderDue[]; payments: PosPayment[]; query: string; session: PosSession | null; summary: PosSessionSummary | null; text: PosText;
}) {
  return (
    <div className="space-y-6">
      <header><p className="text-sm font-semibold uppercase tracking-[0.12em] text-secondary">POS</p><h2 className="mt-1 text-3xl font-semibold text-primary">{text.title}</h2><p className="mt-2 max-w-3xl text-sm text-muted">{text.subtitle}</p></header>

      <Card className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-semibold text-primary">{text.session.title}</h3><span className={`rounded-full px-3 py-1 text-sm font-semibold ${session ? "bg-green-50 text-green-800" : "bg-[#f2f3f2] text-muted"}`}>{session ? text.session.open : text.session.closed}</span></div>
        {session && summary ? (
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[[text.session.opening, summary.openingCash], [text.session.cashPayments, summary.cashPayments], [text.session.cashRefunds, summary.cashRefunds], [text.session.expected, summary.expectedCash]].map(([label, amount]) => <div className="rounded-control bg-[#f7f8f7] p-3" key={String(label)}><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 text-lg font-semibold text-primary">{formatCurrency(Number(amount), currency, locale)}</dd></div>)}
            <div className="rounded-control bg-[#f7f8f7] p-3"><dt className="text-xs text-muted">{text.session.transactions}</dt><dd className="mt-1 text-lg font-semibold text-primary">{summary.transactionCount}</dd></div>
          </dl>
        ) : <OpenSessionForm action={actions.open} locations={locations} text={text} />}
      </Card>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><h3 className="text-xl font-semibold text-primary">{text.orders.title}</h3><form className="flex gap-2"><input className={inputClass} defaultValue={query} name="q" placeholder={text.orders.placeholder} /><Button type="submit" variant="secondary">{text.actions.search}</Button></form></div>
        <div className="grid gap-4 xl:grid-cols-2">{orders.length === 0 ? <Card><p className="text-sm text-muted">{text.orders.empty}</p></Card> : orders.map((order) => (
          <Card key={order.id}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-primary">{order.orderNumber}</p><p className="text-sm text-muted">{order.customerName}</p></div><p className="text-xl font-semibold text-primary">{formatCurrency(order.outstanding, order.currency, locale)}</p></div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-sm"><div><dt className="text-muted">{text.orders.total}</dt><dd>{formatCurrency(order.total, order.currency, locale)}</dd></div><div><dt className="text-muted">{text.orders.paid}</dt><dd>{formatCurrency(order.totalPaid, order.currency, locale)}</dd></div><div><dt className="text-muted">{text.orders.outstanding}</dt><dd>{formatCurrency(order.outstanding, order.currency, locale)}</dd></div></dl>
            <PaymentForm action={actions.pay} order={order} session={session} text={text} />
          </Card>
        ))}</div>
      </section>

      {session ? <Card className="space-y-4"><h3 className="text-xl font-semibold text-primary">{text.payments.title}</h3>{payments.length === 0 ? <p className="text-sm text-muted">{text.payments.empty}</p> : <div className="divide-y divide-border">{payments.map((payment) => <div className="py-4" key={payment.id}><div className="grid gap-2 sm:grid-cols-4"><div><p className="font-semibold text-primary">{formatCurrency(payment.amount, currency, locale)}</p><p className="text-sm text-muted">{text.methods[payment.method]} · {text.statuses[payment.status]}</p></div><p className="text-sm text-muted">{payment.orderNumber}</p><p className="text-sm text-muted">{new Date(payment.paidAt).toLocaleString(locale)}</p><p className="text-sm text-muted">{payment.recordedByName ?? "-"}</p></div>{payment.method === "card" ? <p className="mt-2 text-xs text-muted">{text.payments.manualCard}</p> : null}{payment.status === "confirmed" ? <><p className="mt-2 text-xs font-medium text-muted">{text.payments.phoenixRefund}</p><RefundForm action={actions.refund} payment={payment} sessionId={session.id} text={text} /></> : null}</div>)}</div>}</Card> : null}

      {session && summary ? <CloseSessionForm action={actions.close} session={session} summary={summary} text={text} /> : null}

      {canSeeHistory ? <Card className="space-y-4"><h3 className="text-xl font-semibold text-primary">{text.history.title}</h3>{history.length === 0 ? <p className="text-sm text-muted">{text.history.empty}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[44rem] text-left text-sm"><thead><tr className="border-b border-border text-muted"><th className="p-3">{text.common.date}</th><th className="p-3">{text.common.actor}</th><th className="p-3">{text.session.opening}</th><th className="p-3">{text.history.expected}</th><th className="p-3">{text.history.counted}</th><th className="p-3">{text.history.difference}</th></tr></thead><tbody>{history.map((item) => <tr className="border-b border-border" key={item.id}><td className="p-3">{new Date(item.openedAt).toLocaleString(locale)}</td><td className="p-3">{item.openedByName ?? "-"}</td><td className="p-3">{formatCurrency(item.openingCash, currency, locale)}</td><td className="p-3">{item.expectedCash === null ? "-" : formatCurrency(item.expectedCash, currency, locale)}</td><td className="p-3">{item.countedCash === null ? "-" : formatCurrency(item.countedCash, currency, locale)}</td><td className="p-3">{item.difference === null ? "-" : formatCurrency(item.difference, currency, locale)}</td></tr>)}</tbody></table></div>}</Card> : null}
    </div>
  );
}
