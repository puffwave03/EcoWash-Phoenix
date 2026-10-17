import "server-only";

// Local 001E preparation. This is an assessment of server-derived facts, NOT an
// issuance endpoint or proof of fiscal compliance. Never feed it FormData as
// authorization/profile/operation context. The canonical DB must enforce the
// complete workflow before either disabling constraint can be relaxed.
// Sources: RD 1619/2012 arts. 4, 7 and additional provision 2; Ley 20/1991 art. 18.
// No catalog IDs, names, rates or per-service approval list participate here.

type IdentifiedRecipient = {
  mode: "identified";
  name: string;
  taxId: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  countryCode: string;
};
export type SimplifiedRecipient = { mode: "anonymous" } | IdentifiedRecipient;

// These are the existing invoice snapshot columns. Anonymous identity is NULL,
// never the technical WALKIN-SHARED customer's identity or a fabricated NIF.
export type SimplifiedRecipientSnapshot = {
  recipient_snapshot_mode: "anonymous" | "identified";
  customer_id: null;
  customer_name: string | null;
  customer_tax_id: string | null;
  customer_address_line1: string | null;
  customer_address_line2: null;
  customer_city: string | null;
  customer_postal_code: string | null;
  customer_country_code: string | null;
  customer_email: null;
};

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : null;
}

export function snapshotSimplifiedRecipient(value: unknown): SimplifiedRecipientSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const recipient = value as Record<string, unknown>;
  // Reject surplus identity/tenant fields rather than silently treating a
  // partially identified recipient as anonymous.
  const expected = recipient.mode === "anonymous" ? ["mode"]
    : ["mode", "name", "taxId", "addressLine1", "city", "postalCode", "countryCode"];
  if (Object.keys(recipient).length !== expected.length
    || expected.some((key) => !Object.prototype.hasOwnProperty.call(recipient, key))) return null;
  if (recipient.mode === "anonymous") return {
    recipient_snapshot_mode: "anonymous", customer_id: null, customer_name: null,
    customer_tax_id: null, customer_address_line1: null, customer_address_line2: null,
    customer_city: null, customer_postal_code: null, customer_country_code: null, customer_email: null,
  };
  if (recipient.mode !== "identified") return null;
  const name = text(recipient.name, 180);
  const taxId = text(recipient.taxId, 80);
  const address = text(recipient.addressLine1, 180);
  const city = text(recipient.city, 100);
  const postalCode = text(recipient.postalCode, 24);
  const country = text(recipient.countryCode, 2)?.toUpperCase();
  if (!name || !taxId || !address || !city || !postalCode || !country || !/^[A-Z]{2}$/.test(country)) return null;
  // Syntax/completeness only; this does not verify a taxpayer's NIF or domicile.
  return {
    recipient_snapshot_mode: "identified", customer_id: null, customer_name: name,
    customer_tax_id: taxId, customer_address_line1: address, customer_address_line2: null,
    customer_city: city, customer_postal_code: postalCode, customer_country_code: country, customer_email: null,
  };
}

export type SimplifiedOperationFacts = {
  organizationId: string;
  orderOrganizationId: string;
  role: string;
  billingEntitled: boolean;
  // Technical profile identifiers for this country module, not tenant names or
  // evidence of approval. Unknown profiles remain unsupported.
  territory: string | null;
  regime: string | null;
  fiscalContextVerified: boolean;
  operationScope: "laundry_dry_cleaning" | "other" | "unverified";
  statutoryExclusions: "none" | "excluded" | "unverified";
  currency: string;
  totalCents: number;
  activeOrder: boolean;
  orderStatus: string;
  itemCount: number;
  existingFiscalDocument: "none" | "draft" | "issued" | "cancelled" | "unverified";
  recipientRequirement: "anonymous_permitted" | "identification_required" | "ordinary_required" | "unverified";
  // No inference from completed_at, handoff, paid_at or today's date.
  fiscalDate: string | null;
  fiscalDateVerified: boolean;
  paymentContext: "no_advance" | "advance" | "already_documented" | "unverified";
};

function validDate(value: unknown): boolean {
  if (typeof value !== "string" || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function assessSimplifiedOperation(facts: SimplifiedOperationFacts, recipient: unknown) {
  const reasons: string[] = [];
  if (!facts.organizationId || facts.organizationId !== facts.orderOrganizationId
    || !["owner", "manager"].includes(facts.role) || facts.billingEntitled !== true) reasons.push("unauthorized");
  if (facts.territory !== "ES-CN" || facts.regime !== "IGIC-GENERAL"
    || facts.fiscalContextVerified !== true) reasons.push("fiscal_context_unverified");
  if (facts.statutoryExclusions !== "none") reasons.push("operation_excluded_or_unverified");
  const amountValid = facts.currency === "EUR" && Number.isSafeInteger(facts.totalCents) && facts.totalCents >= 0;
  if (!amountValid) reasons.push("invalid_amount");
  else if (facts.totalCents > 300000 || (facts.totalCents > 40000 && facts.operationScope !== "laundry_dry_cleaning")) {
    reasons.push("ordinary_required_for_operation");
  }
  // Under art. 4.1(a), a verified non-excluded operation <= EUR 400 does not
  // require the special laundry threshold. Unknown legal context still fails.
  if (facts.activeOrder !== true || !["received", "washing", "drying", "ironing", "quality_check", "packing", "ready", "completed", "on_hold"].includes(facts.orderStatus)
    || !Number.isSafeInteger(facts.itemCount) || facts.itemCount < 1) reasons.push("invalid_order");
  if (facts.existingFiscalDocument !== "none") reasons.push("existing_or_unverified_fiscal_document");
  const snapshot = snapshotSimplifiedRecipient(recipient);
  if (!snapshot) reasons.push("invalid_recipient");
  if (facts.recipientRequirement === "ordinary_required" || facts.recipientRequirement === "unverified"
    || !["anonymous_permitted", "identification_required"].includes(facts.recipientRequirement)) reasons.push("recipient_requirement_unverified_or_ordinary");
  else if (facts.recipientRequirement === "identification_required" && snapshot?.recipient_snapshot_mode !== "identified") reasons.push("recipient_identification_required");
  if (facts.fiscalDateVerified !== true || !validDate(facts.fiscalDate)) reasons.push("fiscal_date_unverified");
  // Never net an advance from the order total, manufacture a corrective invoice
  // or treat the receipt as evidence that an advance has been fiscally settled.
  if (facts.paymentContext !== "no_advance") reasons.push("advance_or_payment_workflow_required");
  return {
    operationChecksPassed: reasons.length === 0,
    // This local foundation cannot authorize drafts/emissions, even if every
    // supplied fact passes. Both DB guards and the action's selection gate stay.
    issuanceAvailable: false as const,
    recipientSnapshot: snapshot,
    reasons,
  };
}
