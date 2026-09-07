import type { Payment } from "@/features/payments/types";

const toCents = (amount: number) => Math.round(amount * 100);

export function getNetCollected(payments: Payment[]) {
  let netCents = 0;

  for (const payment of payments) {
    if (payment.status === "confirmed") netCents += toCents(payment.amount);
    if (payment.status === "refunded") netCents -= toCents(payment.amount);
  }

  return Math.max(netCents, 0) / 100;
}

export function getRefundableAmount(payment: Payment, payments: Payment[]) {
  if (payment.status !== "confirmed") return 0;

  let refundedCents = 0;
  for (const candidate of payments) {
    if (candidate.status === "refunded" && candidate.refundedFromPaymentId === payment.id) {
      refundedCents += toCents(candidate.amount);
    }
  }

  return Math.max(toCents(payment.amount) - refundedCents, 0) / 100;
}
