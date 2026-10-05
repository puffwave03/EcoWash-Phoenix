export const PORTAL_ORDER_PAGE_SIZE = 25;
export const PORTAL_ORDER_FETCH_SIZE = PORTAL_ORDER_PAGE_SIZE + 1;

export type PortalOrderPageDirection = "older" | "newer";
export type PortalOrderPagePosition = { createdAt: string; id: string };
export type PortalOrderPageCursor = PortalOrderPagePosition & {
  direction: PortalOrderPageDirection;
};
export type PortalOrderPagination = {
  hasNewer: boolean;
  hasOlder: boolean;
  isLatest: boolean;
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

export function encodePortalOrderCursor(
  position: PortalOrderPagePosition,
  direction: PortalOrderPageDirection,
) {
  return Buffer.from(JSON.stringify({
    v: 1,
    createdAt: position.createdAt,
    id: position.id,
    direction,
  })).toString("base64url");
}

export function decodePortalOrderCursor(raw: string | undefined): PortalOrderPageCursor | null {
  if (!raw || raw.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  try {
    const decoded = Buffer.from(raw, "base64url");
    if (decoded.toString("base64url") !== raw) return null;
    const value: unknown = JSON.parse(decoded.toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const cursor = value as Record<string, unknown>;
    if (Object.keys(cursor).sort().join(",") !== "createdAt,direction,id,v") return null;
    if (cursor.v !== 1) return null;
    if (cursor.direction !== "older" && cursor.direction !== "newer") return null;
    if (typeof cursor.createdAt !== "string" || !validTimestamp(cursor.createdAt)) return null;
    if (typeof cursor.id !== "string" || !UUID.test(cursor.id)) return null;
    return {
      createdAt: cursor.createdAt,
      direction: cursor.direction,
      id: cursor.id.toLowerCase(),
    };
  } catch {
    return null;
  }
}

export function paginatePortalOrderRows<T extends { created_at: string; id: string }>(
  rows: T[],
  cursor: PortalOrderPageCursor | null,
) {
  const hasSentinel = rows.length > PORTAL_ORDER_PAGE_SIZE;
  const selected = rows.slice(0, PORTAL_ORDER_PAGE_SIZE);
  const visible = cursor?.direction === "newer" ? selected.reverse() : selected;
  const first = visible[0];
  const last = visible.at(-1);
  const hasNewer = cursor?.direction === "newer" ? hasSentinel : cursor !== null;
  const hasOlder = cursor?.direction === "newer" ? visible.length > 0 : hasSentinel;

  return {
    pagination: {
      hasNewer,
      hasOlder,
      isLatest: cursor === null,
      newerCursor: hasNewer && first
        ? encodePortalOrderCursor({ createdAt: first.created_at, id: first.id }, "newer")
        : null,
      olderCursor: hasOlder && last
        ? encodePortalOrderCursor({ createdAt: last.created_at, id: last.id }, "older")
        : null,
    } satisfies PortalOrderPagination,
    visible,
  };
}

export function portalOrderHistoryHref(cursor?: string) {
  return cursor ? `/portal/orders?cursor=${encodeURIComponent(cursor)}` : "/portal/orders";
}
