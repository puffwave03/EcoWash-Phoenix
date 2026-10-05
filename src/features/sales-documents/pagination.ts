export const SALES_DOCUMENT_PAGE_SIZE = 25;
export type SalesDocumentPosition = { issuedAt: string; documentNumber: string; kind: "receipt" | "invoice"; id: string };
export type SalesDocumentCursor = SalesDocumentPosition & { direction: "older" | "newer" };

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

export function encodeSalesDocumentCursor(row: SalesDocumentPosition, direction: SalesDocumentCursor["direction"]) {
  return Buffer.from(JSON.stringify({ v: 1, issuedAt: row.issuedAt, documentNumber: row.documentNumber, kind: row.kind, id: row.id, direction })).toString("base64url");
}

export function decodeSalesDocumentCursor(raw: string | undefined): SalesDocumentCursor | null {
  if (!raw || raw.length > 8192 || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  try {
    const bytes = Buffer.from(raw, "base64url");
    if (bytes.toString("base64url") !== raw) return null;
    const parsed: unknown = JSON.parse(bytes.toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const value = parsed as Record<string, unknown>;
    if (Object.keys(value).sort().join(",") !== "direction,documentNumber,id,issuedAt,kind,v" || value.v !== 1
      || (value.direction !== "older" && value.direction !== "newer")
      || typeof value.id !== "string" || !UUID.test(value.id)
      || !validTimestamp(value.issuedAt)
      || typeof value.documentNumber !== "string" || !value.documentNumber || value.documentNumber.length > 500
      || (value.kind !== "receipt" && value.kind !== "invoice")) return null;
    return { issuedAt: value.issuedAt, documentNumber: value.documentNumber, kind: value.kind, id: value.id.toLowerCase(), direction: value.direction };
  } catch { return null; }
}

export function salesDocumentPage<T extends SalesDocumentPosition>(rows: T[], cursor: SalesDocumentCursor | null) {
  const sentinel = rows.length > SALES_DOCUMENT_PAGE_SIZE;
  const selected = rows.slice(0, SALES_DOCUMENT_PAGE_SIZE);
  const items = cursor?.direction === "newer" ? selected.reverse() : selected;
  const first = items[0];
  const last = items.at(-1);
  const hasNewer = cursor?.direction === "newer" ? sentinel : cursor !== null;
  const hasOlder = cursor?.direction === "newer" ? items.length > 0 : sentinel;
  return {
    items,
    newerCursor: hasNewer && first ? encodeSalesDocumentCursor(first, "newer") : null,
    olderCursor: hasOlder && last ? encodeSalesDocumentCursor(last, "older") : null,
  };
}

export function salesDocumentHistoryHref(cursor?: string) {
  return cursor ? `/app/accounting/documents?${new URLSearchParams({ cursor })}` : "/app/accounting/documents";
}
