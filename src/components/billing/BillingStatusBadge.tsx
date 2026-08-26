import { StatusBadge } from "@/components/operational/OperationalUi";
import type { BillingPaymentStatus } from "@/features/billing/types";

export function BillingStatusBadge({ label, status }: { label: string; status: BillingPaymentStatus }) {
  const tone = status === "paid"
    ? "success"
    : status === "unpaid" || status === "partially_paid"
      ? "warning"
      : status === "cancelled"
        ? "critical"
        : "neutral";
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}
