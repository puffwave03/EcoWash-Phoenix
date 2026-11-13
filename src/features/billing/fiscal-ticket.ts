import type { CustomerCopyFormat } from "@/features/printer-settings/document-preferences";

export const FISCAL_TICKET_RECIPIENTS = ["consumer", "consumer_identified", "business"] as const;
export type FiscalTicketRecipient = (typeof FISCAL_TICKET_RECIPIENTS)[number];
export type FiscalTicketOrderSnapshot = { order_number: string; due_at: string | null; location_id: string | null };
export type FiscalTicketFormat = CustomerCopyFormat;

export function fiscalTicketRecipient(value: unknown): FiscalTicketRecipient | null {
  return FISCAL_TICKET_RECIPIENTS.find((candidate) => candidate === value) ?? null;
}

export function fiscalTicketSnapshot(value: unknown): FiscalTicketOrderSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.order_number !== "string" || !row.order_number.trim()
    || !(row.due_at === null || (typeof row.due_at === "string" && Number.isFinite(Date.parse(row.due_at))))
    || !(row.location_id === null || typeof row.location_id === "string")) return null;
  return { order_number: row.order_number, due_at: row.due_at, location_id: row.location_id };
}
