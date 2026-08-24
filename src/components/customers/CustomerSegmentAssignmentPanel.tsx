"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Card } from "@/components/Card";
import type { CatalogSegmentActionState, CustomerSegmentAssignment } from "@/features/catalog-segments/types";

const initialState: CatalogSegmentActionState = { fieldErrors: {}, formError: null, success: false };

function SaveButton({ save, saving }: { save: string; saving: string }) {
  const { pending } = useFormStatus();
  return <button className="min-h-11 rounded-control bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={pending} type="submit">{pending ? saving : save}</button>;
}

export function CustomerSegmentAssignmentPanel({
  action,
  assignment,
  text,
}: {
  action: (state: CatalogSegmentActionState, formData: FormData) => Promise<CatalogSegmentActionState>;
  assignment: CustomerSegmentAssignment;
  text: { description: string; error: string; none: string; save: string; saved: string; saving: string; title: string };
}) {
  const [state, formAction] = useActionState(action, initialState);
  return (
    <Card className="space-y-4">
      <div><h3 className="text-lg font-semibold text-primary">{text.title}</h3><p className="mt-1 text-sm leading-6 text-muted">{text.description}</p></div>
      <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 space-y-1.5 text-sm font-semibold text-primary">
          <span>{text.title}</span>
          <select className="min-h-11 w-full rounded-control border border-border bg-white px-3" defaultValue={assignment.currentSegmentId ?? ""} name="catalogSegmentId">
            <option value="">{text.none}</option>
            {assignment.segments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name}</option>)}
          </select>
        </label>
        <SaveButton save={text.save} saving={text.saving} />
      </form>
      {state.success ? <p className="text-sm font-semibold text-emerald-700" role="status">{text.saved}</p> : null}
      {state.formError || Object.keys(state.fieldErrors).length > 0 ? <p className="text-sm text-red-700" role="alert">{text.error}</p> : null}
    </Card>
  );
}
