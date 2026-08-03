import "server-only";

import type { ProductionStatus } from "@/features/orders/types";
import type { DerivedPaymentStatus, PaymentRecordStatus } from "@/features/payments/types";

export const DEFAULT_ORGANIZATION_TIME_ZONE = "Atlantic/Canary";
export const OPEN_PRODUCTION_STATUSES: ProductionStatus[] = [
  "draft",
  "received",
  "washing",
  "drying",
  "ironing",
  "quality_check",
  "packing",
  "ready",
  "on_hold",
];

type ZonedDateParts = {
  day: number;
  month: number;
  year: number;
};

type ZonedDateTimeParts = ZonedDateParts & {
  hour: number;
  minute: number;
  second: number;
};

export type PaymentLike = {
  amount: number;
  order_id: string;
  status: PaymentRecordStatus;
};

export type PayableOrderLike = {
  id: string;
  total: number;
};

export function relationOne<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function relationName(value: { display_name?: string; name?: string } | { display_name?: string; name?: string }[] | null) {
  const row = relationOne(value);

  return row?.display_name ?? row?.name ?? null;
}

function numericDateTimePart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
) {
  const part = parts.find((item) => item.type === type);
  const value = part ? Number(part.value) : NaN;

  if (!Number.isFinite(value)) {
    throw new Error(`Missing timezone date part: ${type}`);
  }

  return value;
}

function zonedParts(value: Date, timeZone: string): ZonedDateTimeParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  });
  const parts = formatter.formatToParts(value);

  return {
    day: numericDateTimePart(parts, "day"),
    hour: numericDateTimePart(parts, "hour"),
    minute: numericDateTimePart(parts, "minute"),
    month: numericDateTimePart(parts, "month"),
    second: numericDateTimePart(parts, "second"),
    year: numericDateTimePart(parts, "year"),
  };
}

function timeZoneOffsetMs(value: Date, timeZone: string) {
  const parts = zonedParts(value, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return asUtc - value.getTime();
}

function zonedLocalDateTimeToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
) {
  const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const firstPass = new Date(utcGuess - timeZoneOffsetMs(new Date(utcGuess), timeZone));

  return new Date(utcGuess - timeZoneOffsetMs(firstPass, timeZone));
}

function tomorrowParts(year: number, month: number, day: number): ZonedDateParts {
  const next = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));

  return {
    day: next.getUTCDate(),
    month: next.getUTCMonth() + 1,
    year: next.getUTCFullYear(),
  };
}

export function safeTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return DEFAULT_ORGANIZATION_TIME_ZONE;
  }
}

export function todayWindow(timeZone: string) {
  const resolvedTimeZone = safeTimeZone(timeZone);
  const now = new Date();
  const today = zonedParts(now, resolvedTimeZone);
  const tomorrow = tomorrowParts(today.year, today.month, today.day);
  const start = zonedLocalDateTimeToUtc(resolvedTimeZone, today.year, today.month, today.day);
  const end = new Date(
    zonedLocalDateTimeToUtc(resolvedTimeZone, tomorrow.year, tomorrow.month, tomorrow.day).getTime() - 1,
  );

  return { end, now, start, timeZone: resolvedTimeZone };
}

export function moneyString(amount: number) {
  return (Math.round(amount * 100) / 100).toFixed(2);
}

export function paymentTotals(order: PayableOrderLike, payments: PaymentLike[]) {
  let confirmed = 0;
  let refunded = 0;
  let voidCount = 0;

  for (const payment of payments) {
    if (payment.order_id !== order.id) continue;
    if (payment.status === "confirmed") confirmed += payment.amount;
    if (payment.status === "refunded") refunded += payment.amount;
    if (payment.status === "void") voidCount += 1;
  }

  const totalPaid = Math.round((confirmed - refunded) * 100) / 100;
  const balanceDue = Math.round(Math.max(order.total - totalPaid, 0) * 100) / 100;
  let paymentStatus: DerivedPaymentStatus = "unpaid";

  if (order.total <= 0) paymentStatus = "paid";
  else if (totalPaid <= 0 && refunded > 0) paymentStatus = "refunded";
  else if (totalPaid <= 0 && confirmed === 0 && voidCount > 0) paymentStatus = "void";
  else if (totalPaid <= 0) paymentStatus = "unpaid";
  else if (totalPaid < order.total) paymentStatus = "partially_paid";
  else paymentStatus = "paid";

  return { balanceDue, paymentStatus, totalPaid };
}

export function isOpenProductionStatus(status: ProductionStatus) {
  return OPEN_PRODUCTION_STATUSES.includes(status);
}
