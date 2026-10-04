import type { CustomerAccountPeriod } from "@/features/customer-account/types";

export const CUSTOMER_ACCOUNT_PAGE_SIZE = 25;
export type AccountDirection = "older" | "newer";
export type AccountOrderCursor = { createdAt: string; id: string; direction: AccountDirection };
export type AccountPaymentCursor = AccountOrderCursor & { paidAt: string };
export type AccountNavigation = { olderCursor: string | null; newerCursor: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

function validTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = TIMESTAMP.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth
    && hour <= 23 && minute <= 59 && second <= 59;
}

function decode(raw: string | undefined, customerId: string, period: CustomerAccountPeriod, keys: string): Record<string, unknown> | null {
  if (!raw || raw.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(raw) || period === "recent") return null;
  try {
    const bytes = Buffer.from(raw, "base64url");
    if (bytes.toString("base64url") !== raw) return null;
    const parsed: unknown = JSON.parse(bytes.toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const value = parsed as Record<string, unknown>;
    if (Object.keys(value).sort().join(",") !== keys || value.v !== 1
      || value.customerId !== customerId || value.period !== period
      || (value.direction !== "older" && value.direction !== "newer")
      || typeof value.id !== "string" || !UUID.test(value.id)
      || !validTimestamp(value.createdAt)) return null;
    return value;
  } catch { return null; }
}

export function decodeAccountOrderCursor(raw: string | undefined, customerId: string, period: CustomerAccountPeriod): AccountOrderCursor | null {
  const value = decode(raw, customerId, period, "createdAt,customerId,direction,id,period,v");
  return value ? { createdAt: value.createdAt as string, id: (value.id as string).toLowerCase(), direction: value.direction as AccountDirection } : null;
}

export function decodeAccountPaymentCursor(raw: string | undefined, customerId: string, period: CustomerAccountPeriod): AccountPaymentCursor | null {
  const value = decode(raw, customerId, period, "createdAt,customerId,direction,id,paidAt,period,v");
  return value && validTimestamp(value.paidAt)
    ? { createdAt: value.createdAt as string, paidAt: value.paidAt, id: (value.id as string).toLowerCase(), direction: value.direction as AccountDirection }
    : null;
}

function encode(position: AccountOrderCursor | AccountPaymentCursor, customerId: string, period: CustomerAccountPeriod) {
  return Buffer.from(JSON.stringify({ v: 1, ...position, customerId, period })).toString("base64url");
}

export function paginateAccountRows<T extends { id: string }>(
  rows: T[], cursor: AccountOrderCursor | AccountPaymentCursor | null,
  position: (row: T, direction: AccountDirection) => AccountOrderCursor | AccountPaymentCursor,
  customerId: string, period: CustomerAccountPeriod,
) {
  const sentinel = rows.length > CUSTOMER_ACCOUNT_PAGE_SIZE;
  const selected = rows.slice(0, CUSTOMER_ACCOUNT_PAGE_SIZE);
  const items = cursor?.direction === "newer" ? selected.reverse() : selected;
  const first = items[0];
  const last = items.at(-1);
  const hasNewer = cursor?.direction === "newer" ? sentinel : cursor !== null;
  const hasOlder = cursor?.direction === "newer" ? items.length > 0 : sentinel;
  return {
    items,
    navigation: {
      newerCursor: hasNewer && first ? encode(position(first, "newer"), customerId, period) : null,
      olderCursor: hasOlder && last ? encode(position(last, "older"), customerId, period) : null,
    } satisfies AccountNavigation,
  };
}

export function accountHistoryHref(customerId: string, period: CustomerAccountPeriod, orderCursor: string | null, paymentCursor: string | null) {
  const params = new URLSearchParams({ period });
  if (orderCursor) params.set("orderCursor", orderCursor);
  if (paymentCursor) params.set("paymentCursor", paymentCursor);
  return `/app/customers/${customerId}?${params.toString()}`;
}
