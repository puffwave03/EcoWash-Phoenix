"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type {
  FulfillmentStatus,
  LogisticsActionState,
  LogisticsRecord,
  OrderLogistics,
} from "@/features/logistics/types";
import { formatNumberInput } from "@/lib/number-format";
import type { AssignmentOption } from "@/features/orders/server/queries";

type LogisticsPanelText = {
  addressLine1: string;
  addressLine2: string;
  assignedTo: string;
  cancelledReason: string;
  city: string;
  contactName: string;
  contactPhone: string;
  countryCode: string;
  delivery: string;
  empty: string;
  error: string;
  fee: string;
  inProgress: string;
  notes: string;
  pickup: string;
  postalCode: string;
  save: string;
  saving: string;
  scheduledAt: string;
  unassigned: string;
  success: string;
  statuses: Record<FulfillmentStatus, string>;
};

type LogisticsPanelProps = {
  actions: {
    saveDelivery: (state: LogisticsActionState, formData: FormData) => Promise<LogisticsActionState>;
    savePickup: (state: LogisticsActionState, formData: FormData) => Promise<LogisticsActionState>;
    transitionDelivery: (formData: FormData) => Promise<void>;
    transitionPickup: (formData: FormData) => Promise<void>;
  };
  assignments: {
    delivery: AssignmentOption[];
    pickup: AssignmentOption[];
  };
  canAssign: boolean;
  logistics: OrderLogistics;
  text: LogisticsPanelText;
};

const initialState: LogisticsActionState = { fieldErrors: {}, formError: null, success: false };

function fieldClass(hasError = false) {
  return `min-h-11 w-full min-w-0 max-w-full rounded-control border bg-white px-3 text-sm text-foreground outline-none transition-standard focus:border-primary focus:ring-2 focus:ring-primary/20 ${
    hasError ? "border-red-300" : "border-border"
  }`;
}

function toInputDate(value: string | null) {
  return value ? value.slice(0, 16) : "";
}

function nextStatuses(status: FulfillmentStatus | null) {
  if (status === "scheduled") return ["in_progress", "cancelled"] as const;
  if (status === "in_progress") return ["completed", "cancelled"] as const;
  return [];
}

function LogisticsForm({
  action,
  assignments,
  canAssign,
  record,
  text,
  title,
}: {
  action: (state: LogisticsActionState, formData: FormData) => Promise<LogisticsActionState>;
  assignments: AssignmentOption[];
  canAssign: boolean;
  record: LogisticsRecord | null;
  text: LogisticsPanelText;
  title: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [assignedTo, setAssignedTo] = useState(record?.assignedTo ?? "");

  return (
    <form action={formAction} className="space-y-4">
      <input name="recordId" type="hidden" value={record?.id ?? ""} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="min-w-0 text-lg font-semibold text-primary">{title}</h4>
        <span className="max-w-full rounded-control bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
          {record ? text.statuses[record.status] : text.empty}
        </span>
      </div>
      {state.formError ? <p className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{text.error}</p> : null}
      {state.success ? <p className="rounded-control border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{text.success}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="min-w-0 space-y-2 text-sm font-semibold text-primary">
          <span>{text.scheduledAt}</span>
          <input className={fieldClass(Boolean(state.fieldErrors.scheduledAt))} defaultValue={toInputDate(record?.scheduledAt ?? null)} name="scheduledAt" type="datetime-local" />
        </label>
        {canAssign ? (
          <label className="min-w-0 space-y-2 text-sm font-semibold text-primary">
            <span>{text.assignedTo}</span>
            <select
              className={fieldClass(Boolean(state.fieldErrors.assignedTo))}
              name="assignedTo"
              onChange={(event) => setAssignedTo(event.target.value)}
              value={assignedTo}
            >
              <option value="">{text.unassigned}</option>
              {assignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>{assignment.label}</option>
              ))}
            </select>
          </label>
        ) : (
          <div className="min-w-0 space-y-2 text-sm font-semibold text-primary">
            <input name="assignedTo" type="hidden" value={record?.assignedTo ?? ""} />
            <span>{text.assignedTo}</span>
            <p className="min-h-11 rounded-control border border-border bg-white px-3 py-3 text-sm font-normal text-muted">
              {record?.assignedToName || text.unassigned}
            </p>
          </div>
        )}
        <label className="space-y-2 text-sm font-semibold text-primary">
          <span>{text.addressLine1}</span>
          <input className={fieldClass()} defaultValue={record?.addressLine1 ?? ""} name="addressLine1" />
        </label>
        <label className="space-y-2 text-sm font-semibold text-primary">
          <span>{text.addressLine2}</span>
          <input className={fieldClass()} defaultValue={record?.addressLine2 ?? ""} name="addressLine2" />
        </label>
        <label className="space-y-2 text-sm font-semibold text-primary">
          <span>{text.city}</span>
          <input className={fieldClass()} defaultValue={record?.city ?? ""} name="city" />
        </label>
        <label className="space-y-2 text-sm font-semibold text-primary">
          <span>{text.postalCode}</span>
          <input className={fieldClass()} defaultValue={record?.postalCode ?? ""} name="postalCode" />
        </label>
        <label className="space-y-2 text-sm font-semibold text-primary">
          <span>{text.countryCode}</span>
          <input className={fieldClass(Boolean(state.fieldErrors.countryCode))} defaultValue={record?.countryCode ?? ""} maxLength={2} name="countryCode" />
        </label>
        <label className="space-y-2 text-sm font-semibold text-primary">
          <span>{text.fee}</span>
          <input className={fieldClass(Boolean(state.fieldErrors.fee))} defaultValue={formatNumberInput(record?.fee ?? 0, 2)} min="0" name="fee" step="0.01" type="number" />
        </label>
        <label className="space-y-2 text-sm font-semibold text-primary">
          <span>{text.contactName}</span>
          <input className={fieldClass()} defaultValue={record?.contactName ?? ""} name="contactName" />
        </label>
        <label className="space-y-2 text-sm font-semibold text-primary">
          <span>{text.contactPhone}</span>
          <input className={fieldClass()} defaultValue={record?.contactPhone ?? ""} name="contactPhone" />
        </label>
      </div>
      <label className="space-y-2 text-sm font-semibold text-primary">
        <span>{text.notes}</span>
        <textarea className={`${fieldClass()} min-h-24 py-3`} defaultValue={record?.notes ?? ""} name="notes" />
      </label>
      <Button className="w-full sm:w-auto" disabled={isPending} type="submit">{isPending ? text.saving : text.save}</Button>
    </form>
  );
}

function TransitionButtons({
  action,
  record,
  text,
}: {
  action: (formData: FormData) => Promise<void>;
  record: LogisticsRecord | null;
  text: LogisticsPanelText;
}) {
  const statuses = nextStatuses(record?.status ?? null);
  if (!record || statuses.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:flex-wrap">
      {statuses.map((status) => (
        <form action={action} className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap" key={status}>
          <input name="recordId" type="hidden" value={record.id} />
          <input name="targetStatus" type="hidden" value={status} />
          {status === "cancelled" ? (
            <input className="min-h-11 w-full min-w-0 rounded-control border border-border px-3 text-sm sm:w-auto" name="reason" placeholder={text.cancelledReason} required />
          ) : null}
          <Button className="w-full sm:w-auto" type="submit" variant="secondary">
            {text.statuses[status]}
          </Button>
        </form>
      ))}
    </div>
  );
}

export function LogisticsPanel({ actions, assignments, canAssign, logistics, text }: LogisticsPanelProps) {
  return (
    <Card className="space-y-5 !p-4 sm:!p-6">
      <h3 className="text-xl font-semibold text-primary">{text.inProgress}</h3>
      <div className="grid gap-4 xl:grid-cols-2 xl:gap-6">
        <section className="min-w-0 space-y-4 rounded-card border border-border bg-white p-4 sm:p-5" aria-label={text.pickup}>
          <LogisticsForm action={actions.savePickup} assignments={assignments.pickup} canAssign={canAssign} key={`pickup:${logistics.pickup?.id ?? "new"}:${logistics.pickup?.assignedTo ?? "unassigned"}`} record={logistics.pickup} text={text} title={text.pickup} />
          <TransitionButtons action={actions.transitionPickup} record={logistics.pickup} text={text} />
        </section>
        <section className="min-w-0 space-y-4 rounded-card border border-border bg-white p-4 sm:p-5" aria-label={text.delivery}>
          <LogisticsForm action={actions.saveDelivery} assignments={assignments.delivery} canAssign={canAssign} key={`delivery:${logistics.delivery?.id ?? "new"}:${logistics.delivery?.assignedTo ?? "unassigned"}`} record={logistics.delivery} text={text} title={text.delivery} />
          <TransitionButtons action={actions.transitionDelivery} record={logistics.delivery} text={text} />
        </section>
      </div>
    </Card>
  );
}
