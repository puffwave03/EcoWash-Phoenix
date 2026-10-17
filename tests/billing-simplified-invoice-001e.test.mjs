import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

// No DB connection or emission. Executable operation/recipient assessments plus
// static migration contracts. These are NOT RPC, runtime RLS/concurrency, browser
// or fiscal UAT tests. Reuse the recorded 001D concurrency evidence separately.
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const testModule = { exports: {} };
runInNewContext(ts.transpileModule(read("src/features/billing/simplified-operation.ts"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module: testModule, exports: testModule.exports, require: (name) => {
  assert.equal(name, "server-only"); return {};
} });
const { assessSimplifiedOperation: assess, snapshotSimplifiedRecipient: snapshot } = testModule.exports;
const plain = (value) => JSON.parse(JSON.stringify(value));
const facts = (changes = {}) => ({
  organizationId: "tenant-a", orderOrganizationId: "tenant-a", role: "owner", billingEntitled: true,
  territory: "ES-CN", regime: "IGIC-GENERAL", fiscalContextVerified: true,
  operationScope: "laundry_dry_cleaning", statutoryExclusions: "none", currency: "EUR", totalCents: 700,
  activeOrder: true, orderStatus: "ready", itemCount: 1, existingFiscalDocument: "none",
  recipientRequirement: "anonymous_permitted", fiscalDate: "2026-10-17", fiscalDateVerified: true,
  paymentContext: "no_advance", ...changes,
});
const anonymous = { mode: "anonymous" };
const identified = { mode: "identified", name: "Explicit fixture recipient", taxId: "TEST-ONLY",
  addressLine1: "Fixture address", city: "Fixture city", postalCode: "00000", countryCode: "es" };

test("one verified laundry operation passes assessment without catalog approval or issuing anything", () => {
  // Arbitrary catalog additions do not need individual fiscal configuration.
  for (let i = 1; i <= 219; i++) {
    const result = assess(facts({ serviceCode: `TEST-${i}`, serviceName: `Arbitrary ${i}` }), anonymous);
    assert.equal(result.operationChecksPassed, true);
    assert.equal(result.issuanceAvailable, false);
    assert.deepEqual(plain(result.reasons), []);
  }
  assert.doesNotMatch(read("src/features/billing/simplified-operation.ts"), /\.serviceCode|\.serviceName|\.taxRate|\.serviceIds/);
});

test("anonymous snapshot has no customer/NIF/address and cannot inherit WALKIN-SHARED identity", () => {
  const result = plain(snapshot(anonymous));
  assert.equal(result.recipient_snapshot_mode, "anonymous");
  assert.ok(Object.entries(result).filter(([key]) => key !== "recipient_snapshot_mode").every(([, value]) => value === null));
  for (const extra of [{ customer_id: "WALKIN-SHARED" }, { taxId: "fake" }, { organization_id: "tenant-b" }, { name: "" }]) {
    assert.equal(snapshot({ ...anonymous, ...extra }), null);
  }
  assert.equal(snapshot(Object.create({ mode: "anonymous" })), null);
});

test("explicit identified snapshot needs no permanent customer and preserves supplied identity", () => {
  const result = plain(snapshot(identified));
  assert.equal(result.customer_id, null);
  assert.equal(result.customer_name, identified.name);
  assert.equal(result.customer_tax_id, identified.taxId);
  assert.equal(result.customer_country_code, "ES");
  const registered = assess(facts({ role: "manager", recipientRequirement: "identification_required" }), identified);
  assert.equal(registered.operationChecksPassed, true);
  assert.equal(registered.issuanceAvailable, false);
});

test("missing/partial/oversized recipient data never creates a fictitious identified snapshot", () => {
  for (const field of ["name", "taxId", "addressLine1", "city", "postalCode", "countryCode"]) {
    for (const value of [null, undefined, "", " ", 7, "X".repeat(255)]) {
      assert.equal(snapshot({ ...identified, [field]: value }), null, field);
    }
  }
  for (const value of [null, [], "anonymous", { mode: "registered" }, { ...identified, customer_id: "foreign" }]) assert.equal(snapshot(value), null);
});

test("recipient requirement is explicit and cannot be bypassed by anonymous identity", () => {
  assert.ok(assess(facts({ recipientRequirement: "identification_required" }), anonymous).reasons.includes("recipient_identification_required"));
  for (const requirement of ["ordinary_required", "unverified", null, "invalid"]) {
    assert.equal(assess(facts({ recipientRequirement: requirement }), identified).operationChecksPassed, false);
  }
});

test("whole-operation thresholds use canonical cents and never infer a rate or reprice lines", () => {
  for (const amount of [0, 1, 40000, 40001, 300000]) assert.equal(assess(facts({ totalCents: amount }), anonymous).operationChecksPassed, true);
  for (const amount of [-1, 300001, 3.14, NaN, Infinity, "700", Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(assess(facts({ totalCents: amount }), anonymous).operationChecksPassed, false);
  }
  assert.equal(assess(facts({ currency: "USD" }), anonymous).operationChecksPassed, false);
  for (const taxRate of [0, 3, 7, 15]) assert.equal(assess(facts({ taxRate }), anonymous).operationChecksPassed, true);
});

test("specific other operations retain the general EUR400 rule; no laundry exception is inferred", () => {
  for (const operationScope of ["other", "unverified"]) {
    assert.equal(assess(facts({ operationScope, totalCents: 40000 }), anonymous).operationChecksPassed, true);
    assert.ok(assess(facts({ operationScope, totalCents: 40001 }), anonymous).reasons.includes("ordinary_required_for_operation"));
  }
  for (const statutoryExclusions of ["excluded", "unverified", undefined]) {
    assert.equal(assess(facts({ statutoryExclusions, totalCents: 100 }), anonymous).operationChecksPassed, false);
  }
});

test("territory, actual regime and verified fiscal context are independent of price/flags", () => {
  for (const patch of [{ territory: null }, { territory: "ES" }, { regime: null }, { regime: "OTHER" },
    { fiscalContextVerified: false }, { fiscalContextVerified: "true" }]) {
    assert.ok(assess(facts({ ...patch, simplified_invoicing_enabled: true, totalCents: 1 }), anonymous).reasons.includes("fiscal_context_unverified"));
  }
});

test("foreign tenant, staff and missing entitlement fail assessment", () => {
  for (const patch of [{ orderOrganizationId: "tenant-b" }, { organizationId: "" }, { role: "staff" },
    { role: "customer" }, { billingEntitled: false }, { billingEntitled: "true" }]) {
    assert.ok(assess(facts(patch), anonymous).reasons.includes("unauthorized"));
  }
});

test("inactive/cancelled/draft/empty orders cannot pass", () => {
  for (const patch of [{ activeOrder: false }, { orderStatus: "draft" }, { orderStatus: "cancelled" },
    { orderStatus: "invalid" }, { itemCount: 0 }, { itemCount: 1.5 }]) {
    assert.ok(assess(facts(patch), anonymous).reasons.includes("invalid_order"));
  }
});

test("all existing fiscal-document states block new assessment; no cancellation is reused as a rectification", () => {
  for (const state of ["draft", "issued", "cancelled", "unverified", undefined]) {
    assert.ok(assess(facts({ existingFiscalDocument: state }), anonymous).reasons.includes("existing_or_unverified_fiscal_document"));
  }
});

test("ready/completed/payment timestamps cannot substitute for a verified fiscal date", () => {
  for (const fiscalDate of [null, "", "0000-01-01", "2026-02-29", "2026-13-01", "2026-10-17T12:00Z"]) {
    assert.ok(assess(facts({ fiscalDate, orderStatus: "completed" }), anonymous).reasons.includes("fiscal_date_unverified"));
  }
  assert.ok(assess(facts({ fiscalDateVerified: false, completed_at: "2026-10-17", paid_at: "2026-10-17" }), anonymous).reasons.includes("fiscal_date_unverified"));
});

test("EUR7 order with EUR2 advance/EUR5 balance remains blocked; no payment or tax is duplicated", () => {
  const source = facts({ totalCents: 700, paymentContext: "advance", payments: [{ amount: 200 }, { amount: 500 }] });
  const before = JSON.stringify(source);
  const result = assess(source, anonymous);
  assert.ok(result.reasons.includes("advance_or_payment_workflow_required"));
  assert.equal(result.operationChecksPassed, false);
  assert.equal(result.issuanceAvailable, false);
  assert.equal(JSON.stringify(source), before);
  for (const paymentContext of ["already_documented", "unverified", undefined]) assert.equal(assess(facts({ paymentContext }), anonymous).operationChecksPassed, false);
});

test("repeat/concurrent assessments and lost responses are read-only; neither emits nor retries", async () => {
  const source = facts();
  const before = JSON.stringify(source);
  const results = await Promise.all(Array.from({ length: 10 }, async () => assess(source, anonymous)));
  assert.ok(results.every((r) => r.operationChecksPassed && r.issuanceAvailable === false));
  assert.deepEqual(plain(assess(source, anonymous)), plain(results[0]));
  assert.equal(JSON.stringify(source), before);
  assert.doesNotMatch(read("src/features/billing/simplified-operation.ts"), /supabase|\.rpc\(|fetch\(|setTimeout\(/);
});

const migrationName = "20261017000200_billing_simplified_invoice_001e_recipient_snapshot_foundation.sql";
const sql = read(`supabase/migrations/${migrationName}`).replace(/--[^\n]*/g, "");
test("recipient SQL is one local proposal on canonical invoices, without an alternative register or financial source", () => {
  assert.equal(readdirSync(new URL("../supabase/migrations/", import.meta.url)).filter((n) => n.startsWith("20261017000200_")).length, 1);
  assert.match(sql, /^\s*begin;/);
  assert.match(sql, /commit;\s*$/);
  assert.match(sql, /recipient_snapshot_mode text not null default 'registered'/);
  assert.doesNotMatch(sql, /create table|create sequence|create policy|alter policy|delete from public\.payments/i);
  assert.doesNotMatch(sql, /alter table public\.(?:payments|orders|customers|invoice_orders|billing_invoice_number_counters)/);
});

test("ordinary NOT NULL semantics and tenant FK/WALKIN guard remain, anonymous identity must be all NULL", () => {
  assert.match(sql, /when fiscal_document_type = 'ordinary' then\s+recipient_snapshot_mode = 'registered' and customer_id is not null and customer_name is not null/);
  const anon = sql.slice(sql.indexOf("when recipient_snapshot_mode = 'anonymous'"), sql.indexOf("when recipient_snapshot_mode = 'identified'"));
  for (const field of ["customer_id", "customer_name", "customer_tax_id", "customer_address_line1", "customer_address_line2", "customer_city", "customer_postal_code", "customer_country_code", "customer_email"]) assert.ok(anon.includes(`${field} is null`));
  assert.doesNotMatch(sql, /drop trigger|\bdisable\b|row level security|references|foreign key/i);
  for (const field of ["customer_name", "customer_tax_id", "customer_address_line1", "customer_city", "customer_postal_code"]) assert.ok(sql.includes(`coalesce(length(btrim(${field})), 0) > 0`));
});

test("new recipient mode is immutable after issue/cancellation with no added client privilege", () => {
  assert.match(sql, /if old.document_status <> 'draft'/);
  assert.match(sql, /new.recipient_snapshot_mode is distinct from old.recipient_snapshot_mode/);
  assert.match(sql, /before update on public.invoices/);
  assert.match(sql, /revoke all on function public.protect_billing_recipient_snapshot_mode\(\) from public, anon, authenticated/);
  assert.doesNotMatch(sql, /grant (?:insert|update|delete|all)|create (?:or replace )?function public\.cancel_billing_invoice/);
});

test("historical migrations, financial sources and prior guards remain byte-identical", () => {
  // Local Git read only, no checkout/staging or mutation. Catch accidental scope
  // widening, not just matching a few strings in an altered canonical writer.
  for (const path of [
    "supabase/migrations/20260826000300_billing_001_invoicing_foundation.sql",
    "supabase/migrations/20260902000200_terminal_customer_ux_001b_shared_walk_in.sql",
    "supabase/migrations/20261007000200_billing_tax_inclusive_pricing_001.sql",
    "supabase/migrations/20261016000100_billing_simplified_invoice_001b_fiscal_type_foundation.sql",
    "supabase/migrations/20261016000200_billing_fiscal_profile_001_minimal_configuration.sql",
    "supabase/migrations/20261017000100_billing_simplified_invoice_001d_series_configuration.sql",
  ]) assert.equal(read(path), execFileSync("git", ["show", `3e42f88cc610cc991df3d0ccec9ebb647f146cdd:${path}`], { encoding: "utf8" }));
  assert.match(sql, /conname = 'invoices_fiscal_document_type_ordinary_only' and convalidated/);
  assert.match(sql, /conname = 'organization_billing_settings_simplified_disabled' and convalidated/);
});
