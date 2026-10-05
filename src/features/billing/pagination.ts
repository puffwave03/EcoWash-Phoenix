export const BILLING_PAGE_SIZE = 25;
export type BillingPosition = { createdAt: string; id: string };
export type BillingCursor = BillingPosition & { direction: "older" | "newer" };
export type BillingFilters = { q: string; status: "all" | "draft" | "unpaid" | "partially_paid" | "paid" | "cancelled" };

export function normalizeBillingFilters(q?: string, status?: string): BillingFilters {
  return { q: (q ?? "").trim().toLowerCase(), status: ["all", "draft", "unpaid", "partially_paid", "paid", "cancelled"].includes(status ?? "") ? status as BillingFilters["status"] : "all" };
}

export function billingFilterKey(filters: BillingFilters) {
  const normalized = normalizeBillingFilters(filters.q, filters.status);
  return JSON.stringify([normalized.q, normalized.status]);
}

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

export function encodeBillingCursor(row: BillingPosition, direction: BillingCursor["direction"], filters: BillingFilters) {
  return Buffer.from(JSON.stringify({ v: 1, createdAt: row.createdAt, id: row.id, direction, filterKey: billingFilterKey(filters) })).toString("base64url");
}

export function decodeBillingCursor(raw: string | undefined, filters: BillingFilters): BillingCursor | null {
  if (!raw || raw.length > 8192 || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  try {
    const bytes = Buffer.from(raw, "base64url");
    if (bytes.toString("base64url") !== raw) return null;
    const parsed: unknown = JSON.parse(bytes.toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const value = parsed as Record<string, unknown>;
    if (Object.keys(value).sort().join(",") !== "createdAt,direction,filterKey,id,v" || value.v !== 1
      || (value.direction !== "older" && value.direction !== "newer")
      || typeof value.id !== "string" || !UUID.test(value.id)
      || !validTimestamp(value.createdAt) || value.filterKey !== billingFilterKey(filters)) return null;
    return { createdAt: value.createdAt, id: value.id.toLowerCase(), direction: value.direction };
  } catch { return null; }
}

export function billingPage<T extends BillingPosition>(rows: T[], cursor: BillingCursor | null, filters: BillingFilters) {
  const sentinel = rows.length > BILLING_PAGE_SIZE;
  const selected = rows.slice(0, BILLING_PAGE_SIZE);
  const items = cursor?.direction === "newer" ? selected.reverse() : selected;
  const first = items[0];
  const last = items.at(-1);
  const hasNewer = cursor?.direction === "newer" ? sentinel : cursor !== null;
  const hasOlder = cursor?.direction === "newer" ? items.length > 0 : sentinel;
  return {
    items,
    newerCursor: hasNewer && first ? encodeBillingCursor(first, "newer", filters) : null,
    olderCursor: hasOlder && last ? encodeBillingCursor(last, "older", filters) : null,
  };
}

export function billingHistoryHref(filters: BillingFilters, cursor?: string) {
  const params = new URLSearchParams({ q: filters.q, status: filters.status });
  if (cursor) params.set("cursor", cursor);
  return `/app/billing?${params}`;
}
