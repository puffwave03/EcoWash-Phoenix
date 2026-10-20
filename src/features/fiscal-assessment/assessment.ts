import { spainFiscalAssessment } from "./countries/spain";
import type {
  CountryFiscalAssessmentModule, FiscalIdentityAssessment, FiscalIdentityInput,
  RequiredIdentityField, UnsupportedCondition,
} from "./types";

const REQUIRED_FIELDS: readonly RequiredIdentityField[] = [
  "issuer_legal_name", "issuer_tax_id", "issuer_address_line1",
  "issuer_city", "issuer_postal_code", "issuer_country_code",
];
const ASSESSED_FIELDS: readonly (keyof FiscalIdentityInput)[] = [
  ...REQUIRED_FIELDS, "issuer_address_line2", "issuer_region",
  "fiscal_territory_code", "declared_tax_regime_code",
];
const COUNTRY_MODULES: readonly CountryFiscalAssessmentModule[] = [spainFiscalAssessment];

function field(input: FiscalIdentityInput, key: keyof FiscalIdentityInput): string {
  const value = input[key];
  const text = typeof value === "string" ? value.trim() : "";
  // Do not repair identifiers; normalization only removes outer whitespace and
  // folds ASCII case. Names, addresses and technical profile codes stay exact.
  return (key === "issuer_country_code" || key === "issuer_tax_id") && /^[\x20-\x7e]*$/.test(text)
    ? text.toUpperCase() : text;
}

/** Pure assessment of a caller-supplied canonical settings projection. No IO,
 * clock, cached approvals or trusted client flags. Not a DB issuance gate. */
export function assessFiscalIdentity(input: FiscalIdentityInput): FiscalIdentityAssessment {
  const missingRequiredFields = REQUIRED_FIELDS.filter((key) => !field(input, key));
  const country = field(input, "issuer_country_code");
  const identifierValue = field(input, "issuer_tax_id");
  const countryModule = COUNTRY_MODULES.find((module) => module.countryCode === country);
  const identifier = !identifierValue
    ? { status: "missing" as const, type: null, reason: "identifier_missing" as const }
    : countryModule?.validateIdentifier(identifierValue)
      ?? { status: "unsupported" as const, type: null, reason: "country_not_supported" as const };
  const jurisdiction = countryModule?.assessJurisdiction(
    field(input, "fiscal_territory_code"), field(input, "declared_tax_regime_code"),
  ) ?? { status: country ? "unsupported" as const : "unresolved" as const,
    taxSystem: null, scope: "not_implemented" as const,
    reason: country ? "country_not_supported" as const : "country_required" as const };
  const unsupportedConditions: UnsupportedCondition[] = [];
  if (country && !countryModule) unsupportedConditions.push("country_not_supported");
  if (identifier.reason === "identifier_type_not_supported") unsupportedConditions.push(identifier.reason);
  if (jurisdiction.reason === "territory_not_supported" || jurisdiction.reason === "regime_not_supported"
    || jurisdiction.reason === "territory_regime_mismatch") unsupportedConditions.push(jurisdiction.reason);
  if (jurisdiction.reason === "jurisdiction_not_implemented") unsupportedConditions.push("jurisdiction_not_implemented");

  return {
    assessmentVersion: "fiscal-identity-001",
    completeness: { status: missingRequiredFields.length ? "incomplete" : "complete", missingRequiredFields },
    identifier, jurisdiction,
    verification: { officialIdentity: "not_performed", representationAuthorization: "not_assessed", taxRegimeApproval: "not_assessed" },
    requiredButUnavailableVerifications: ["official_identity", "representation_authorization", "tax_regime_approval"],
    issuanceEligibility: "not_assessed", unsupportedConditions,
  };
}

/** Future callers must reassess after identity/profile changes; this neither
 * persists a revision nor invalidates/grants an existing Billing permission. */
export function requiresFiscalIdentityReassessment(previous: FiscalIdentityInput, current: FiscalIdentityInput): boolean {
  return ASSESSED_FIELDS.some((key) => field(previous, key) !== field(current, key));
}
