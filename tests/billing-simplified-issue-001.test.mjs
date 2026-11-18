import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadPreviewModule, previewProps } from "../scripts/preview-billing-simplified-ticket.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sql = read("supabase/migrations/20261118211638_billing_simplified_issue_001.sql");
const id = "00000000-0000-4000-8000-000000000201";
const { BillingSimplifiedTicket } = loadPreviewModule("src/components/billing/BillingSimplifiedTicket.tsx");
const { billingSimplifiedIssuedDocument } = loadPreviewModule("src/features/billing/simplified-document.ts");
const fixture = () => {
  const doc = previewProps().document;
  return { invoice: { id, fiscalDocumentType: "simplificada", documentStatus: "issued", invoiceNumber: "2026-S-000001",
    sequenceNumber: 1, series: "S", issuedAt: "2026-11-18T12:34:00Z", issueDate: "2026-11-18", pricesIncludeTax: true,
    issuerLegalName: doc.issuer.legalName, issuerTaxId: doc.issuer.taxId, issuerAddressLine1: doc.issuer.addressLine1,
    issuerCity: doc.issuer.city, issuerPostalCode: doc.issuer.postalCode, issuerCountryCode: doc.issuer.countryCode,
    issuerLogoPath: null, customerName: null, customerTaxId: null, customerAddressLine1: null, customerAddressLine2: null,
    customerCity: null, customerCountryCode: null, customerPostalCode: null, customerEmail: null,
    currency: "EUR", subtotal: 14, discountTotal: 1, taxableBase: 12.15, taxTotal: .85, total: 13,
    paidTotal: 13, outstanding: 0, orderIds: ["order-a"], orderNumbers: ["EW-001"] },
    items: doc.items, payments: [] };
};

function service({ role = "owner", entitled = true, pos = true, posOrg = "org-a", targetPatch = {}, readError = null,
  rpcError = null, rpcData = [{ invoice_id: id, invoice_number: "2026-S-000001" }], detailError = null } = {}) {
  const calls = { auth: [], clients: 0, reads: [], rpc: [], detail: 0 };
  const detail = fixture();
  const target = { id, organization_id: "org-a", fiscal_document_type: "simplificada", document_status: "draft", ...targetPatch };
  const client = {
    from(table) {
      assert.equal(table, "invoices"); const filters = [];
      const query = { select() { return query; }, eq(key, value) { filters.push([key, value]); return query; },
        async maybeSingle() { calls.reads.push(filters); return { data: target, error: readError }; } };
      return query;
    },
    rpc(name, args) { calls.rpc.push({ name, args }); assert.equal(name, "issue_billing_invoice");
      return { async returns() { return { data: rpcData, error: rpcError }; } }; },
    storage: { from() { throw Error("Fixture has no logo"); } },
  };
  const imports = {
    "server-only": {},
    "@/features/billing/server/queries": { async getBillingSimplifiedIssued() { calls.detail++; if (detailError) throw detailError; return detail; } },
    "@/features/billing/simplified-document": { billingSimplifiedIssuedDocument },
    "@/features/entitlements/feature-catalog": { FEATURES: { billingInvoicing: "billing.invoicing" } },
    "@/features/entitlements/server/resolver": { async requireEntitlement() { calls.auth.push("billing"); assert.ok(entitled, "BILLING_DENIED"); } },
    "@/features/pos/server/access": { async requirePosAccess() { calls.auth.push("pos"); assert.ok(pos, "POS_DENIED"); return { membership: { organization: { id: posOrg } } }; } },
    "@/lib/auth/require-role": { async requireOwnerOrManager() { calls.auth.push("role"); assert.ok(["owner", "manager"].includes(role), "ROLE_DENIED");
      return { membership: { organization: { id: "org-a", timezone: "Atlantic/Canary" } } }; } },
    "@/lib/supabase/server": { async createSupabaseServerClient() { calls.clients++; return client; } },
  };
  const compiled = { exports: {} };
  const code = ts.transpileModule(read("src/features/billing/server/simplified-issue.ts"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  runInNewContext(code, { module: compiled, exports: compiled.exports, require(name) { assert.ok(name in imports, name); return imports[name]; } });
  return { calls, detail, issue: (targetId = id) => compiled.exports.issueBillingSimplifiedInvoice("es", targetId) };
}
const render = (props) => renderToStaticMarkup(createElement(BillingSimplifiedTicket, props));
const plain = (html) => html.replace(/<style>[\s\S]*?<\/style>/g, "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

test("protected service calls only the canonical issue RPC with the invoice UUID, no financial payload", async () => {
  const h = service(); const result = await h.issue();
  assert.equal(result.status, "issued"); assert.equal(result.invoiceNumber, "2026-S-000001");
  assert.deepEqual(h.calls.auth, ["role", "billing", "pos"]);
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls.rpc)), [{ name: "issue_billing_invoice", args: { target_invoice_id: id } }]);
  assert.deepEqual(h.calls.reads[0], [["organization_id", "org-a"], ["id", id]]);
  assert.equal(result.ticket.document.fiscalUseAllowed, true);
});

test("same issued UUID remains retryable through the protected service", async () => {
  const h = service({ targetPatch: { document_status: "issued" } });
  assert.equal((await h.issue()).invoiceNumber, (await h.issue()).invoiceNumber);
  assert.equal(h.calls.rpc.length, 2); // SQL, not this double, proves idempotency.
});

test("roles, entitlement, POS and changed tenant deny before a client/RPC", async () => {
  for (const options of [{ role: "staff" }, { entitled: false }, { pos: false }]) {
    const h = service(options); await assert.rejects(h.issue(), /DENIED/); assert.equal(h.calls.clients, 0);
  }
  const foreign = service({ posOrg: "org-b" }); assert.equal((await foreign.issue()).reason, "invoice_unavailable");
  assert.equal(foreign.calls.clients, 0);
});

test("foreign, ordinary, cancelled and malformed targets never call an issue RPC", async () => {
  for (const targetPatch of [{ organization_id: "org-b" }, { id: "other" }, { fiscal_document_type: "ordinaria" }, { document_status: "cancelled" }]) {
    const h = service({ targetPatch }); assert.equal((await h.issue()).reason, "invoice_unavailable"); assert.equal(h.calls.rpc.length, 0);
  }
  const invalid = service(); assert.equal((await invalid.issue("not-a-uuid")).reason, "invalid_input"); assert.equal(invalid.calls.clients, 0);
  assert.equal((await service({ readError: { message: "denied" } }).issue()).reason, "invoice_unavailable");
});

test("SQL rejection or missing migration is blocked without generating replacement numbers", async () => {
  for (const message of ["billing_order_not_fully_paid", "billing_pos_registration_unverified", "billing_simplified_draft_incompatible", "billing_issuer_configuration_required"]) {
    const h = service({ rpcError: { message }, rpcData: null }); assert.equal((await h.issue()).reason, "issue_blocked"); assert.equal(h.calls.detail, 0);
  }
  assert.equal((await service({ rpcError: { code: "42883" } }).issue()).reason, "issue_schema_unavailable");
  for (const rpcData of [null, [], [{ invoice_id: "other", invoice_number: "x" }], [{ invoice_id: id, invoice_number: "" }]]) {
    assert.equal((await service({ rpcData }).issue()).reason, "issue_blocked");
  }
});

test("failed presentation after issue retains the persisted identity for safe retry", async () => {
  const result = await service({ detailError: Error("read failed") }).issue();
  assert.equal(result.status, "issued"); assert.equal(result.invoiceNumber, "2026-S-000001"); assert.equal(result.ticket, null);
  const wrong = service(); wrong.detail.invoice.invoiceNumber = "OTHER"; assert.equal((await wrong.issue()).ticket, null);
});

test("issued ticket shows persisted identity and anonymous label, never preview/demo status", async () => {
  const result = await service().issue(); const before = JSON.stringify(result.ticket), html = render(result.ticket);
  assert.match(html, /data-fiscal-issued="true"/); assert.match(plain(html), /FACTURA SIMPLIFICADA.*2026-S-000001/);
  assert.match(plain(html), /CLIENTE SIN IDENTIFICAR/); assert.match(plain(html), /IGIC \(7%\) 0,85.*TOTAL 13,00/);
  assert.doesNotMatch(plain(html), /BORRADOR|VISTA PREVIA|DEMOSTRACIÓN|DOCUMENTO INCOMPLETO/);
  assert.equal(JSON.stringify(result.ticket), before); assert.equal(render(result.ticket), html);
  assert.equal(result.ticket.document.recipient, null);
});

test("named issued recipient and operational refund status never rewrite fiscal content", async () => {
  const h = service(); Object.assign(h.detail.invoice, { customerName: "Stored name", customerTaxId: "STORED", paidTotal: 5, outstanding: 8 });
  const result = await h.issue(), html = render(result.ticket);
  assert.match(plain(html), /Stored name.*STORED/); assert.doesNotMatch(plain(html), /CLIENTE SIN IDENTIFICAR/);
  assert.match(plain(html), /TOTAL 13,00.*Pagado 5,00.*Pendiente 8,00/);
});

test("incomplete issued fields or mixed demo/preview inputs cannot appear as issued", async () => {
  for (const change of [
    (props) => { props.document.issuer.taxId = null; }, (props) => { props.document.document.number = null; },
    (props) => { props.document.document.issuedAt = null; }, (props) => { props.preview = true; },
    (props) => { props.demonstration = { number: "FAKE", issuedAt: "2026-11-18" }; },
  ]) {
    const props = (await service().issue()).ticket; change(props); const html = render(props);
    assert.match(html, /data-fiscal-issued="false"/); assert.doesNotMatch(html, /<article/);
  }
});

test("issued projection rejects drafts, ordinary documents and missing persisted identity", () => {
  for (const patch of [{ documentStatus: "draft" }, { fiscalDocumentType: "ordinaria" }, { invoiceNumber: null }, { issuedAt: "invalid" }, { sequenceNumber: null }]) {
    const detail = fixture(); Object.assign(detail.invoice, patch); assert.throws(() => billingSimplifiedIssuedDocument(detail), /issued_required/);
  }
});

test("SQL uses authorized tenant locks and immutable retry before live payment validation/allocation", () => {
  assert.match(sql, /org_id uuid := public.app_current_organization_id\(\)/);
  assert.match(sql, /has_organization_role\(org_id, array\['owner', 'manager'\]/);
  assert.match(sql, /organization_entitlement_is_enabled\(org_id, 'billing.invoicing', now\(\)\)/);
  assert.match(sql, /perform public.require_pos_access\(org_id\)/);
  assert.match(sql, /customer_order.organization_id = org_id and customer_order.id = target_order_id for update/);
  const retry = sql.indexOf("-- Retry is retrieval"), validate = sql.indexOf("prepared_id :="), allocate = sql.indexOf("insert into public.billing_invoice_number_counters");
  assert.ok(retry > 0 && retry < validate && validate < allocate);
  assert.match(sql, /prepared_id := public.create_simplified_billing_draft\(target_order_id, invoice_row.series\)/);
  assert.match(sql, /prepared_id is distinct from target_invoice_id/);
  assert.match(sql, /on conflict \(organization_id, series\) do update/);
  assert.match(sql, /issue_date = fiscal_date, issued_at = issue_time/);
  assert.match(sql, /organization.timezone/);
  assert.doesNotMatch(sql, /record_pos_payment\(|record_pos_refund\(|update public.payments|insert into public.payments|\/ \(1 \+|round\(/);
});

test("SQL preserves ordinary body, revokes bypass, freezes issued fields and serializes child writes", () => {
  assert.match(sql, /alter function public.issue_billing_invoice\(uuid\) rename to issue_ordinary_billing_invoice/);
  assert.match(sql, /revoke all on function public.issue_ordinary_billing_invoice\(uuid\) from public, anon, authenticated/);
  assert.match(sql, /return query select \* from public.issue_ordinary_billing_invoice\(target_invoice_id\)/);
  assert.match(sql, /old.document_status = 'issued'[\s\S]*new is distinct from old/);
  assert.match(sql, /invoice.id = parent_id for share/);
  assert.match(sql, /invoice_items_simplified_snapshot_lock/); assert.match(sql, /invoice_orders_simplified_snapshot_lock/);
  assert.match(sql, /invoices_simplified_state_valid/);
  assert.match(sql, /other.fiscal_document_type <> 'simplificada'/);
  assert.doesNotMatch(sql, /create table|create policy|CLIENTE SIN IDENTIFICAR/);
  assert.match(sql, /^begin;$/m); assert.match(sql, /^commit;$/m);
});
