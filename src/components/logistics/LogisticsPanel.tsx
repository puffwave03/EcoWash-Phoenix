"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type {
  FulfillmentStatus,
  LogisticsActionState,
  LogisticsRecord,
  OrderLogistics,
} from "@/features/logistics/types";
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
  statuses: Record<FulfillmentStatus, string>;
};

type LogisticsPanelProps = {
  actions: {
    saveDelivery: (state: LogisticsActionState, formData: FormData) => Promise<LogisticsActionState>;
    savePickup: (state: LogisticsActionState, formData: FormData) => Promise<LogisticsActionState>;
    transitionDelivery: (formData: FormData) => Promise<void>;
    transitionPickup: (formData: FormData) => Promise<void>;
  };
  assignments: AssignmentOption[];
  logistics: OrderLogistics;
  text: LogisticsPanelText;
};

const initialState: LogisticsActionState = { fieldErrors: {}, formError: null };

function fieldClass(hasError = false) {
  return `min-h-11 w-full rounded-control border bg-white px-3 text-sm text-foreground outline-none transition-standard focus:border-primary focus:ring-2 focus:ring-primary/20 ${
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
  record,
  text,
  title,
}: {
  action: (state: LogisticsActionState, formData: FormData) => Promise<LogisticsActionState>;
  assignments: AssignmentOption[];
  record: LogisticsRecord | null;
  text: LogisticsPanelText;
  title: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input name="recordId" type="hidden" value={record?.id ?? ""} />
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-lg font-semibold text-primary">{title}</h4>
        <span className="rounded-control bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
          {record ? text.statuses[record.status] : text.empty}
        </span>
      </div>
      {state.formError ? <p className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{text.error}</p> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold text-primary">
          <span>{text.scheduledAt}</span>
          <input className={fieldClass(Boolean(state.fieldErrors.scheduledAt))} defaultValue={toInputDate(record?.scheduledAt ?? null)} name="scheduledAt" type="datetime-local" />
        </label>
        <label className="space-y-2 text-sm font-semibold text-primary">
          <span>{text.assignedTo}</span>
          <select className={fieldClass(Boolean(state.fieldErrors.assignedTo))} defaultValue={record?.assignedTo ?? ""} name="assignedTo">
            <option value="" />
            {assignments.map((assignment) => (
              <option key={assignment.id} value={assignment.id}>{assignment.label}</option>
            ))}
          </select>
        </label>
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
          <input className={fieldClass(Boolean(state.fieldErrors.fee))} defaultValue={record?.fee ?? "0"} min="0" name="fee" step="0.01" type="number" />
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
      <Button disabled={isPending} type="submit">{isPending ? text.saving : text.save}</Button>
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
    <div className="flex flex-wrap gap-3 border-t border-border pt-4">
      {statuses.map((status) => (
        <form action={action} className="flex flex-wrap gap-2" key={status}>
          <input name="recordId" type="hidden" value={record.id} />
          <input name="targetStatus" type="hidden" value={status} />
          {status === "cancelled" ? (
            <input className="min-h-11 rounded-control border border-border px-3 text-sm" name="reason" placeholder={text.cancelledReason} required />
          ) : null}
          <Button type="submit" variant="secondary">
            {text.statuses[status]}
          </Button>
        </form>
      ))}
    </div>
  );
}

export function LogisticsPanel({ actions, assignments, logistics, text }: LogisticsPanelProps) {
  return (
    <Card className="space-y-6">
      <h3 className="text-xl font-semibold text-primary">{text.inProgress}</h3>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <LogisticsForm action={actions.savePickup} assignments={assignments} record={logistics.pickup} text={text} title={text.pickup} />
          <TransitionButtons action={actions.transitionPickup} record={logistics.pickup} text={text} />
        </div>
        <div className="space-y-4">
          <LogisticsForm action={actions.saveDelivery} assignments={assignments} record={logistics.delivery} text={text} title={text.delivery} />
          <TransitionButtons action={actions.transitionDelivery} record={logistics.delivery} text={text} />
        </div>
      </div>
    </Card>
  );
}
