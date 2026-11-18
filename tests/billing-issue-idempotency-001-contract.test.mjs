import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

// Static SQL contract tests. These do not execute PostgreSQL or simulate locks.
// In particular, a passing test here is not a live concurrency/RLS proof.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migrationName = "20261118125229_billing_issue_idempotency_001.sql";
const sql = read(`supabase/migrations/${migrationName}`);
const previous = read("supabase/migrations/20261007000200_billing_tax_inclusive_pricing_001.sql");
const foundation = read("supabase/migrations/20260826000300_billing_001_invoicing_foundation.sql");
const entitlements = read("supabase/migrations/20260827000200_entitlements_001_tenant_feature_access.sql");
const action = read("src/features/billing/server/actions.ts");
const signature = "create or replace function public.issue_billing_invoice(target_invoice_id uuid)";
const definition = (text) => {
  const start = text.indexOf(signature);
  assert.ok(start >= 0);
  const end = text.indexOf("\n$$;", start);
  assert.ok(end > start);
  return text.slice(start, end + 4);
};
const currentFunction = definition(sql);
const previousFunction = definition(previous);
const oldGuard = "  if invoice_row.id is null or invoice_row.document_status <> 'draft' then";
const branchStart = currentFunction.indexOf("  -- The only request argument");
const branchEnd = currentFunction.indexOf(oldGuard);
assert.ok(branchStart >= 0 && branchEnd > branchStart);
const retry = currentFunction.slice(branchStart, branchEnd);
const retryCode = retry.replace(/--[^\n]*/g, "");

test("the append-only migration replaces only the current issuance RPC", () => {
  const definitions = readdirSync(new URL("../supabase/migrations/", import.meta.url))
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .filter((name) => /create (?:or replace )?function public\.issue_billing_invoice\(/i.test(read(`supabase/migrations/${name}`)));
  assert.equal(definitions.at(-1), migrationName);
  const envelope = sql.replace(currentFunction, "").replace(/--[^\n]*/g, "").trim();
  assert.match(envelope, /^begin;\s+commit;$/);
  assert.equal((sql.match(/create or replace function/g) ?? []).length, 1);
});

test("all first-issue checks, ordinary snapshots, calculations and writes remain byte-identical", () => {
  assert.equal(currentFunction.slice(0, branchStart) + currentFunction.slice(branchEnd), previousFunction);
});

test("tenant and current Owner/Manager authorization precede the retry", () => {
  const before = currentFunction.slice(0, branchStart);
  assert.match(before, /org_id uuid := public\.app_current_organization_id\(\)/);
  assert.match(before, /if not public\.has_organization_role\(org_id, array\['owner', 'manager'\]::public\.app_role\[\]\) then\s+raise exception 'billing_not_authorized' using errcode = '42501'/);
  assert.match(before, /where invoice\.organization_id = org_id\s+and invoice\.id = target_invoice_id\s+for update;/);
});

test("the explicit retry entitlement gate preserves the existing mutation-trigger gate", () => {
  assert.match(entitlements, /create trigger invoices_require_entitlement\s+before insert or update or delete on public\.invoices\s+for each row execute function public\.require_billing_entitlement\(\)/);
  assert.match(entitlements, /organization_entitlement_is_enabled\(\s*target_organization_id,\s*'billing.invoicing',\s*now\(\)/);
  assert.match(retryCode, /if not public\.organization_entitlement_is_enabled\(org_id, 'billing.invoicing', now\(\)\) then\s+raise exception 'billing_entitlement_required' using errcode = '42501';\s+end if;/);
  assert.ok(retryCode.indexOf("billing_entitlement_required") < retryCode.indexOf("return query"));
});

test("equivalence is the same tenant-scoped UUID, with no alternative issuance payload", () => {
  assert.match(currentFunction, /^create or replace function public\.issue_billing_invoice\(target_invoice_id uuid\)\nreturns table \(invoice_id uuid, invoice_number text\)/);
  const issueAction = action.slice(action.indexOf("export async function issueBillingInvoiceAction"), action.indexOf("export async function cancelBillingInvoiceAction"));
  assert.match(issueAction, /requireOwnerOrManager\(locale\)/);
  assert.match(issueAction, /requireEntitlement\(locale, FEATURES\.billingInvoicing\)/);
  assert.match(issueAction, /rpc\("issue_billing_invoice", \{ target_invoice_id: invoiceId \}\)/);
  // A different series/amount/fingerprint is not an accepted RPC argument.
  // No inference about the caller's lost HTTP response is required or made.
});

test("issued identity relies on persisted numbering invariants and immutable snapshots", () => {
  assert.match(foundation, /document_status = 'issued'\s+and invoice_number is not null\s+and sequence_number is not null\s+and issued_at is not null\s+and cancelled_at is null\s+and cancellation_reason is null/);
  for (const column of ["organization_id", "invoice_number", "series", "sequence_number", "total", "tax_total", "customer_tax_id"]) {
    assert.ok(previous.includes(`new.${column} is distinct from old.${column}`));
  }
  assert.match(previous, /billing_issued_snapshot_immutable/);
});

test("the issued branch returns the stored result and terminates without side effects", () => {
  assert.match(retryCode, /if invoice_row\.document_status = 'issued' then/);
  assert.match(retryCode, /return query select invoice_row\.id, invoice_row\.invoice_number;\s+return;\s+end if;/);
  assert.doesNotMatch(retryCode, /\b(insert|update|delete|perform|execute|set_config)\b/i);
  assert.doesNotMatch(retryCode, /allocated_number|allocated_sequence|next_value/);
});

test("counter allocation occurs only after the terminal retry branch", () => {
  const allocation = currentFunction.indexOf("insert into public.billing_invoice_number_counters");
  assert.ok(allocation > branchEnd);
  assert.equal((currentFunction.match(/insert into public\.billing_invoice_number_counters/g) ?? []).length, 1);
  assert.match(currentFunction.slice(allocation), /on conflict \(organization_id, series\)[\s\S]*next_value = public\.billing_invoice_number_counters\.next_value \+ 1/);
});

test("concurrency contract retains the tenant-scoped row lock before examining issued state", () => {
  assert.equal((currentFunction.match(/for update;/g) ?? []).length, 1);
  assert.ok(currentFunction.indexOf("for update;") < branchStart);
  assert.doesNotMatch(currentFunction, /skip locked|nowait/i);
  // Actual competing PostgreSQL sessions are not exercised by this assertion.
});

test("cancelled, null and other-tenant targets retain the invalid-draft rejection path", () => {
  assert.match(currentFunction.slice(branchEnd), /^  if invoice_row\.id is null or invoice_row\.document_status <> 'draft' then\s+raise exception 'billing_invalid_draft' using errcode = '22023';/);
  assert.match(retryCode, /if invoice_row\.document_status = 'issued' then/);
  assert.doesNotMatch(retryCode, /cancelled|document_status\s*:=/);
});

test("no payment, accounting, receipt or second issuance-event write is introduced", () => {
  assert.doesNotMatch(currentFunction, /\b(?:insert into|update|delete from) public\.(?:payments|orders|order_items|invoice_items|sales_document_events|operational_receipts|daily_closes)\b/i);
  assert.doesNotMatch(retryCode, /\b(?:insert|update|delete|perform|execute)\b/i);
});

test("RPC privileges, RLS, unique invoice linkage and historical triggers are not altered", () => {
  const executable = sql.replace(/--[^\n]*/g, "");
  assert.doesNotMatch(executable, /\b(?:grant|revoke|drop|alter|create table|create trigger|create policy)\b/i);
  assert.match(currentFunction, /language plpgsql\nsecurity definer\nset search_path = public/);
  assert.match(previous, /revoke all on function public\.issue_billing_invoice\(uuid\) from public, anon, authenticated/);
  assert.match(previous, /grant execute on function public\.issue_billing_invoice\(uuid\) to authenticated/);
  assert.match(foundation, /create unique index invoice_orders_one_active_invoice_per_order[\s\S]*?where is_active/);
});
