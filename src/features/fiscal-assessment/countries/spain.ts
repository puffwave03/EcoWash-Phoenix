import type { CountryFiscalAssessmentModule, IdentifierAssessment, JurisdictionAssessment } from "../types";

// Formal checks only. Rules consulted 2026-10-20:
// https://www.interior.gob.es/opencms/es/servicios-al-ciudadano/tramites-y-gestiones/dni/calculo-del-digito-de-control-del-nif-nie/
// The Ministry specifies the modulo-23 table and NIE X/Y/Z -> 0/1/2.
// Entity NIFs, special K/L/M NIFs and older NIE formats are not implemented.
const CONTROL_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

function validateIdentifier(raw: string): IdentifierAssessment {
  const value = raw.trim();
  if (!value) return { status: "missing", type: null, reason: "identifier_missing" };
  // Reject separators, VAT prefixes, Unicode lookalikes and implicit zero-padding.
  if (!/^[a-z0-9]+$/i.test(value)) return { status: "invalid", type: null, reason: "invalid_format" };
  const normalized = value.toUpperCase();
  const type = /^\d{8}[A-Z]$/.test(normalized) ? "dni"
    : /^[XYZ]\d{7}[A-Z]$/.test(normalized) ? "nie" : null;
  if (!type) {
    const unsupported = /^[A-W]\d{7}[A-Z0-9]$/.test(normalized)
      || /^[XYZ]\d{8}[A-Z]$/.test(normalized);
    return { status: unsupported ? "unsupported" : "invalid", type: null,
      reason: unsupported ? "identifier_type_not_supported" : "invalid_format" };
  }
  const digits = type === "dni" ? normalized.slice(0, 8)
    : String("XYZ".indexOf(normalized[0])) + normalized.slice(1, 8);
  const matches = CONTROL_LETTERS[Number(digits) % 23] === normalized[8];
  return { status: matches ? "formally_valid" : "invalid", type,
    reason: matches ? "checksum_matches" : "checksum_mismatch" };
}

function assessJurisdiction(territory: string, regime: string): JurisdictionAssessment {
  // ES-CN reuses the existing pilot declaration. ES-IVA is an assessment-only
  // code for explicitly declared mainland/Balearic VAT territory, not a new DB
  // configuration, tax policy, foral approval or enabled issuance jurisdiction.
  // EU territorial distinction (consulted 2026-10-20):
  // https://taxation-customs.ec.europa.eu/taxation/vat/vat-directive/how-does-vat-work/territorial-scope_en
  const taxSystem = territory === "ES-CN" ? "IGIC" : territory === "ES-IVA" ? "IVA" : null;
  const scope = territory === "ES-CN" ? "existing_pilot_only" : "not_implemented";
  if (!territory || territory === "ES") return { status: "unresolved", taxSystem: null,
    scope: "not_implemented", reason: "territory_required" };
  if (!taxSystem) return { status: "unsupported", taxSystem: null,
    scope: "not_implemented", reason: "territory_not_supported" };
  if (!regime) return { status: "unresolved", taxSystem, scope, reason: "regime_required" };
  if (regime !== "IGIC-GENERAL" && regime !== "IVA-GENERAL") {
    return { status: "unsupported", taxSystem, scope, reason: "regime_not_supported" };
  }
  if ((taxSystem === "IGIC") !== (regime === "IGIC-GENERAL")) {
    return { status: "incompatible", taxSystem, scope, reason: "territory_regime_mismatch" };
  }
  return { status: "recognized", taxSystem, scope,
    reason: taxSystem === "IGIC" ? "recognized_declaration" : "jurisdiction_not_implemented" };
}

export const spainFiscalAssessment: CountryFiscalAssessmentModule = {
  countryCode: "ES", validateIdentifier, assessJurisdiction,
};
