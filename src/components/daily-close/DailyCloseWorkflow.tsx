import { Card } from "@/components/Card";
import { DailyCloseClosePanel, type DailyCloseWorkflowPreview, type DailyCloseWorkflowText } from "@/components/daily-close/DailyCloseClosePanel";
import { SummaryCard } from "@/components/operational/OperationalUi";
import type { DailyCloseRequest, DailyCloseResult, PersistedDailyClose } from "@/features/daily-close/persisted-types";
import { readDailyCloseSnapshot, type DailyCloseSnapshotWarning } from "@/features/daily-close/snapshot";
import type { DailyCloseData, DailyCloseSource } from "@/features/daily-close/types";
import { formatCurrency } from "@/lib/number-format";

export type DailyCloseDefinitiveText = DailyCloseWorkflowText & {
  closedAt: string;
  closedDescription: string;
  completedDeliveries: string;
  completedPickups: string;
  noNote: string;
  savedSummary: string;
  savedWarnings: string;
  snapshotUnavailable: string;
  sourceLabels: Record<DailyCloseSource, string>;
  warningLabels: Record<string, string>;
};

type Props = {
  action: (request: DailyCloseRequest) => Promise<DailyCloseResult>;
  data: DailyCloseData;
  locale: string;
  persistedClose: PersistedDailyClose | null;
  text: DailyCloseDefinitiveText;
};

function formatDateTime(value: string, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

function scopeLabel(data: DailyCloseData, allLocations: string, locationId = data.selectedLocationId) {
  if (!locationId) return allLocations;
  return data.locations.find((location) => location.id === locationId)?.name ?? locationId;
}

function warningLabel(warning: DailyCloseSnapshotWarning, text: DailyCloseDefinitiveText) {
  return text.warningLabels[warning.code] ?? warning.code.replaceAll("_", " ");
}

export function PersistedSummary({ close, locale, scopeLabel: selectedScope, text }: {
  close: PersistedDailyClose;
  locale: string;
  scopeLabel: string;
  text: DailyCloseDefinitiveText;
}) {
  const snapshot = readDailyCloseSnapshot(close.snapshot);

  return (
    <Card className="space-y-5 border-green-200 bg-green-50/50 print:border-0 print:bg-white print:p-0 print:shadow-none">
      <div><p className="text-sm font-semibold uppercase tracking-[0.12em] text-green-800">{text.immutable}</p><h3 className="mt-1 text-3xl font-semibold text-green-900">{text.closed}</h3><p className="mt-2 text-sm leading-6 text-green-950">{text.closedDescription}</p></div>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-control bg-white p-3"><dt className="text-xs text-muted">{text.labels.businessDate}</dt><dd className="mt-1 break-words font-semibold text-primary">{close.businessDate}</dd></div>
        <div className="rounded-control bg-white p-3"><dt className="text-xs text-muted">{text.labels.scope}</dt><dd className="mt-1 break-words font-semibold text-primary">{selectedScope}</dd></div>
        <div className="rounded-control bg-white p-3"><dt className="text-xs text-muted">{text.closedAt}</dt><dd className="mt-1 break-words font-semibold text-primary">{formatDateTime(close.closedAt, locale, close.tenantTimezone)}</dd></div>
        <div className="rounded-control bg-white p-3 sm:col-span-2 lg:col-span-1"><dt className="text-xs text-muted">{text.labels.closeNote}</dt><dd className="mt-1 whitespace-pre-wrap break-words font-semibold text-primary">{close.closeNote || text.noNote}</dd></div>
      </dl>
      {!snapshot ? <p className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{text.snapshotUnavailable}</p> : <>
        <section className="space-y-3" aria-labelledby="daily-close-saved-summary"><h4 className="text-lg font-semibold text-primary" id="daily-close-saved-summary">{text.savedSummary}</h4>
          <div className="grid gap-3 sm:grid-cols-3"><SummaryCard label={text.metrics.ordersCreated} value={snapshot.ordersCreated} /><SummaryCard label={text.metrics.productionCompleted} tone="info" value={snapshot.productionCompleted} /><SummaryCard label={text.metrics.finalFulfillmentCompleted} tone="success" value={snapshot.finalFulfillmentCompleted} /></div>
          {snapshot.payments.map((payment) => <div className="grid gap-3 sm:grid-cols-3" key={payment.currency}><SummaryCard label={`${text.metrics.confirmedPayments} · ${payment.currency}`} value={payment.confirmedPaymentCount} /><SummaryCard label={`${text.metrics.collectedNet} · ${payment.currency}`} tone="success" value={formatCurrency(payment.collectedNet, payment.currency, locale)} /><SummaryCard label={`${text.metrics.refunds} · ${payment.currency}`} tone="warning" value={formatCurrency(payment.refunds, payment.currency, locale)} /></div>)}
          <div className="grid gap-3 sm:grid-cols-3"><SummaryCard label={`${text.metrics.expectedCash} · ${snapshot.pos.currency}`} value={formatCurrency(snapshot.pos.expectedCash, snapshot.pos.currency, locale)} /><SummaryCard label={`${text.metrics.countedCash} · ${snapshot.pos.currency}`} value={formatCurrency(snapshot.pos.countedCash, snapshot.pos.currency, locale)} /><SummaryCard label={`${text.metrics.variance} · ${snapshot.pos.currency}`} tone={snapshot.pos.variance === 0 ? "success" : "warning"} value={formatCurrency(snapshot.pos.variance, snapshot.pos.currency, locale)} /></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><SummaryCard label={text.completedPickups} value={snapshot.logistics.completedPickups} /><SummaryCard label={text.completedDeliveries} value={snapshot.logistics.completedDeliveries} /><SummaryCard label={text.metrics.pickupsDue} value={snapshot.logistics.pickupsDueOpen} /><SummaryCard label={text.metrics.deliveriesDue} value={snapshot.logistics.deliveriesDueOpen} /><SummaryCard label={text.metrics.inProgress} value={snapshot.logistics.inProgress} /></div>
        </section>
        <section className="space-y-3" aria-labelledby="daily-close-saved-warnings"><h4 className="text-lg font-semibold text-primary" id="daily-close-saved-warnings">{text.savedWarnings}</h4>{snapshot.warnings.length ? <ul className="space-y-2">{snapshot.warnings.map((warning) => <li className="rounded-control border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" key={warning.code}>{warningLabel(warning, text)}: {warning.count}</li>)}</ul> : <p className="text-sm text-muted">{text.noWarnings}</p>}</section>
      </>}
    </Card>
  );
}

function previewWarnings(data: DailyCloseData, text: DailyCloseDefinitiveText) {
  const warnings: DailyCloseWorkflowPreview["warnings"] = [];
  const add = (code: string, count: number) => {
    if (count > 0) warnings.push({ code, count, label: text.warningLabels[code] ?? code.replaceAll("_", " ") });
  };

  add("unpaid_or_partially_paid_orders", data.payments?.reduce((sum, payment) => sum + payment.outstandingOrderCount, 0) ?? 0);
  add("overdue_logistics", (data.logistics?.overduePickups ?? 0) + (data.logistics?.overdueDeliveries ?? 0));
  add("open_production", data.orders?.open ?? 0);
  add("on_hold_production", data.orders?.onHold ?? 0);
  add("cash_variance", data.cashVarianceSessions);
  add("non_session_non_cash_activity", data.nonSessionNonCashActivity);
  if (!data.selectedLocationId) add("null_location_organization_wide", data.unassignedLocationFacts);
  if (data.businessDate < data.currentBusinessDate) add("historical_late_close", 1);
  return warnings;
}

export function isDefinitiveBlocker(key: DailyCloseData["blockers"][number]["key"], locationId: string | null) {
  return key !== "unassigned_location" || locationId !== null;
}

function previewBlockers(data: DailyCloseData, text: DailyCloseDefinitiveText) {
  return data.blockers.flatMap((blocker) => {
    if (!isDefinitiveBlocker(blocker.key, data.selectedLocationId)) return [];
    const sources = blocker.sources?.map((source) => text.sourceLabels[source]).join(", ");
    const label = text.serverBlockers[blocker.key] ?? text.errors.generic;
    return [{
      code: blocker.key,
      count: blocker.count ?? blocker.sources?.length ?? 1,
      label: sources ? `${label}: ${sources}` : label,
    }];
  });
}

export function DailyCloseWorkflow({ action, data, locale, persistedClose, text }: Props) {
  if (persistedClose) return <PersistedSummary close={persistedClose} locale={locale} scopeLabel={scopeLabel(data, text.allLocations, persistedClose.locationId)} text={text} />;

  const blockers = previewBlockers(data, text);
  const preview: DailyCloseWorkflowPreview = {
    blockers,
    businessDate: data.businessDate,
    locationId: data.selectedLocationId,
    logistics: data.logistics,
    orders: data.orders,
    payments: data.payments?.map((payment) => ({ collectedNet: payment.collectedNet, currency: payment.currency, refunds: payment.refunds })) ?? [],
    pos: data.pos?.currencies ?? [],
    ready: data.complete && blockers.length === 0,
    scopeLabel: scopeLabel(data, text.allLocations),
    warnings: previewWarnings(data, text),
  };

  return <DailyCloseClosePanel action={action} locale={locale} preview={preview} text={text} />;
}
