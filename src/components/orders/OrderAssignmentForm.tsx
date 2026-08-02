"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button";
import type { OrderActionState } from "@/features/orders/types";
import type { AssignmentOption } from "@/features/orders/server/queries";

type OrderAssignmentText = {
  assignedTo: string;
  error: string;
  none: string;
  save: string;
  saving: string;
  staffReadonly: string;
  success: string;
};

const initialState: OrderActionState = { fieldErrors: {}, formError: null, success: false };

function fieldClass(hasError = false) {
  return `min-h-11 w-full rounded-control border bg-white px-3 text-sm text-foreground outline-none transition-standard focus:border-primary focus:ring-2 focus:ring-primary/20 ${
    hasError ? "border-red-300" : "border-border"
  }`;
}

export function OrderAssignmentForm({
  action,
  assignments,
  assignedTo,
  assignedToName,
  canAssign,
  text,
}: {
  action: (state: OrderActionState, formData: FormData) => Promise<OrderActionState>;
  assignments: AssignmentOption[];
  assignedTo: string | null;
  assignedToName: string | null;
  canAssign: boolean;
  text: OrderAssignmentText;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  if (!canAssign) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-primary">{text.assignedTo}</p>
        <p className="rounded-control border border-border bg-white px-4 py-3 text-sm text-muted">
          {assignedToName || text.none}
        </p>
        <p className="text-xs text-muted">{text.staffReadonly}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      {state.formError ? <p className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{text.error}</p> : null}
      {state.success ? <p className="rounded-control border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{text.success}</p> : null}
      <label className="space-y-2 text-sm font-semibold text-primary">
        <span>{text.assignedTo}</span>
        <select className={fieldClass(Boolean(state.fieldErrors.assignedTo))} defaultValue={assignedTo ?? ""} name="assignedTo">
          <option value="">{text.none}</option>
          {assignments.map((assignment) => (
            <option key={assignment.id} value={assignment.id}>{assignment.label}</option>
          ))}
        </select>
      </label>
      <Button disabled={isPending} type="submit">{isPending ? text.saving : text.save}</Button>
    </form>
  );
}
