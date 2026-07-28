import type { AppRole } from "@/lib/auth/types";
import type { ProductionStatus } from "@/features/orders/types";

export const FINAL_PRODUCTION_STATUSES: ProductionStatus[] = ["completed", "cancelled"];

export const PRODUCTION_TRANSITIONS: Record<ProductionStatus, ProductionStatus[]> = {
  cancelled: [],
  completed: [],
  draft: ["received", "cancelled"],
  drying: ["ironing", "quality_check", "packing", "on_hold"],
  ironing: ["quality_check", "packing", "on_hold"],
  on_hold: ["cancelled"],
  packing: ["ready", "on_hold"],
  quality_check: ["packing", "on_hold"],
  ready: ["completed", "on_hold"],
  received: ["washing", "ironing", "quality_check", "on_hold", "cancelled"],
  washing: ["drying", "quality_check", "on_hold"],
};

export function getAllowedTransitions(
  currentStatus: ProductionStatus,
  previousProductionStatus?: ProductionStatus | null,
): ProductionStatus[] {
  if (currentStatus !== "on_hold") return PRODUCTION_TRANSITIONS[currentStatus];

  return previousProductionStatus
    ? [previousProductionStatus, "cancelled"]
    : ["cancelled"];
}

export function requiresReason(status: ProductionStatus) {
  return status === "on_hold" || status === "cancelled";
}

export function canEditCatalog(role: AppRole) {
  return role === "owner" || role === "manager";
}
