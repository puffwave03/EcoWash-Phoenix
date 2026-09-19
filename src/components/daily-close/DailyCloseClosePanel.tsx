"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { DailyCloseRequest, DailyCloseResult } from "@/features/daily-close/persisted-types";
import { useRouter } from "@/i18n/navigation";
import { formatCurrency } from "@/lib/number-format";

export type DailyCloseWorkflowWarning = {
  code: string;
  count: number;
  label: string;
};

export type DailyCloseWorkflowPreview = {
  blockers: DailyCloseWorkflowWarning[];
  businessDate: string;
  locationId: string | null;
  logistics: {
    deliveriesDueOpen: number;
    inProgress: number;
    pickupsDueOpen: number;
  } | null;
  orders: {
    created: number;
    finalFulfillmentCompleted: number | null;
    productionCompleted: number;
  } | null;
  payments: Array<{
    collectedNet: number;
    currency: string;
    refunds: number;
  }>;
  pos: Array<{
    countedCash: number;
    currency: string;
    expectedCash: number;
    variance: number;
  }>;
  ready: boolean;
  scopeLabel: string;
  warnings: DailyCloseWorkflowWarning[];
};

export type DailyCloseWorkflowText = {
  acknowledgeWarnings: string;
  allLocations: string;
  cancel: string;
  closeAction: string;
  closed: string;
  confirmAction: string;
  confirming: string;
  confirmationDescription: string;
  confirmationTitle: string;
  errors: Record<"generic" | "validation", string>;
  immutable: string;
  labels: Record<"businessDate" | "closeNote" | "readiness" | "scope", string>;
  metrics: Record<
    | "collectedNet"
    | "confirmedPayments"
    | "countedCash"
    | "deliveriesDue"
    | "expectedCash"
    | "finalFulfillmentCompleted"
    | "inProgress"
    | "ordersCreated"
    | "pickupsDue"
    | "productionCompleted"
    | "refunds"
    | "variance",
    string
  >;
  noWarnings: string;
  notePlaceholder: string;
  notReady: string;
  ready: string;
  refreshing: string;
  serverBlockers: Record<string, string>;
  serverBlockersTitle: string;
  startDescription: string;
  startTitle: string;
  warningsTitle: string;
};

type Props = {
  action: (request: DailyCloseRequest) => Promise<DailyCloseResult>;
  locale: string;
  preview: DailyCloseWorkflowPreview;
  text: DailyCloseWorkflowText;
};

function PreviewTotals({ locale, preview, text }: Pick<Props, "locale" | "preview" | "text">) {
  return (
    <div className="space-y-3">
      {preview.orders ? <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-control bg-[#f7f8f7] p-3"><dt className="text-xs text-muted">{text.metrics.ordersCreated}</dt><dd className="mt-1 text-lg font-semibold text-primary">{preview.orders.created}</dd></div>
        <div className="rounded-control bg-[#f7f8f7] p-3"><dt className="text-xs text-muted">{text.metrics.productionCompleted}</dt><dd className="mt-1 text-lg font-semibold text-primary">{preview.orders.productionCompleted}</dd></div>
        <div className="rounded-control bg-[#f7f8f7] p-3"><dt className="text-xs text-muted">{text.metrics.finalFulfillmentCompleted}</dt><dd className="mt-1 text-lg font-semibold text-primary">{preview.orders.finalFulfillmentCompleted ?? "—"}</dd></div>
      </dl> : null}
      {preview.payments.map((payment) => <dl className="grid gap-3 sm:grid-cols-2" key={payment.currency}>
        <div className="rounded-control bg-[#f7f8f7] p-3"><dt className="text-xs text-muted">{text.metrics.collectedNet} · {payment.currency}</dt><dd className="mt-1 font-semibold text-primary">{formatCurrency(payment.collectedNet, payment.currency, locale)}</dd></div>
        <div className="rounded-control bg-[#f7f8f7] p-3"><dt className="text-xs text-muted">{text.metrics.refunds} · {payment.currency}</dt><dd className="mt-1 font-semibold text-primary">{formatCurrency(payment.refunds, payment.currency, locale)}</dd></div>
      </dl>)}
      {preview.pos.map((pos) => <dl className="grid gap-3 sm:grid-cols-3" key={pos.currency}>
        <div className="rounded-control bg-[#f7f8f7] p-3"><dt className="text-xs text-muted">{text.metrics.expectedCash} · {pos.currency}</dt><dd className="mt-1 font-semibold text-primary">{formatCurrency(pos.expectedCash, pos.currency, locale)}</dd></div>
        <div className="rounded-control bg-[#f7f8f7] p-3"><dt className="text-xs text-muted">{text.metrics.countedCash} · {pos.currency}</dt><dd className="mt-1 font-semibold text-primary">{formatCurrency(pos.countedCash, pos.currency, locale)}</dd></div>
        <div className="rounded-control bg-[#f7f8f7] p-3"><dt className="text-xs text-muted">{text.metrics.variance} · {pos.currency}</dt><dd className="mt-1 font-semibold text-primary">{formatCurrency(pos.variance, pos.currency, locale)}</dd></div>
      </dl>)}
      {preview.logistics ? <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-control bg-[#f7f8f7] p-3"><dt className="text-xs text-muted">{text.metrics.pickupsDue}</dt><dd className="mt-1 text-lg font-semibold text-primary">{preview.logistics.pickupsDueOpen}</dd></div>
        <div className="rounded-control bg-[#f7f8f7] p-3"><dt className="text-xs text-muted">{text.metrics.deliveriesDue}</dt><dd className="mt-1 text-lg font-semibold text-primary">{preview.logistics.deliveriesDueOpen}</dd></div>
        <div className="rounded-control bg-[#f7f8f7] p-3"><dt className="text-xs text-muted">{text.metrics.inProgress}</dt><dd className="mt-1 text-lg font-semibold text-primary">{preview.logistics.inProgress}</dd></div>
      </dl> : null}
    </div>
  );
}

function IssueList({ items }: { items: DailyCloseWorkflowWarning[] }) {
  return <ul className="space-y-2">{items.map((item) => <li className="rounded-control border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" key={item.code}>{item.label}: {item.count}</li>)}</ul>;
}

export function DailyCloseClosePanel({ action, locale, preview, text }: Props) {
  const router = useRouter();
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [note, setNote] = useState("");
  const [serverBlockers, setServerBlockers] = useState<DailyCloseWorkflowWarning[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const idempotencyKey = useRef<string | null>(null);
  const submissionLocked = useRef(false);
  const warningAcknowledgementRequired = preview.warnings.length > 0;

  useEffect(() => {
    if (confirmationOpen) confirmationHeading.current?.focus();
  }, [confirmationOpen]);

  function openConfirmation() {
    if (!preview.ready) return;
    idempotencyKey.current = crypto.randomUUID();
    setAcknowledged(false);
    setFormError(null);
    setServerBlockers([]);
    setConfirmationOpen(true);
  }

  function cancelConfirmation() {
    if (isPending) return;
    idempotencyKey.current = null;
    submissionLocked.current = false;
    setConfirmationOpen(false);
    setAcknowledged(false);
    setFormError(null);
    setServerBlockers([]);
  }

  function confirmClose() {
    if (
      !preview.ready
      || isPending
      || submissionLocked.current
      || (warningAcknowledgementRequired && !acknowledged)
    ) return;

    idempotencyKey.current ??= crypto.randomUUID();
    submissionLocked.current = true;
    setFormError(null);
    setServerBlockers([]);

    startTransition(async () => {
      try {
        const result = await action({
          businessDate: preview.businessDate,
          idempotencyKey: idempotencyKey.current as string,
          locationId: preview.locationId,
          note,
        });

        if (result.status === "created" || result.status === "existing" || (result.code === "already_closed" && result.closeId)) {
          setCompleted(true);
          router.refresh();
          return;
        }

        submissionLocked.current = false;
        if (result.blockers.length) {
          setServerBlockers(result.blockers.map((blocker) => ({
            code: blocker.code,
            count: blocker.count,
            label: text.serverBlockers[blocker.code] ?? text.errors.generic,
          })));
        } else if (result.code && text.serverBlockers[result.code]) {
          setServerBlockers([{
            code: result.code,
            count: 1,
            label: text.serverBlockers[result.code],
          }]);
        } else {
          setFormError(result.status === "validation" ? text.errors.validation : text.errors.generic);
        }
      } catch {
        submissionLocked.current = false;
        setFormError(text.errors.generic);
      }
    });
  }

  if (completed) {
    return <Card className="border-green-200 bg-green-50" aria-live="polite"><h3 className="text-2xl font-semibold text-green-900">{text.closed}</h3><p className="mt-2 text-sm text-green-900">{text.refreshing}</p></Card>;
  }

  return (
    <Card className="space-y-5 overflow-hidden">
      {!confirmationOpen ? <>
        <div><h3 className="text-2xl font-semibold text-primary">{text.startTitle}</h3><p className="mt-2 text-sm leading-6 text-muted">{text.startDescription}</p></div>
        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-control bg-[#f7f8f7] p-3"><dt className="text-xs text-muted">{text.labels.businessDate}</dt><dd className="mt-1 break-words font-semibold text-primary">{preview.businessDate}</dd></div>
          <div className="rounded-control bg-[#f7f8f7] p-3"><dt className="text-xs text-muted">{text.labels.scope}</dt><dd className="mt-1 break-words font-semibold text-primary">{preview.scopeLabel}</dd></div>
          <div className="rounded-control bg-[#f7f8f7] p-3"><dt className="text-xs text-muted">{text.labels.readiness}</dt><dd className={`mt-1 font-semibold ${preview.ready ? "text-green-800" : "text-red-700"}`}>{preview.ready ? text.ready : text.notReady}</dd></div>
        </dl>
        {preview.blockers.length ? <div className="space-y-2"><h4 className="font-semibold text-red-800">{text.serverBlockersTitle}</h4><IssueList items={preview.blockers} /></div> : null}
        <div className="space-y-2"><h4 className="font-semibold text-primary">{text.warningsTitle}</h4>{preview.warnings.length ? <IssueList items={preview.warnings} /> : <p className="text-sm text-muted">{text.noWarnings}</p>}</div>
        <label className="block space-y-2 text-sm font-semibold text-primary"><span>{text.labels.closeNote}</span><textarea className="min-h-28 w-full resize-y rounded-control border border-border bg-white px-3.5 py-3 text-base font-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" maxLength={1000} onChange={(event) => setNote(event.target.value)} placeholder={text.notePlaceholder} value={note} /></label>
        <div className="flex justify-end"><Button className="w-full sm:w-auto" disabled={!preview.ready} onClick={openConfirmation}>{text.closeAction}</Button></div>
      </> : <section aria-labelledby="daily-close-confirmation-title" className="space-y-5">
        <div><h3 className="text-2xl font-semibold text-primary outline-none" id="daily-close-confirmation-title" ref={confirmationHeading} tabIndex={-1}>{text.confirmationTitle}</h3><p className="mt-2 text-sm leading-6 text-muted">{text.confirmationDescription}</p></div>
        <dl className="grid gap-3 sm:grid-cols-2"><div><dt className="text-xs font-semibold uppercase tracking-wide text-muted">{text.labels.businessDate}</dt><dd className="mt-1 font-semibold text-primary">{preview.businessDate}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-muted">{text.labels.scope}</dt><dd className="mt-1 break-words font-semibold text-primary">{preview.scopeLabel}</dd></div></dl>
        <PreviewTotals locale={locale} preview={preview} text={text} />
        {preview.blockers.length ? <div className="space-y-2"><h4 className="font-semibold text-red-800">{text.serverBlockersTitle}</h4><IssueList items={preview.blockers} /></div> : null}
        <div className="space-y-2"><h4 className="font-semibold text-primary">{text.warningsTitle}</h4>{preview.warnings.length ? <IssueList items={preview.warnings} /> : <p className="text-sm text-muted">{text.noWarnings}</p>}</div>
        <label className="block space-y-2 text-sm font-semibold text-primary"><span>{text.labels.closeNote}</span><textarea className="min-h-28 w-full resize-y rounded-control border border-border bg-white px-3.5 py-3 text-base font-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" maxLength={1000} onChange={(event) => setNote(event.target.value)} placeholder={text.notePlaceholder} value={note} /></label>
        {warningAcknowledgementRequired ? <label className="flex min-h-12 items-start gap-3 rounded-control border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950"><input checked={acknowledged} className="mt-1 h-5 w-5 shrink-0" onChange={(event) => setAcknowledged(event.target.checked)} type="checkbox" /><span>{text.acknowledgeWarnings}</span></label> : null}
        <p className="rounded-control border border-border bg-[#f7f8f7] px-4 py-3 text-sm font-semibold text-primary">{text.immutable}</p>
        {serverBlockers.length ? <div aria-live="polite" className="space-y-2"><h4 className="font-semibold text-red-800">{text.serverBlockersTitle}</h4><IssueList items={serverBlockers} /></div> : null}
        {formError ? <p aria-live="polite" className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{formError}</p> : null}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button className="w-full sm:w-auto" disabled={isPending} onClick={cancelConfirmation} variant="secondary">{text.cancel}</Button><Button className="w-full sm:w-auto" disabled={isPending || !preview.ready || (warningAcknowledgementRequired && !acknowledged)} onClick={confirmClose}>{isPending ? text.confirming : text.confirmAction}</Button></div>
      </section>}
    </Card>
  );
}
