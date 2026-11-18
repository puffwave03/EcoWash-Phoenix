import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const path = "src/features/billing/server/simplified-draft.ts";
const sql = read("supabase/migrations/20261118195512_billing_simplified_draft_001.sql");
const orderId = "00000000-0000-4000-8000-000000000003";
const invoiceId = "00000000-0000-4000-8000-000000000005";
const missingDraft = { status: "blocked", reason: "simplified_draft_required", context: { orderId } };
const preview = { status: "preview", context: { orderId }, ticket: { preview: true } };

function service({ before = missingDraft, after = preview, rpcResult = { data: invoiceId, error: null }, authError } = {}) {
  const calls = { bridge: [], rpc: [], clients: 0 };
  const imports = {
    "server-only": {},
    "@/features/billing/server/simplified-pos-bridge": { async getBillingSimplifiedPosPreview(locale, id) {
      calls.bridge.push({ locale, id });
      if (authError) throw authError;
      return calls.bridge.length === 1 ? before : after;
    } },
    "@/lib/supabase/server": { async createSupabaseServerClient() {
      calls.clients++;
      // No from/insert/update or payment/numbering RPC is available.
      return { async rpc(name, args) {
        assert.equal(name, "create_simplified_billing_draft"); calls.rpc.push({ name, args }); return rpcResult;
      } };
    } },
  };
  const compiled = { exports: {} };
  const code = ts.transpileModule(read(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  runInNewContext(code, { module: compiled, exports: compiled.exports, require(name) {
    assert.ok(name in imports, `Unexpected import ${name}`); return imports[name];
  } });
  return { calls, create: (id = orderId, series = "s") => compiled.exports.createBillingSimplifiedDraft("es", id, series) };
}

test("eligible same-tenant order uses one atomic draft RPC and then the existing POS preview", async () => {
  const h = service(); const result = await h.create(orderId, " s ");
  assert.equal(result.status, "draft"); assert.equal(result.invoiceId, invoiceId); assert.equal(result.preview, preview);
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls.rpc)), [{ name: "create_simplified_billing_draft", args: {
    target_order_id: orderId, target_series: "S",
  } }]);
  assert.deepEqual(h.calls.bridge, [{ locale: "es", id: orderId }, { locale: "es", id: orderId }]);
});

test("existing compatible draft is checked by the same idempotent RPC", async () => {
  const h = service({ before: preview }); assert.equal((await h.create()).invoiceId, invoiceId);
  assert.equal(h.calls.rpc.length, 1);
});

for (const reason of ["not_fully_paid", "ordinary_draft_present", "invoice_already_issued", "invoice_conflict",
  "order_unavailable", "unsupported_tax_model", "billing_totals_mismatch", "recipient_mismatch",
  "pos_registration_unverified", "payment_reconciliation_failed", "read_failed"]) {
  test(`bridge gate ${reason} prevents draft creation`, async () => {
    const before = { status: "blocked", reason, context: null }, h = service({ before });
    assert.equal(await h.create(), before); assert.equal(h.calls.clients, 0); assert.equal(h.calls.rpc.length, 0);
  });
}

test("malformed IDs and series cannot reach the bridge or RPC", async () => {
  for (const [id, series] of [["foreign-input", "S"], [orderId, ""], [orderId, "S<script>"], [orderId, "S".repeat(13)]]) {
    const h = service(); assert.equal((await h.create(id, series)).reason, "invalid_input");
    assert.equal(h.calls.bridge.length, 0); assert.equal(h.calls.clients, 0);
  }
});

test("role/entitlement/POS denial propagates before a mutation client exists", async () => {
  for (const message of ["ROLE_DENIED", "BILLING_DENIED", "POS_DENIED"]) {
    const h = service({ authError: new Error(message) });
    await assert.rejects(h.create(), new RegExp(message)); assert.equal(h.calls.clients, 0);
  }
});

test("RPC conflicts, incompatibility, absent migration and errors fail closed without fallback writes", async () => {
  for (const [error, expected] of [
    [{ message: "billing_simplified_draft_conflict" }, "draft_conflict"],
    [{ message: "billing_order_already_invoiced" }, "draft_conflict"],
    [{ message: "billing_simplified_draft_incompatible" }, "draft_incompatible"],
    [{ code: "PGRST202" }, "draft_schema_unavailable"], [{ code: "42883" }, "draft_schema_unavailable"],
    [{ message: "billing_order_not_fully_paid" }, "draft_creation_failed"],
    [{ message: "billing_not_authorized" }, "draft_creation_failed"],
  ]) {
    const h = service({ rpcResult: { data: null, error } });
    assert.equal((await h.create()).reason, expected); assert.equal(h.calls.rpc.length, 1); assert.equal(h.calls.bridge.length, 1);
  }
  for (const data of [null, "invalid-id", 5]) {
    assert.equal((await service({ rpcResult: { data, error: null } }).create()).reason, "draft_creation_failed");
  }
});

test("a changed payment state after creation is reported with the persisted draft ID", async () => {
  const after = { status: "blocked", reason: "not_fully_paid", context: null };
  const result = await service({ after }).create();
  assert.equal(result.status, "draft"); assert.equal(result.invoiceId, invoiceId); assert.equal(result.preview, after);
});

test("SQL authenticates tenant, Billing and POS before locking or creating", () => {
  const lock = sql.indexOf("select * into order_row");
  for (const gate of ["auth.uid() is null", "has_organization_role", "organization_entitlement_is_enabled", "require_pos_access"]) {
    assert.ok(sql.indexOf(gate) > 0 && sql.indexOf(gate) < lock);
  }
  assert.match(sql, /customer_order.organization_id = org_id and customer_order.id = target_order_id\s+for update/);
  assert.doesNotMatch(sql, /target_organization_id|target_tax_rate/);
  assert.match(sql, /set search_path = public/);
  assert.match(sql, /revoke all on function[\s\S]*from public, anon, authenticated/);
  assert.match(sql, /grant execute on function[\s\S]*to authenticated/);
});

test("SQL serializes per order, reuses compatible simplified drafts and retains the canonical unique protection", () => {
  const lock = sql.indexOf("for update;"), lookup = sql.indexOf("select link.invoice_id"), create = sql.indexOf("draft_id := public.create_billing_draft");
  assert.ok(lock < lookup && lookup < create);
  assert.match(sql, /invoice_row.document_status <> 'draft'[\s\S]*invoice_row.fiscal_document_type <> 'simplificada'/);
  assert.match(sql, /invoice_row.series <> normalized_series[\s\S]*billing_simplified_draft_conflict/);
  assert.match(sql, /else[\s\S]*draft_id := public.create_billing_draft\(array\[target_order_id\]\)/);
  assert.match(sql, /perform public.prepare_simplified_billing_draft\(draft_id, normalized_series\)/);
  const foundation = read("supabase/migrations/20260826000300_billing_001_invoicing_foundation.sql");
  assert.match(foundation, /create unique index invoice_orders_one_active_invoice_per_order\s+on public.invoice_orders \(order_id\)\s+where is_active/);
  assert.doesNotMatch(sql, /exception when|on conflict|delete from|create or replace/);
  assert.match(sql, /^begin;$/m); assert.match(sql, /^commit;$/m);
});

test("SQL reads fully-paid POS facts with required sessions for cash and card, without financial mutations", () => {
  assert.match(sql, /payment.pos_session_id is null/);
  assert.match(sql, /session.organization_id = org_id/);
  assert.match(sql, /session.status not in \('open', 'closed'\)/);
  assert.match(sql, /payment.recorded_by is null or payment.confirmed_by is null/);
  assert.match(sql, /original.method = refund.method/);
  assert.match(sql, /select \* into summary from public.get_order_payment_summary\(target_order_id\)/);
  assert.match(sql, /summary.total_paid is distinct from order_row.total/);
  assert.match(sql, /billing_order_not_fully_paid/);
  assert.doesNotMatch(sql, /target_method = 'cash'|record_pos_payment\(|record_pos_refund\(|insert into|update public\.|delete from|issue_billing_invoice\(|nextval\(|billing_invoice_number_counters/);
});

test("SQL preserves WALKIN omission, named snapshots and canonical inclusive math; mixed or inconsistent snapshots block", () => {
  assert.match(sql, /customer_row.customer_code = 'WALKIN-SHARED'/);
  for (const field of ["customer_name", "customer_tax_id", "customer_address_line1", "customer_address_line2", "customer_city", "customer_postal_code", "customer_country_code", "customer_email"]) {
    assert.match(sql, new RegExp(`invoice_row.${field} is not null`));
  }
  assert.doesNotMatch(sql, /CLIENTE SIN IDENTIFICAR|round\(|\/ \(1 \+|\*.*tax_rate/);
  assert.match(sql, /nullif\(btrim\(invoice_row.customer_name\), ''\) is null/);
  assert.match(sql, /totals.rate_count <> 1/);
  assert.match(sql, /not item.prices_include_tax/);
  assert.match(sql, /item.unit_price is distinct from source.unit_price/);
  assert.match(sql, /totals.tax_total is distinct from invoice_row.tax_total/);
  assert.match(sql, /totals.item_count <> totals.source_count/);
  const core = read("supabase/migrations/20261118175639_billing_simplified_core_001.sql");
  assert.match(core, /invoices_simplified_fiscal_use_disabled/);
  assert.doesNotMatch(read(path), /"use server"|revalidatePath|redirect\(/);
});
