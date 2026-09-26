"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button";
import type {
  OrderStorageActionState,
  OrderStorageAssignment,
  OrderStorageMode,
  WarehousePosition,
} from "@/features/warehouse/types";

export type OrderStorageText = {
  current: string;
  empty: string;
  enteredAt: string;
  genericError: string;
  modes: Record<OrderStorageMode, string>;
  noLocation: string;
  noPositions: string;
  packageCount: string;
  position: string;
  positionError: string;
  save: string;
  saved: string;
  saving: string;
  storageMode: string;
};

const initialState: OrderStorageActionState = { fieldErrors: {}, formError: null, success: false };
const storageModes: OrderStorageMode[] = ["folded", "hanging", "mixed", "other"];

function fieldClass(hasError = false) {
  return `min-h-11 w-full rounded-control border bg-white px-3 text-sm text-foreground outline-none transition-standard focus:border-primary focus:ring-2 focus:ring-primary/20 ${
    hasError ? "border-red-300" : "border-border"
  }`;
}

export function OrderStoragePanel({
  action,
  assignment,
  enteredAt,
  hasOrderLocation,
  positions,
  text,
}: {
  action: (state: OrderStorageActionState, formData: FormData) => Promise<OrderStorageActionState>;
  assignment: OrderStorageAssignment | null;
  enteredAt: string | null;
  hasOrderLocation: boolean;
  positions: WarehousePosition[];
  text: OrderStorageText;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const unavailable = !hasOrderLocation || positions.length === 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-card border border-border bg-white p-4">
        <h4 className="font-semibold text-primary">{text.current}</h4>
        {assignment ? (
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><dt className="text-sm text-muted">{text.position}</dt><dd className="font-semibold text-primary">{assignment.positionCode}{assignment.positionName ? ` · ${assignment.positionName}` : ""}</dd></div>
            <div><dt className="text-sm text-muted">{text.packageCount}</dt><dd className="font-semibold text-primary">{assignment.packageCount}</dd></div>
            <div><dt className="text-sm text-muted">{text.storageMode}</dt><dd className="font-semibold text-primary">{text.modes[assignment.storageMode]}</dd></div>
            <div><dt className="text-sm text-muted">{text.enteredAt}</dt><dd className="font-semibold text-primary">{enteredAt}</dd></div>
          </dl>
        ) : <p className="mt-2 text-sm text-muted">{text.empty}</p>}
      </div>

      <div className="rounded-card border border-border bg-white p-4">
        {unavailable ? (
          <p className="rounded-control border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {hasOrderLocation ? text.noPositions : text.noLocation}
          </p>
        ) : (
          <form action={formAction} className="space-y-3">
            {state.formError ? <p className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.formError === "position" || state.formError === "orderLocation" ? text.positionError : text.genericError}</p> : null}
            {state.success ? <p className="rounded-control border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{text.saved}</p> : null}
            <label className="space-y-2 text-sm font-semibold text-primary">
              <span>{text.position}</span>
              <select className={fieldClass(Boolean(state.fieldErrors.positionId))} defaultValue={assignment?.positionId ?? ""} name="positionId" required>
                <option disabled value="">{text.position}</option>
                {positions.map((position) => <option key={position.id} value={position.id}>{position.code}{position.name ? ` · ${position.name}` : ""}</option>)}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-semibold text-primary">
                <span>{text.packageCount}</span>
                <input className={fieldClass(Boolean(state.fieldErrors.packageCount))} defaultValue={assignment?.packageCount ?? 1} min="1" name="packageCount" required step="1" type="number" />
              </label>
              <label className="space-y-2 text-sm font-semibold text-primary">
                <span>{text.storageMode}</span>
                <select className={fieldClass(Boolean(state.fieldErrors.storageMode))} defaultValue={assignment?.storageMode ?? "folded"} name="storageMode">
                  {storageModes.map((mode) => <option key={mode} value={mode}>{text.modes[mode]}</option>)}
                </select>
              </label>
            </div>
            <Button disabled={isPending} type="submit">{isPending ? text.saving : text.save}</Button>
          </form>
        )}
      </div>
    </div>
  );
}
