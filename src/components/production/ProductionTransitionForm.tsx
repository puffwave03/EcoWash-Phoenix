"use client";

import { useState } from "react";
import { operationalPrimaryActionClasses } from "@/components/operational/OperationalUi";
import { ReadyWarehouseFields, type ReadyWarehouseText } from "@/components/warehouse/ReadyWarehouseFields";
import type { ProductionStatus } from "@/features/orders/types";
import type { ReadyWarehousePlacement } from "@/features/warehouse/types";
import { requiresReason } from "@/features/orders/workflow";

export function ProductionTransitionForm({
  action,
  allowedTransitions,
  canConfigureWarehouse,
  locale,
  readyError,
  readyPlacement,
  readyText,
  text,
}: {
  action: (formData: FormData) => Promise<void>;
  allowedTransitions: ProductionStatus[];
  canConfigureWarehouse: boolean;
  locale: string;
  readyError?: string;
  readyPlacement: ReadyWarehousePlacement;
  readyText: ReadyWarehouseText;
  text: {
    action: string;
    noActions: string;
    reason: string;
    selectPhase: string;
    statuses: Record<ProductionStatus, string>;
  };
}) {
  const [targetStatus, setTargetStatus] = useState<ProductionStatus | "">(
    allowedTransitions[0] ?? "",
  );
  const reasonRequired = targetStatus ? requiresReason(targetStatus) : false;

  if (allowedTransitions.length === 0) {
    return <p className="text-sm leading-6 text-muted">{text.noActions}</p>;
  }

  return (
    <form action={action} className="space-y-3">
      <label className="block space-y-2 text-sm font-semibold text-primary">
        <span>{text.selectPhase}</span>
        <select
          className="min-h-12 w-full rounded-control border border-border bg-white px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          name="targetStatus"
          onChange={(event) => setTargetStatus(event.target.value as ProductionStatus)}
          required
          value={targetStatus}
        >
          {allowedTransitions.map((status) => (
            <option key={status} value={status}>{text.statuses[status]}</option>
          ))}
        </select>
      </label>
      {reasonRequired ? (
        <label className="block space-y-2 text-sm font-semibold text-primary">
          <span>{text.reason}</span>
          <input
            className="min-h-12 w-full rounded-control border border-border bg-white px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            maxLength={600}
            name="reason"
            required
          />
        </label>
      ) : null}
      {targetStatus === "ready" ? (
        <ReadyWarehouseFields
          canConfigure={canConfigureWarehouse}
          error={readyError}
          locale={locale}
          placement={readyPlacement}
          text={readyText}
        />
      ) : null}
      <button
        className={operationalPrimaryActionClasses}
        disabled={targetStatus === "ready" && (!readyPlacement.assignment || readyPlacement.positions.length === 0)}
        type="submit"
      >
        {text.action}
      </button>
    </form>
  );
}
