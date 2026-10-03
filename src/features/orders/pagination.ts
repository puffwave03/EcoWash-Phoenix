import type { OrderListFilters } from "@/features/orders/types";

export const ORDERS_PAGE_SIZE = 25;

export type OrderPageDirection = "older" | "newer";
export type OrderPagePosition = { createdAt: string; id: string };
export type OrderPageCursor = OrderPagePosition & { direction: OrderPageDirection };
export type OrderPagination = {
  hasNewer: boolean;
  hasOlder: boolean;
  newerCursor: string | null;
  olderCursor: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

function validTimestamp(value: string) {
  const match = TIMESTAMP.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth
    && hour <= 23 && minute <= 59 && second <= 59;
}

export function orderFilterKey(filters: OrderListFilters) {
  return JSON.stringify([filters.query, filters.status, filters.priority, filters.active]);
}

export function encodeOrderCursor(
  position: OrderPagePosition,
  direction: OrderPageDirection,
  filters: OrderListFilters,
) {
  return Buffer.from(JSON.stringify({
    v: 1,
    createdAt: position.createdAt,
    id: position.id,
    direction,
    filterKey: orderFilterKey(filters),
  })).toString("base64url");
}

export function decodeOrderCursor(raw: string | undefined, filters: OrderListFilters): OrderPageCursor | null {
  if (!raw || raw.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  try {
    const decoded = Buffer.from(raw, "base64url");
    if (decoded.toString("base64url") !== raw) return null;
    const value: unknown = JSON.parse(decoded.toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const cursor = value as Record<string, unknown>;
    if (Object.keys(cursor).sort().join(",") !== "createdAt,direction,filterKey,id,v") return null;
    if (cursor.v !== 1 || cursor.filterKey !== orderFilterKey(filters)) return null;
    if (cursor.direction !== "older" && cursor.direction !== "newer") return null;
    if (typeof cursor.createdAt !== "string" || !validTimestamp(cursor.createdAt)) return null;
    if (typeof cursor.id !== "string" || !UUID.test(cursor.id)) return null;
    return { createdAt: cursor.createdAt, id: cursor.id.toLowerCase(), direction: cursor.direction };
  } catch {
    return null;
  }
}

export function orderCursorBoundary(cursor: OrderPageCursor) {
  const operator = cursor.direction === "older" ? "lt" : "gt";
  return `created_at.${operator}.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.${operator}.${cursor.id})`;
}

export function paginateOrderRows<T extends { created_at: string; id: string }>(
  rows: T[],
  cursor: OrderPageCursor | null,
  filters: OrderListFilters,
) {
  const hasSentinel = rows.length > ORDERS_PAGE_SIZE;
  const selected = rows.slice(0, ORDERS_PAGE_SIZE);
  const visible = cursor?.direction === "newer" ? selected.reverse() : selected;
  const first = visible[0];
  const last = visible.at(-1);
  const hasNewer = cursor?.direction === "newer" ? hasSentinel : cursor !== null;
  const hasOlder = cursor?.direction === "newer" ? visible.length > 0 : hasSentinel;
  return {
    visible,
    pagination: {
      hasNewer,
      hasOlder,
      newerCursor: hasNewer && first
        ? encodeOrderCursor({ createdAt: first.created_at, id: first.id }, "newer", filters)
        : null,
      olderCursor: hasOlder && last
        ? encodeOrderCursor({ createdAt: last.created_at, id: last.id }, "older", filters)
        : null,
    } satisfies OrderPagination,
  };
}

export function orderHistoryHref(filters: OrderListFilters, cursor?: string) {
  const params = new URLSearchParams({
    q: filters.query,
    status: filters.status,
    priority: filters.priority,
    active: filters.active,
  });
  if (cursor) params.set("cursor", cursor);
  return `/app/orders?${params.toString()}`;
}
