import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const invoiceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function harness({ role = "owner", entitled = true, rpcError, lostResponse = false, readError = false, issued = true, otherTenant = false } = {}) {
  const calls = { rpc: [], reads: [], auth: 0 };
  const modules = new Map();
  function load(path) {
    if (modules.has(path)) return modules.get(path);
    const mod = { exports: {} };
    const require = (name) => {
      if (name === "next/cache") return { revalidatePath() {} };
      if (name === "next/navigation") return { redirect(href) { throw Object.assign(Error("REDIRECT"), { href }); } };
      if (name === "@/lib/auth/require-role") return { requireOwnerOrManager: async () => {
        calls.auth++; if (!["owner", "manager"].includes(role)) throw Error("ROLE_DENIED");
        return { membership: { organization: { id: "tenant-a" } } };
      } };
      if (name === "@/features/entitlements/feature-catalog") return { FEATURES: { billingInvoicing: "billing.invoicing" } };
      if (name === "@/features/entitlements/server/resolver") return { requireEntitlement: async () => { if (!entitled) throw Error("ENTITLEMENT_DENIED"); } };
      if (name === "@/lib/supabase/server") return { createSupabaseServerClient: async () => ({
        rpc: async (name, args) => { calls.rpc.push({ name, args }); if (lostResponse) throw Error("NETWORK_LOST"); return { error: rpcError ? { message: rpcError } : null }; },
        from(table) {
          const filters = []; calls.reads.push({ table, filters });
          return { select() { return this; }, eq(k, v) { filters.push([k,v]); return this; }, async maybeSingle() {
            if (readError) throw Error("READ_LOST");
            return { error: null, data: { id: invoiceId, organization_id: otherTenant ? "tenant-b" : "tenant-a", fiscal_document_type: "simplified", document_status: issued ? "issued" : "draft", invoice_number: issued ? "2026-S-000001" : null } };
          } };
        },
      }) };
      if (name.startsWith("@/features/billing/")) return load(`src/${name.slice(2)}.ts`);
      if (name === "server-only") return {};
      throw Error(name);
    };
    const code = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    runInNewContext(code, { module: mod, exports: mod.exports, require, Date }); modules.set(path,mod.exports);return mod.exports;
  }
  return { calls, parse: load("src/features/billing/service-declaration.ts").parseBillingServiceDeclaration,
    issue: (form) => load("src/features/billing/server/actions.ts").issueSimplifiedBillingInvoiceAction("es", invoiceId, form) };
}
function declaration() {
  const f = new FormData(); f.set("servicePerformedOn","2026-10-18"); f.set("operationScope","local_laundry_dry_cleaning");
  f.set("fiscalRecipientRequirement","consumer"); f.set("serviceConfirmed","confirmed"); return f;
}
test("declaration requires explicit date, operation, recipient and confirmation", () => {
  const h=harness(); assert.ok(h.parse(declaration()));
  for (const name of ["servicePerformedOn","operationScope","fiscalRecipientRequirement","serviceConfirmed"]) {
    const f=declaration();f.delete(name);assert.equal(h.parse(f),null);
    const duplicate=declaration();duplicate.append(name,duplicate.get(name));assert.equal(h.parse(duplicate),null);
  }
  for (const date of ["2026-02-30","0000-01-01","today","2026-10-18T00:00:00Z"]) { const f=declaration();f.set("servicePerformedOn",date);assert.equal(h.parse(f),null); }
  for (const key of ["operationScope","fiscalRecipientRequirement"]) {const f=declaration();f.set(key,"ordinary_required");assert.equal(h.parse(f),null);}
});
test("canonical overload carries declaration, never client tenant or tax authorization", async () => {
  const h=harness(),f=declaration();f.set("organization_id","tenant-b");f.set("enabled","true");
  await assert.rejects(h.issue(f),e=>e.href?.endsWith("saved=issued"));
  assert.equal(h.calls.rpc.length,1);assert.equal(h.calls.rpc[0].name,"issue_billing_invoice");
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls.rpc[0].args)),{target_invoice_id:invoiceId,target_service_performed_on:"2026-10-18",target_operation_scope:"local_laundry_dry_cleaning",target_recipient_requirement:"consumer",target_confirmed:true});
  assert.deepEqual(h.calls.reads[0].filters,[["organization_id","tenant-a"],["id",invoiceId]]);
});
test("HTTP response lost after commit recovers the same persisted document with no second RPC", async () => {
  const h=harness({lostResponse:true});await assert.rejects(h.issue(declaration()),e=>e.href?.endsWith("saved=issued"));assert.equal(h.calls.rpc.length,1);
});
test("unreadable outcome remains uncertain, without automatic retry or another document", async () => {
  const h=harness({lostResponse:true,readError:true});await assert.rejects(h.issue(declaration()),e=>e.href?.endsWith("error=issueUncertain"));assert.equal(h.calls.rpc.length,1);
});
test("wrong-tenant readback is not accepted as successful issuance", async () => {
  const h=harness({otherTenant:true});await assert.rejects(h.issue(declaration()),e=>e.href?.endsWith("error=issueUncertain"));
});
for (const [reason,code] of [["billing_advance_workflow_required","advanceBlocked"],["billing_service_date_review_required","serviceDate"],["billing_simplified_issuance_disabled","simplifiedUnavailable"]]) {
  test(`server rejection ${reason} remains visible`,async()=>{const h=harness({rpcError:reason,issued:false});await assert.rejects(h.issue(declaration()),e=>e.href?.endsWith(`error=${code}`));assert.equal(h.calls.rpc.length,1);});
}
test("unauthorized callers and ambiguous declarations never reach the writer", async () => {
  for(const options of [{role:"staff"},{entitled:false}]) {const h=harness(options);await assert.rejects(h.issue(declaration()));assert.equal(h.calls.rpc.length,0);}
  const h=harness(),f=declaration();f.append("serviceConfirmed","confirmed");await assert.rejects(h.issue(f),e=>e.href?.endsWith("error=serviceDeclaration"));assert.equal(h.calls.rpc.length,0);
});
test("two explicit clicks use the same invoice identity, without client-generated number",async()=>{const h=harness();for(let i=0;i<2;i++)await assert.rejects(h.issue(declaration()),e=>e.href?.endsWith("saved=issued"));assert.deepEqual(h.calls.rpc[0],h.calls.rpc[1]);});
test("SQL keeps ordinary issue body intact except the typed replay/confirmation branch", () => {
 const before=read("supabase/migrations/20261017000200_billing_simplified_invoice_001e_recipient_snapshot_foundation.sql");
 const after=read("supabase/migrations/20261018000100_billing_simplified_invoice_001f_service_issuance.sql");
 const fn=s=>s.match(/create or replace function public\.issue_billing_invoice\([\s\S]*?\$\$;/)[0];
 const removeGuard=s=>s.replace(/  if invoice_row\.fiscal_document_type = 'simplified' then[\s\S]*?\n  end if;/,"");
 assert.equal(removeGuard(fn(before)),removeGuard(fn(after)));
 assert.doesNotMatch(after,/update public\.(payments|orders)|insert into public\.payments|create table|simplified_invoicing_enabled\s*=\s*true/i);
 assert.match(after,/p\.status<>'void'/);assert.match(after,/set_config\('app.billing_simplified_service_issue','on',true\)/);
});
