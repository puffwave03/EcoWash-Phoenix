import type { CustomerListFilters } from "@/features/customers/types";

export const CUSTOMER_PAGE_SIZE = 25;
export type CustomerCursor = { displayName: string; id: string; direction: "next" | "previous" };
export type CustomerPage<T> = { items: T[]; nextCursor: string | null; previousCursor: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function customerFilterKey(filters: CustomerListFilters) {
  return JSON.stringify([filters.query, filters.status]);
}

export function encodeCustomerCursor(row: { displayName: string; id: string }, direction: CustomerCursor["direction"], filters: CustomerListFilters) {
  return Buffer.from(JSON.stringify({ v: 1, displayName: row.displayName, id: row.id, direction, filterKey: customerFilterKey(filters) })).toString("base64url");
}

export function decodeCustomerCursor(raw: string | undefined, filters: CustomerListFilters): CustomerCursor | null {
  if (!raw || raw.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  try {
    const bytes = Buffer.from(raw, "base64url");
    if (bytes.toString("base64url") !== raw) return null;
    const parsed: unknown = JSON.parse(bytes.toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const value = parsed as Record<string, unknown>;
    if (Object.keys(value).sort().join(",") !== "direction,displayName,filterKey,id,v"
      || value.v !== 1 || value.filterKey !== customerFilterKey(filters)
      || (value.direction !== "next" && value.direction !== "previous")
      || typeof value.displayName !== "string" || !value.displayName || value.displayName.length > 500
      || typeof value.id !== "string" || !UUID.test(value.id)) return null;
    return { displayName: value.displayName, id: value.id.toLowerCase(), direction: value.direction };
  } catch { return null; }
}

export function customerPage<T extends { displayName: string; id: string }>(rows: T[], cursor: CustomerCursor | null, filters: CustomerListFilters): CustomerPage<T> {
  const sentinel = rows.length > CUSTOMER_PAGE_SIZE;
  const selected = rows.slice(0, CUSTOMER_PAGE_SIZE);
  const items = cursor?.direction === "previous" ? selected.reverse() : selected;
  const first = items[0];
  const last = items.at(-1);
  const hasPrevious = cursor?.direction === "previous" ? sentinel : cursor !== null;
  const hasNext = cursor?.direction === "previous" ? items.length > 0 : sentinel;
  return {
    items,
    previousCursor: hasPrevious && first ? encodeCustomerCursor(first, "previous", filters) : null,
    nextCursor: hasNext && last ? encodeCustomerCursor(last, "next", filters) : null,
  };
}

export function customerListHref(filters: CustomerListFilters, cursor?: string) {
  const params = new URLSearchParams({ q: filters.query, status: filters.status });
  if (cursor) params.set("cursor", cursor);
  return `/app/customers?${params.toString()}`;
}
