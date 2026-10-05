export const DAILY_CLOSE_HISTORY_PAGE_SIZE = 25;

export type DailyCloseHistoryFilters = {
  businessDate?: string;
  locationId?: string | "organization";
};

export type DailyCloseHistoryPosition = {
  businessDate: string;
  closedAt: string;
  id: string;
};

export type DailyCloseHistoryCursor = DailyCloseHistoryPosition & {
  direction: "older" | "newer";
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

function validDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = DATE.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  return year >= 1 && month >= 1 && month <= 12 && day >= 1
    && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function validTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = TIMESTAMP.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  return validDate(`${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`)
    && hour <= 23 && minute <= 59 && second <= 59;
}

export function normalizeDailyCloseHistoryFilters(filters: DailyCloseHistoryFilters): DailyCloseHistoryFilters {
  return {
    businessDate: validDate(filters.businessDate) ? filters.businessDate : undefined,
    locationId: filters.locationId === "organization" || (typeof filters.locationId === "string" && UUID.test(filters.locationId))
      ? filters.locationId?.toLowerCase() : undefined,
  };
}

export function dailyCloseHistoryFilterKey(filters: DailyCloseHistoryFilters) {
  const normalized = normalizeDailyCloseHistoryFilters(filters);
  return JSON.stringify([normalized.businessDate ?? "", normalized.locationId ?? ""]);
}

export function encodeDailyCloseHistoryCursor(row: DailyCloseHistoryPosition, direction: DailyCloseHistoryCursor["direction"], filters: DailyCloseHistoryFilters) {
  return Buffer.from(JSON.stringify({ v: 1, businessDate: row.businessDate, closedAt: row.closedAt, id: row.id, direction, filterKey: dailyCloseHistoryFilterKey(filters) })).toString("base64url");
}

export function decodeDailyCloseHistoryCursor(raw: string | undefined, filters: DailyCloseHistoryFilters): DailyCloseHistoryCursor | null {
  if (!raw || raw.length > 8192 || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  try {
    const bytes = Buffer.from(raw, "base64url");
    if (bytes.toString("base64url") !== raw) return null;
    const parsed: unknown = JSON.parse(bytes.toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const value = parsed as Record<string, unknown>;
    if (Object.keys(value).sort().join(",") !== "businessDate,closedAt,direction,filterKey,id,v"
      || value.v !== 1 || (value.direction !== "older" && value.direction !== "newer")
      || !validDate(value.businessDate) || !validTimestamp(value.closedAt)
      || typeof value.id !== "string" || !UUID.test(value.id)
      || value.filterKey !== dailyCloseHistoryFilterKey(filters)) return null;
    return { businessDate: value.businessDate, closedAt: value.closedAt, id: value.id.toLowerCase(), direction: value.direction };
  } catch { return null; }
}

export function dailyCloseHistoryKeyset(cursor: DailyCloseHistoryCursor) {
  const comparison = cursor.direction === "older" ? "lt" : "gt";
  return `business_date.${comparison}.${cursor.businessDate},and(business_date.eq.${cursor.businessDate},closed_at.${comparison}.${cursor.closedAt}),and(business_date.eq.${cursor.businessDate},closed_at.eq.${cursor.closedAt},id.${comparison}.${cursor.id})`;
}

export function dailyCloseHistoryPage<T extends DailyCloseHistoryPosition>(rows: T[], cursor: DailyCloseHistoryCursor | null, filters: DailyCloseHistoryFilters) {
  const sentinel = rows.length > DAILY_CLOSE_HISTORY_PAGE_SIZE;
  const selected = rows.slice(0, DAILY_CLOSE_HISTORY_PAGE_SIZE);
  const items = cursor?.direction === "newer" ? selected.reverse() : selected;
  const first = items[0];
  const last = items.at(-1);
  const hasNewer = cursor?.direction === "newer" ? sentinel : cursor !== null;
  const hasOlder = cursor?.direction === "newer" ? items.length > 0 : sentinel;
  return {
    items,
    newerCursor: hasNewer && first ? encodeDailyCloseHistoryCursor(first, "newer", filters) : null,
    olderCursor: hasOlder && last ? encodeDailyCloseHistoryCursor(last, "older", filters) : null,
  };
}

export function dailyCloseHistoryHref(filters: DailyCloseHistoryFilters, cursor?: string) {
  const normalized = normalizeDailyCloseHistoryFilters(filters);
  const params = new URLSearchParams();
  if (normalized.businessDate) params.set("date", normalized.businessDate);
  if (normalized.locationId) params.set("scope", normalized.locationId);
  if (cursor) params.set("cursor", cursor);
  const query = params.toString();
  return `/app/daily-close/history${query ? `?${query}` : ""}`;
}
