export const POS_HISTORY_PAGE_SIZE = 25;

export type PosPageDirection = "older" | "newer";
export type PosPagePosition = { timestamp: string; id: string };
export type PosPageCursor = PosPagePosition & { direction: PosPageDirection };
export type PosPaymentCursor = PosPageCursor & { sessionId: string };
export type PosPagination = {
  newerCursor: string | null;
  olderCursor: string | null;
};
export type PosPage<T> = { items: T[]; pagination: PosPagination };
export type PosNavigation = { latestHref: string | null; newerHref: string | null; olderHref: string | null; currentCursor: string | null };

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

function decode(raw: string | undefined): Record<string, unknown> | null {
  if (!raw || raw.length > 512 || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  try {
    const decoded = Buffer.from(raw, "base64url");
    if (decoded.toString("base64url") !== raw) return null;
    const value: unknown = JSON.parse(decoded.toString("utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function validPosition(value: Record<string, unknown>, timestampKey: "openedAt" | "createdAt") {
  return value.v === 1 && (value.direction === "older" || value.direction === "newer")
    && typeof value[timestampKey] === "string" && validTimestamp(value[timestampKey])
    && typeof value.id === "string" && UUID.test(value.id);
}

export function encodePosSessionCursor(position: PosPagePosition, direction: PosPageDirection) {
  return Buffer.from(JSON.stringify({ v: 1, openedAt: position.timestamp, id: position.id, direction })).toString("base64url");
}

export function decodePosSessionCursor(raw: string | undefined): PosPageCursor | null {
  const value = decode(raw);
  if (!value || Object.keys(value).sort().join(",") !== "direction,id,openedAt,v" || !validPosition(value, "openedAt")) return null;
  return { timestamp: value.openedAt as string, id: (value.id as string).toLowerCase(), direction: value.direction as PosPageDirection };
}

export function encodePosPaymentCursor(position: PosPagePosition, direction: PosPageDirection, sessionId: string) {
  return Buffer.from(JSON.stringify({ v: 1, createdAt: position.timestamp, id: position.id, direction, sessionId })).toString("base64url");
}

export function decodePosPaymentCursor(raw: string | undefined, sessionId: string): PosPaymentCursor | null {
  const value = decode(raw);
  if (!value || Object.keys(value).sort().join(",") !== "createdAt,direction,id,sessionId,v" || !validPosition(value, "createdAt")
    || typeof value.sessionId !== "string" || !UUID.test(value.sessionId) || value.sessionId !== sessionId) return null;
  return { timestamp: value.createdAt as string, id: (value.id as string).toLowerCase(), direction: value.direction as PosPageDirection, sessionId };
}

export function posCursorBoundary(column: "opened_at" | "created_at", cursor: PosPageCursor) {
  const operator = cursor.direction === "older" ? "lt" : "gt";
  return `${column}.${operator}.${cursor.timestamp},and(${column}.eq.${cursor.timestamp},id.${operator}.${cursor.id})`;
}

export function paginatePosRows<T extends { id: string }>(
  rows: T[],
  cursor: PosPageCursor | null,
  timestamp: (row: T) => string,
  encode: (position: PosPagePosition, direction: PosPageDirection) => string,
): PosPage<T> {
  const hasSentinel = rows.length > POS_HISTORY_PAGE_SIZE;
  const selected = rows.slice(0, POS_HISTORY_PAGE_SIZE);
  const items = cursor?.direction === "newer" ? selected.reverse() : selected;
  const first = items[0];
  const last = items.at(-1);
  const hasNewer = cursor?.direction === "newer" ? hasSentinel : cursor !== null;
  const hasOlder = cursor?.direction === "newer" ? items.length > 0 : hasSentinel;
  return {
    items,
    pagination: {
      newerCursor: hasNewer && first ? encode({ timestamp: timestamp(first), id: first.id }, "newer") : null,
      olderCursor: hasOlder && last ? encode({ timestamp: timestamp(last), id: last.id }, "older") : null,
    },
  };
}

export function posHistoryHref(query: string, paymentCursor: string | null, historyCursor: string | null) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (paymentCursor) params.set("paymentCursor", paymentCursor);
  if (historyCursor) params.set("historyCursor", historyCursor);
  const suffix = params.toString();
  return `/app/pos${suffix ? `?${suffix}` : ""}`;
}
