import { Card } from "@/components/Card";
import { CustomerLifecycleButton } from "@/components/customers/CustomerLifecycleButton";
import { StatusBadge } from "@/components/operational/OperationalUi";
import type {
  CustomerLifecycleBlockingReason,
  CustomerLifecycleEligibility,
} from "@/features/customer-lifecycle/types";

type LifecycleText = {
  active: string;
  activeDescription: string;
  anonymizationUnavailable: string;
  blockers: Record<CustomerLifecycleBlockingReason, string>;
  confirmDeactivate: string;
  deactivate: string;
  deactivating: string;
  description: string;
  emptyEligibility: string;
  hardDeleteBlocked: string;
  hardDeleteEligible: string;
  inactive: string;
  inactiveDescription: string;
  portalReenable: string;
  protectedActions: string;
  reactivate: string;
  reactivating: string;
  retainedHistory: string;
  title: string;
};

export function CustomerLifecycleControl({
  deactivateAction,
  eligibility,
  isActive,
  reactivateAction,
  text,
}: {
  deactivateAction: () => Promise<void>;
  eligibility: CustomerLifecycleEligibility | null;
  isActive: boolean;
  reactivateAction: () => Promise<void>;
  text: LifecycleText;
}) {
  return (
    <Card className="space-y-5 bg-white">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-secondary">{text.title}</p>
          <h3 className="mt-1 text-lg font-semibold text-primary">{isActive ? text.active : text.inactive}</h3>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted">{isActive ? text.activeDescription : text.inactiveDescription}</p>
        </div>
        <StatusBadge tone={isActive ? "success" : "neutral"}>{isActive ? text.active : text.inactive}</StatusBadge>
      </div>

      <p className="rounded-control border border-border bg-[#fafbfa] px-4 py-3 text-sm leading-6 text-muted">
        {text.retainedHistory}
      </p>

      <div>
        {isActive ? (
          <CustomerLifecycleButton
            action={deactivateAction}
            confirmLabel={text.confirmDeactivate}
            label={text.deactivate}
            pendingLabel={text.deactivating}
            variant="danger"
          />
        ) : (
          <div className="space-y-2">
            <CustomerLifecycleButton action={reactivateAction} label={text.reactivate} pendingLabel={text.reactivating} variant="primary" />
            <p className="text-xs leading-5 text-muted">{text.portalReenable}</p>
          </div>
        )}
      </div>

      <div className="border-t border-red-100 pt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-red-700">{text.protectedActions}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-control border border-border bg-[#fafbfa] p-3 text-sm leading-6 text-muted">{text.anonymizationUnavailable}</div>
          <div className="rounded-control border border-border bg-[#fafbfa] p-3 text-sm leading-6 text-muted">
            {!eligibility ? text.emptyEligibility : eligibility.canHardDelete ? text.hardDeleteEligible : text.hardDeleteBlocked}
          </div>
        </div>
        {eligibility && eligibility.blockingReasons.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label={text.description}>
            {eligibility.blockingReasons.map((reason) => (
              <li className="rounded-full border border-red-100 bg-red-50/60 px-3 py-1 text-xs font-semibold text-red-800" key={reason}>{text.blockers[reason]}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </Card>
  );
}
