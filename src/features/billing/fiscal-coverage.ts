export const COVERAGE_STATES = ["document_issued", "existing_document_linked", "issuance_pending", "review_required"] as const;
export type FiscalCoverageStatus = typeof COVERAGE_STATES[number];
export type PaymentFiscalCoverage = {
  paymentId: string; orderId: string; amount: number; currency: string; paidAt: string;
  status: FiscalCoverageStatus; reason: string;
  document: { id: string; number: string | null; issuedAt: string | null; amount: number } | null;
  evidence: { servicePerformedOn: string; operationalCompletedAt: string; completionHistoryId: string; declaredAt: string; timezone: string; statementVersion: string } | null;
};
export type FiscalCoverage = { state: "ready"; enabled: boolean; today: string; timezone: string; payments: PaymentFiscalCoverage[] } | { state: "unavailable" };
const id = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const stamp = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v));
const money = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
export function isServiceDeclarationDate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && stamp(v) && new Date(v).toISOString().slice(0, 10) === v;
}
export function parseFiscalCoverage(value: unknown): FiscalCoverage {
  const unavailable: FiscalCoverage = { state: "unavailable" };
  if (!record(value) || typeof value.enabled !== "boolean" || !isServiceDeclarationDate(value.today)
    || typeof value.timezone !== "string" || !value.timezone || !Array.isArray(value.payments) || value.payments.length > 100) return unavailable;
  const seen = new Set<string>();
  for (const p of value.payments) {
    if (!record(p) || !id(p.paymentId) || seen.has(p.paymentId) || !id(p.orderId) || !money(p.amount) || !stamp(p.paidAt)
      || typeof p.currency !== "string" || !/^[A-Z]{3}$/.test(p.currency)
      || !COVERAGE_STATES.includes(p.status as FiscalCoverageStatus) || typeof p.reason !== "string") return unavailable;
    seen.add(p.paymentId);
    if (p.document !== null && (!record(p.document) || !id(p.document.id) || !money(p.document.amount)
      || (p.document.number !== null && typeof p.document.number !== "string")
      || (p.document.issuedAt !== null && !stamp(p.document.issuedAt)))) return unavailable;
    if ((p.status === "document_issued" || p.status === "existing_document_linked")
      && (!record(p.document) || !p.document.number || !p.document.issuedAt || p.document.amount !== p.amount)) return unavailable;
    if (p.evidence !== null && (!record(p.evidence) || !isServiceDeclarationDate(p.evidence.servicePerformedOn)
      || !stamp(p.evidence.operationalCompletedAt) || !stamp(p.evidence.declaredAt) || !id(p.evidence.completionHistoryId)
      || typeof p.evidence.timezone !== "string" || p.evidence.statementVersion !== "pos-service-v1")) return unavailable;
  }
  return { state: "ready", enabled: value.enabled, today: value.today, timezone: value.timezone, payments: value.payments as PaymentFiscalCoverage[] };
}
