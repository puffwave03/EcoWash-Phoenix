import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

// Local mathematical examples only, never persisted or assigned to a tenant.
// DNI and checksum rules: Interior, consulted 2026-10-20:
// https://www.interior.gob.es/opencms/es/servicios-al-ciudadano/tramites-y-gestiones/dni/calculo-del-digito-de-control-del-nif-nie/
// Published X/Y/Z examples (SEPE):
// https://sepe.es/ca/SiteSepe/contenidos/COVID-19/documentos/ayuda-generador.pdf
// Published leading-zero NIE example (DGSFP):
// https://dgsfp.mineco.gob.es/es/Entidades/Documents/Documento%20explicativo%20BBDD%20Comisi%C3%B3n%20Biometr%C3%ADa_I_v20240722.pdf
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const effects = [];
const forbidden = (name) => () => { effects.push(name); throw Error(`Unexpected side effect: ${name}`); };
function load(path, dependencies = {}) {
  const testModule = { exports: {} };
  runInNewContext(ts.transpileModule(read(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    module: testModule, exports: testModule.exports,
    require: (name) => {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    fetch: forbidden("network"), Date: forbidden("clock"),
    setTimeout: forbidden("timer"), setInterval: forbidden("timer"),
    console: { log: forbidden("log"), error: forbidden("log") },
  });
  return testModule.exports;
}
const spain = load("src/features/fiscal-assessment/countries/spain.ts");
const { assessFiscalIdentity: assess, requiresFiscalIdentityReassessment: reassess } = load(
  "src/features/fiscal-assessment/assessment.ts", { "./countries/spain": spain },
);
const plain = (value) => JSON.parse(JSON.stringify(value));
// Other strings are deliberately unnamed field-presence markers, not a business
// identity, address or claimed official registration.
const input = (changes = {}) => ({
  issuer_legal_name: "[field supplied]", issuer_tax_id: "12345678Z",
  issuer_address_line1: "[field supplied]", issuer_city: "[field supplied]",
  issuer_postal_code: "[field supplied]", issuer_country_code: "ES",
  fiscal_territory_code: "ES-CN", declared_tax_regime_code: "IGIC-GENERAL", ...changes,
});

test("empty canonical projection reports all six missing fields without rejecting partial configuration", () => {
  const result = plain(assess({}));
  assert.equal(result.completeness.status, "incomplete");
  assert.deepEqual(result.completeness.missingRequiredFields, ["issuer_legal_name", "issuer_tax_id",
    "issuer_address_line1", "issuer_city", "issuer_postal_code", "issuer_country_code"]);
  assert.equal(result.identifier.status, "missing");
  assert.equal(result.jurisdiction.reason, "country_required");
});

test("each partial identity reports missing fields independently of formal and territorial checks", () => {
  for (const field of ["issuer_legal_name", "issuer_tax_id", "issuer_address_line1",
    "issuer_city", "issuer_postal_code", "issuer_country_code"]) {
    for (const missing of [undefined, null, "", " \n "]) {
      const result = plain(assess(input({ [field]: missing })));
      assert.equal(result.completeness.status, "incomplete");
      assert.deepEqual(result.completeness.missingRequiredFields, [field]);
    }
  }
});

test("complete means presence only: arbitrary nonempty identifier is invalid, never verified", () => {
  const result = assess(input({ issuer_tax_id: "arbitrary nonempty text" }));
  assert.equal(result.completeness.status, "complete");
  assert.equal(result.identifier.status, "invalid");
  assert.equal(result.identifier.reason, "invalid_format");
  assert.equal(result.issuanceEligibility, "not_assessed");
});

for (const [value, type] of [["12345678Z", "dni"], ["X1234567L", "nie"],
  ["Y1234567X", "nie"], ["Z1234567R", "nie"], ["X0000045E", "nie"]]) {
  test(`official published ${type} example ${value[0]} passes formal check only`, () => {
    for (const variant of [value, ` ${value.toLowerCase()} `]) {
      const result = plain(assess(input({ issuer_tax_id: variant })));
      assert.deepEqual(result.identifier, { status: "formally_valid", type, reason: "checksum_matches" });
      assert.deepEqual(result.verification, { officialIdentity: "not_performed",
        representationAuthorization: "not_assessed", taxRegimeApproval: "not_assessed" });
      assert.equal(result.issuanceEligibility, "not_assessed");
    }
  });
}

test("wrong DNI/NIE control letters fail while preserving the recognized identifier type", () => {
  for (const [value, type] of [["12345678A", "dni"], ["X1234567A", "nie"],
    ["Y1234567A", "nie"], ["Z1234567A", "nie"], ["X0000045A", "nie"]]) {
    assert.deepEqual(plain(assess(input({ issuer_tax_id: value })).identifier),
      { status: "invalid", type, reason: "checksum_mismatch" });
  }
});

test("malformed identifiers are not repaired, prefixed, zero-padded or normalized from Unicode", () => {
  for (const value of ["1234567Z", "123456789Z", "12345678", "12345678ZZ", "ES12345678Z",
    "12.345.678-Z", "X-1234567-L", "X123456L", "12345678Z\nother", "１２３４５６７８Z", "12345678K", "ß1234567Z"]) {
    assert.equal(assess(input({ issuer_tax_id: value })).identifier.reason, "invalid_format");
  }
});

test("entity/special NIFs and legacy NIE formats are unsupported rather than mathematically approved", () => {
  for (const value of ["A1234567Z", "K1234567Z", "L1234567Z", "M1234567Z", "X12345678X"]) {
    const result = plain(assess(input({ issuer_tax_id: value })));
    assert.equal(result.identifier.status, "unsupported");
    assert.equal(result.identifier.reason, "identifier_type_not_supported");
    assert.ok(result.unsupportedConditions.includes("identifier_type_not_supported"));
  }
});

test("unsupported or unknown country never borrows the Spanish validator or pilot jurisdiction", () => {
  for (const country of ["IT", "FR", "DE", "GB", "ZZ", "SP", "ESP", "constructor"]) {
    const result = plain(assess(input({ issuer_country_code: country })));
    assert.equal(result.identifier.reason, "country_not_supported");
    assert.equal(result.jurisdiction.reason, "country_not_supported");
    assert.equal(result.jurisdiction.taxSystem, null);
    assert.ok(result.unsupportedConditions.includes("country_not_supported"));
  }
});

test("ES alone, missing territory, address or postal clues cannot select IGIC or IVA", () => {
  for (const territory of [undefined, null, "", "ES"]) {
    const result = assess(input({ fiscal_territory_code: territory, issuer_postal_code: "38001", issuer_city: "Tenerife" }));
    assert.equal(result.jurisdiction.status, "unresolved");
    assert.equal(result.jurisdiction.reason, "territory_required");
    assert.equal(result.jurisdiction.taxSystem, null);
  }
});

test("explicit Canary and mainland/Balearic declarations are distinct and neither enables issuance", () => {
  const canary = assess(input());
  assert.deepEqual(plain(canary.jurisdiction), { status: "recognized", taxSystem: "IGIC",
    scope: "existing_pilot_only", reason: "recognized_declaration" });
  const iva = assess(input({ fiscal_territory_code: "ES-IVA", declared_tax_regime_code: "IVA-GENERAL" }));
  assert.deepEqual(plain(iva.jurisdiction), { status: "recognized", taxSystem: "IVA",
    scope: "not_implemented", reason: "jurisdiction_not_implemented" });
  assert.ok(iva.unsupportedConditions.includes("jurisdiction_not_implemented"));
  for (const result of [canary, iva]) assert.equal(result.issuanceEligibility, "not_assessed");
});

test("unresolved and unsupported Spanish territories do not fall back to a country default", () => {
  for (const territory of ["ES-CE", "ES-ML", "ES-PV", "ES-NC", "UNKNOWN", "ES-IB"]) {
    const result = assess(input({ fiscal_territory_code: territory }));
    assert.equal(result.jurisdiction.reason, "territory_not_supported");
    assert.equal(result.jurisdiction.taxSystem, null);
  }
});

test("missing, unknown and contradictory regimes have separate findings", () => {
  assert.equal(assess(input({ declared_tax_regime_code: null })).jurisdiction.reason, "regime_required");
  assert.equal(assess(input({ declared_tax_regime_code: "UNKNOWN" })).jurisdiction.reason, "regime_not_supported");
  for (const patch of [{ declared_tax_regime_code: "IVA-GENERAL" },
    { fiscal_territory_code: "ES-IVA", declared_tax_regime_code: "IGIC-GENERAL" }]) {
    const result = assess(input(patch));
    assert.equal(result.jurisdiction.status, "incompatible");
    assert.ok(result.unsupportedConditions.includes("territory_regime_mismatch"));
  }
});

test("complete/formally valid identity still requires unavailable verification; submitted approvals are ignored", () => {
  const baseline = plain(assess(input()));
  assert.deepEqual(baseline.requiredButUnavailableVerifications,
    ["official_identity", "representation_authorization", "tax_regime_approval"]);
  assert.deepEqual(plain(assess(input({ officiallyVerified: true, representationAuthorization: "verified",
    issuanceEligibility: "eligible", simplified_invoicing_enabled: true }))), baseline);
});

test("each identity or jurisdiction change requires reassessment; equivalent outer formatting does not", () => {
  const before = input();
  for (const key of Object.keys(before)) {
    assert.equal(reassess(before, { ...before, [key]: `${before[key]}-changed` }), true, key);
    assert.equal(reassess(before, { ...before, [key]: null }), true, key);
  }
  assert.equal(reassess(before, input()), false);
  assert.equal(reassess(before, input({ issuer_tax_id: " 12345678z ", issuer_country_code: " es " })), false);
  assert.equal(reassess(before, { ...before, issuer_phone: "not assessed" }), false);
  assert.equal(reassess(before, { ...before, issuer_address_line2: "[changed field]" }), true);
  assert.equal(reassess(before, { ...before, issuer_region: "[changed field]" }), true);
  assert.equal(assess({ ...before, issuer_address_line2: null, issuer_region: null }).completeness.status, "complete");
  assert.equal(reassess({}, { issuer_legal_name: "" }), false);
});

test("assessment is deterministic, does not mutate canonical input and has no network/clock/issuance dependency", () => {
  const source = Object.freeze(input());
  const before = JSON.stringify(source);
  const first = plain(assess(source));
  assert.deepEqual(plain(assess(source)), first);
  assert.equal(JSON.stringify(source), before);
  reassess(source, source);
  const externallyMutated = assess(source);
  externallyMutated.requiredButUnavailableVerifications.length = 0;
  externallyMutated.completeness.missingRequiredFields.push("issuer_tax_id");
  assert.deepEqual(plain(assess(source)), first);
  assert.deepEqual(effects, []);
});
