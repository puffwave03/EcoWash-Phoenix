// A read-only projection of canonical organization_billing_settings. This is
// neither a second identity store nor an authorization/issuance API.
export type FiscalIdentityInput = Readonly<Partial<Record<
  | "issuer_legal_name" | "issuer_tax_id" | "issuer_address_line1"
  | "issuer_address_line2" | "issuer_region"
  | "issuer_city" | "issuer_postal_code" | "issuer_country_code"
  | "fiscal_territory_code" | "declared_tax_regime_code",
  string | null
>>>;

export type RequiredIdentityField =
  | "issuer_legal_name" | "issuer_tax_id" | "issuer_address_line1"
  | "issuer_city" | "issuer_postal_code" | "issuer_country_code";

export type IdentifierAssessment = Readonly<{
  status: "missing" | "formally_valid" | "invalid" | "unsupported";
  // Country module identifier kind, e.g. dni/nie. New countries need no change
  // to the shared interface merely to name their own identifier kinds.
  type: string | null;
  reason: "identifier_missing" | "checksum_matches" | "invalid_format"
    | "checksum_mismatch" | "identifier_type_not_supported" | "country_not_supported";
}>;

export type JurisdictionAssessment = Readonly<{
  status: "recognized" | "unresolved" | "unsupported" | "incompatible";
  taxSystem: string | null;
  scope: "existing_pilot_only" | "not_implemented";
  reason: "recognized_declaration" | "jurisdiction_not_implemented"
    | "territory_required" | "country_required" | "country_not_supported"
    | "territory_not_supported" | "regime_required" | "regime_not_supported"
    | "territory_regime_mismatch";
}>;

// New country rules belong in independent modules; no module may grant issuance.
export interface CountryFiscalAssessmentModule {
  readonly countryCode: string;
  validateIdentifier(value: string): IdentifierAssessment;
  assessJurisdiction(territory: string, regime: string): JurisdictionAssessment;
}

export type UnsupportedCondition = "country_not_supported" | "identifier_type_not_supported"
  | "territory_not_supported" | "regime_not_supported" | "territory_regime_mismatch"
  | "jurisdiction_not_implemented";

export type FiscalIdentityAssessment = Readonly<{
  assessmentVersion: "fiscal-identity-001";
  completeness: Readonly<{
    status: "complete" | "incomplete";
    missingRequiredFields: readonly RequiredIdentityField[];
  }>;
  identifier: IdentifierAssessment;
  jurisdiction: JurisdictionAssessment;
  verification: Readonly<{
    officialIdentity: "not_performed";
    representationAuthorization: "not_assessed";
    taxRegimeApproval: "not_assessed";
  }>;
  // Outstanding checks for future readiness; no assertion about universal legal
  // obligations or availability of an official API is made by this component.
  requiredButUnavailableVerifications: readonly (
    "official_identity" | "representation_authorization" | "tax_regime_approval"
  )[];
  issuanceEligibility: "not_assessed";
  unsupportedConditions: readonly UnsupportedCondition[];
}>;
