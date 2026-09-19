import type { DailyCloseRequest } from "@/features/daily-close/persisted-types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BUSINESS_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string) {
  if (!BUSINESS_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function parseDailyCloseRequest(input: DailyCloseRequest) {
  const businessDate = String(input.businessDate ?? "").trim();
  const idempotencyKey = String(input.idempotencyKey ?? "").trim();
  const rawLocationId = input.locationId === null ? "" : String(input.locationId ?? "").trim();
  const note = input.note === null || input.note === undefined ? null : String(input.note).trim() || null;
  const fieldErrors: Record<string, string> = {};

  if (!validDate(businessDate)) fieldErrors.businessDate = "invalid";
  if (!UUID.test(idempotencyKey)) fieldErrors.idempotencyKey = "invalid";
  if (rawLocationId && !UUID.test(rawLocationId)) fieldErrors.locationId = "invalid";
  if (note && note.length > 1000) fieldErrors.note = "tooLong";

  return {
    fieldErrors,
    input: { businessDate, idempotencyKey, locationId: rawLocationId || null, note },
    valid: Object.keys(fieldErrors).length === 0,
  };
}
