import { Button } from "@/components/Button";
import { DisclosureSection } from "@/components/DisclosureSection";
import type { OrderHistory, ProductionStatus } from "@/features/orders/types";
import { getAllowedTransitions, requiresReason } from "@/features/orders/workflow";

type StatusTransitionText = {
  change: string;
  history: string;
  reason: string;
  statusLabels: Record<ProductionStatus, string>;
};

function previousStatus(history: OrderHistory[]) {
  return history.find((entry) => !["on_hold", "cancelled", "completed"].includes(entry.toStatus))?.toStatus ?? null;
}

export function StatusTransitionForm({
  action,
  currentStatus,
  history,
  text,
}: {
  action: (formData: FormData) => Promise<void>;
  currentStatus: ProductionStatus;
  history: OrderHistory[];
  text: StatusTransitionText;
}) {
  const allowed = getAllowedTransitions(currentStatus, previousStatus(history));

  return (
    <div className="space-y-4">
      {allowed.length > 0 ? (
        <form action={action} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <select className="min-h-11 rounded-control border border-border px-3 text-sm" name="targetStatus">
            {allowed.map((status) => (
              <option key={status} value={status}>
                {text.statusLabels[status]}
              </option>
            ))}
          </select>
          <input className="min-h-11 rounded-control border border-border px-3 text-sm" name="reason" placeholder={allowed.some(requiresReason) ? text.reason : ""} />
          <Button type="submit">{text.change}</Button>
        </form>
      ) : null}

      <DisclosureSection
        contentClassName="space-y-3"
        count={history.length}
        defaultOpen={history.length <= 3}
        summary={history[0] ? text.statusLabels[history[0].toStatus] : undefined}
        title={text.history}
      >
        {history.map((entry) => (
          <div className="rounded-control border border-border bg-white px-4 py-3 text-sm" key={entry.id}>
            <p className="font-semibold text-primary">
              {entry.fromStatus ? text.statusLabels[entry.fromStatus] : "-"} → {text.statusLabels[entry.toStatus]}
            </p>
            <p className="text-muted">{new Date(entry.changedAt).toLocaleString()}</p>
            {entry.reason ? <p className="text-muted">{entry.reason}</p> : null}
          </div>
        ))}
      </DisclosureSection>
    </div>
  );
}
