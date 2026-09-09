import type { ProductionStatus } from "@/features/orders/types";

type LogisticsParent = {
  isActive: boolean;
  productionStatus: ProductionStatus;
};

export function isOperationalLogisticsParent({
  isActive,
  productionStatus,
}: LogisticsParent) {
  return (
    isActive &&
    productionStatus !== "draft" &&
    productionStatus !== "cancelled"
  );
}
