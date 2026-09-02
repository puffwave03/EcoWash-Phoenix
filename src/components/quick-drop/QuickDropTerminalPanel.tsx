"use client";

import { useRef, useState, useTransition } from "react";
import { ScannableQrCode } from "@/components/barcode/ScannableQrCode";
import { PrintOrderActions, type PrintActionText } from "@/components/printing/PrintOrderActions";
import type { PendingQuickDrop, QuickDropCreateResult } from "@/features/quick-drop/types";
import { Link } from "@/i18n/navigation";

export type QuickDropText = {
  action: string;
  cancel: string;
  confirm: string;
  confirming: string;
  detailOrder: string;
  dueAt: string;
  errorGeneric: string;
  errorValidation: string;
  help: string;
  labelsDeferred: string;
  locationRequired: string;
  newQuickDrop: string;
  newOrder: string;
  note: string;
  notePlaceholder: string;
  openOrder: string;
  pendingDetail: string;
  pendingList: string;
  qrAria: string;
  received: string;
  success: string;
  unpriced: string;
};

type Props = {
  action: (formData: FormData) => Promise<QuickDropCreateResult>;
  canPrint: boolean;
  canQr: boolean;
  customer: { id: string; isWalkIn: boolean; name: string; phone: string | null; walkInName: string | null } | null;
  locale: string;
  locationId: string | null;
  onNewOrder: () => void;
  pending: PendingQuickDrop[];
  printText: PrintActionText;
  text: QuickDropText;
};

export function QuickDropTerminalPanel({ action, canPrint, canQr, customer, locale, locationId, onNewOrder, pending, printText, text }: Props) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<QuickDropCreateResult>({ error: null, order: null });
  const [isPending, startTransition] = useTransition();
  const idempotencyKey = useRef<string | null>(null);

  function close() {
    setOpen(false);
    setResult({ error: null, order: null });
    idempotencyKey.current = null;
  }

  function startAnother() {
    setResult({ error: null, order: null });
    idempotencyKey.current = null;
    setOpen(true);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customer || !locationId || isPending) return;
    const formData = new FormData(event.currentTarget);
    const dueAt = String(formData.get("dueAt") ?? "").trim();
    if (dueAt) formData.set("dueAt", new Date(dueAt).toISOString());
    idempotencyKey.current ??= crypto.randomUUID();
    formData.set("customerId", customer.id);
    formData.set("idempotencyKey", idempotencyKey.current);
    formData.set("locationId", locationId);
    if (customer.isWalkIn) {
      formData.set("walkInName", customer.walkInName ?? "");
      formData.set("walkInPhone", customer.phone ?? "");
    }
    startTransition(async () => setResult(await action(formData)));
  }

  return (
    <div className="space-y-3">
      {pending.length ? <section className="border-l-4 border-secondary bg-gold-soft/60 p-3"><div className="flex flex-wrap items-center gap-2"><strong className="text-xs font-black uppercase tracking-[0.12em] text-primary">{text.pendingList} · {pending.length}</strong>{pending.slice(0, 5).map((order) => <Link className="inline-flex min-h-10 items-center rounded-control border border-primary/20 bg-white px-3 text-sm font-bold !text-primary" href={`/app/orders/${order.id}#items`} key={order.id} locale={locale}>{order.orderNumber} · {order.customerName}</Link>)}</div></section> : null}

      {result.order ? <section className="border-l-4 border-primary bg-white p-4 shadow-card"><div className="grid gap-4 sm:grid-cols-[1fr_8rem] sm:items-center"><div><p className="text-sm font-black uppercase tracking-[0.12em] text-secondary">✓ {text.success}</p><h2 className="mt-1 text-2xl font-black text-primary">{result.order.orderNumber}</h2><p className="font-semibold text-muted">{customer?.name}</p><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900">{text.pendingDetail}</span><span className="rounded-full bg-primary-soft px-3 py-1 text-sm font-bold text-primary">{text.unpriced}</span></div><p className="mt-3 text-sm text-muted">{text.received}: <strong className="text-primary">{new Date(result.order.receivedAt).toLocaleString(locale)}</strong></p>{result.order.dueAt ? <p className="mt-1 text-sm text-muted">{text.dueAt}: <strong className="text-primary">{new Date(result.order.dueAt).toLocaleString(locale)}</strong></p> : null}</div>{canQr ? <ScannableQrCode ariaLabel={text.qrAria} className="mx-auto w-28" payload={result.order.orderCode} /> : null}</div><p className="mt-3 text-sm font-semibold text-muted">{text.labelsDeferred}</p><div className="mt-4 flex flex-wrap gap-2">{canPrint ? <PrintOrderActions locale={locale} modes={["ticket"]} orderId={result.order.id} text={printText} /> : null}<Link className="inline-flex min-h-11 items-center rounded-control border border-primary px-4 font-bold !text-primary" href={`/app/orders/${result.order.id}`} locale={locale}>{text.openOrder}</Link><Link className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 font-bold !text-white" href={`/app/orders/${result.order.id}#items`} locale={locale}>{text.detailOrder}</Link><button className="min-h-11 rounded-control border border-primary/20 px-4 font-bold text-primary" onClick={startAnother} type="button">{text.newQuickDrop}</button><button className="min-h-11 px-3 font-bold text-muted" onClick={() => { close(); onNewOrder(); }} type="button">{text.newOrder}</button></div></section> : customer ? <section className="border-l-4 border-secondary bg-white p-2.5"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-black leading-tight text-primary">{text.action}</h2><p className="text-sm leading-tight text-muted">{text.help}</p>{!locationId ? <p className="mt-1 text-xs font-semibold text-amber-800" id="quick-drop-location-required">{text.locationRequired}</p> : null}</div><button aria-controls="quick-drop-intake" aria-describedby={!locationId ? "quick-drop-location-required" : undefined} aria-expanded={open} className="min-h-11 shrink-0 rounded-control border border-primary px-4 font-bold text-primary disabled:opacity-40" disabled={!locationId} onClick={() => setOpen((value) => !value)} type="button">{text.action}</button></div>{open ? <form className="mt-3 grid gap-3 border-t border-border pt-3 md:grid-cols-[1fr_14rem_auto_auto] md:items-end" id="quick-drop-intake" onSubmit={submit}><label className="text-xs font-bold text-muted">{text.note}<input autoFocus className="mt-1 min-h-11 w-full rounded-control border border-border px-3 text-base text-primary" maxLength={600} name="note" placeholder={text.notePlaceholder} /></label><label className="text-xs font-bold text-muted">{text.dueAt}<input className="mt-1 min-h-11 w-full rounded-control border border-border px-3 text-base text-primary" name="dueAt" type="datetime-local" /></label><button className="min-h-11 rounded-control bg-primary px-5 font-bold text-white disabled:opacity-50" disabled={isPending || !locationId} type="submit">{isPending ? text.confirming : text.confirm}</button><button className="min-h-11 px-3 font-bold text-muted" disabled={isPending} onClick={close} type="button">{text.cancel}</button>{result.error ? <p aria-live="polite" className="text-sm font-semibold text-red-700 md:col-span-4">{result.error === "validation" ? text.errorValidation : text.errorGeneric}</p> : null}</form> : null}</section> : null}
    </div>
  );
}
