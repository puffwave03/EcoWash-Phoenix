import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const actions = read("src/features/sales-documents/server/actions.ts");
const printPage = read("src/app/[locale]/app/(dashboard)/orders/[orderId]/print/receipt/page.tsx");
const orderPage = read("src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx");
const sql = read("supabase/migrations/20260908000100_accounting_sales_documents_001.sql");
const issueSql = sql.slice(sql.indexOf("create function public.issue_operational_receipt"), sql.indexOf("create function public.cancel_operational_receipt"));
const issueAction = actions.slice(actions.indexOf("export async function issueOperationalReceipt"), actions.indexOf("export async function cancelOperationalReceiptAction"));

function issueWith(result, denied = false) {
  const exports = {};
  const calls = [];
  const code = ts.transpileModule(issueAction, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, {
    exports,
    requirePrintAccess: async (locale) => { calls.push(["access", locale]); if (denied) throw Error("DENIED"); },
    revalidatePath: (path) => { calls.push(["revalidate", path]); },
    redirect: (href) => { throw Object.assign(Error("REDIRECT"), {href}); },
    createSupabaseServerClient: async () => ({
      rpc: (name, args) => {
        calls.push(["rpc", name, args.target_order_id]);
        return { single: async () => result };
      },
    }),
  });
  return { issue: exports.issueOperationalReceipt, post: exports.issueOperationalReceiptAction, calls };
}

test("database remains the authoritative empty-active-items gate before receipt numbering", () => {
  assert.match(issueSql, /item\.organization_id = org_id and item\.order_id = target_order_id and item\.is_active/);
  assert.match(issueSql, /if jsonb_array_length\(items_snapshot\) = 0 then\s+raise exception 'operational_receipt_items_required' using errcode = '22023'/);
  assert.ok(issueSql.indexOf("operational_receipt_items_required") < issueSql.indexOf("insert into public.operational_receipt_number_counters"));
  assert.ok(issueSql.indexOf("operational_receipt_items_required") < issueSql.indexOf("insert into public.operational_receipts"));
  assert.match(issueAction, /supabase\.rpc\("issue_operational_receipt"/);
});

test("only the exact empty-items RPC error gets the controlled result", async () => {
  const known = issueWith({ data: null, error: { code: "22023", message: "operational_receipt_items_required" } });
  assert.equal((await known.issue("it", "order-1")).status, "items_required");
  assert.deepEqual(known.calls, [["access", "it"], ["rpc", "issue_operational_receipt", "order-1"]]);

  for (const error of [
    { code: "22023", message: "operational_receipt_order_invalid" },
    { code: "42501", message: "operational_receipt_items_required" },
    { code: "08006", message: "connection_failed" },
  ]) {
    const { issue } = issueWith({ data: null, error });
    await assert.rejects(issue("it", "order-1"), /operational_receipt_issue_failed/);
  }
  const { issue } = issueWith({ data: null, error: null });
  await assert.rejects(issue("it", "order-1"), /operational_receipt_issue_failed:unknown/);
});

test("residual backend action retains its result contract; legacy GET cannot invoke it", async () => {
  assert.doesNotMatch(printPage, /issueOperationalReceipt|sales-documents\/server\/actions/);
  assert.match(orderPage, /routeSearch\.itemsError === "1"[\s\S]*role="alert">\{commonT\("orderItemsRequired"\)\}/);
  const { issue } = issueWith({ data: { receipt_id: "receipt-1", receipt_number: "REC-1" }, error: null });
  const receipt = await issue("it", "order-1");
  assert.equal(receipt.status, "issued");
  assert.equal(receipt.id, "receipt-1");
  assert.equal(receipt.receiptNumber, "REC-1");
});

test("ticket and label print paths remain separate; five existing alert translations are present", () => {
  for (const mode of ["ticket", "labels"]) {
    const page = read(`src/app/[locale]/app/(dashboard)/orders/[orderId]/print/${mode}/page.tsx`);
    assert.match(page, /getPrintOrderContext\(locale, orderId\)/);
    assert.match(page, /OrderPrintDocument/);
    assert.doesNotMatch(page, /issueOperationalReceipt/);
  }
  for (const locale of ["it", "es", "en", "fr", "de"]) {
    const text = JSON.parse(read(`src/i18n/${locale}/common.json`)).orderItemsRequired;
    assert.ok(text?.length > 30, locale);
  }
});

function loadPreview(path, imports) {
  const compiled = { exports: {} };
  const nativeRequire = createRequire(import.meta.url);
  const code = ts.transpileModule(read(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  runInNewContext(code, { module: compiled, exports: compiled.exports, require(name) {
    if (name === "react/jsx-runtime") return nativeRequire(name);
    if (Object.hasOwn(imports, name)) return imports[name];
    throw Error(`Unexpected import (including any issue action): ${name}`);
  } });
  return compiled.exports;
}

test("ordinary GET and refresh only authorize and redirect; denied access never redirects", async () => {
  const calls = [];
  const path = "src/app/[locale]/app/(dashboard)/orders/[orderId]/print/receipt/page.tsx";
  const imports = {
    "next/navigation": { redirect(href) { calls.push(["redirect", href]); throw Error("REDIRECT"); }, notFound() { throw Error("NOT_FOUND"); } },
    "@/features/printing/server/access": { requirePrintAccess: async (locale) => { calls.push(["access", locale]); } },
  };
  const Page = loadPreview(path, imports).default;
  for (const searchParams of [undefined, Promise.resolve({}), Promise.resolve({ document: undefined })]) {
    await assert.rejects(Page({ params: Promise.resolve({ locale: "it", orderId: "synthetic-order" }), searchParams }), /REDIRECT/);
  }
  assert.deepEqual(calls, Array.from({ length: 3 }, () => [["access", "it"], ["redirect", "/it/app/orders/synthetic-order"]]).flat());
  calls.length = 0;
  const DeniedPage = loadPreview(path, { ...imports,
    "@/features/printing/server/access": { requirePrintAccess: async () => { throw Error("DENIED"); } },
  }).default;
  await assert.rejects(DeniedPage({ params: Promise.resolve({ locale: "it", orderId: "foreign-order" }) }), /DENIED/);
  assert.deepEqual(calls, []);
});

test("real shared print actions expose EW links and an explicit REC POST in every locale", () => {
  const { PrintOrderActions } = loadPreview("src/components/printing/PrintOrderActions.tsx", {
    "react-dom": { useFormStatus: () => ({pending:false}) },
    "@/features/sales-documents/server/actions": { issueOperationalReceiptAction: () => {} },
    "@/i18n/navigation": { Link: ({ href, children }) => createElement("a", { href }, children) },
  });
  for (const locale of ["it", "es", "en", "fr", "de"]) {
    const text = JSON.parse(read(`src/i18n/${locale}/common.json`)).print.actions;
    const html = renderToStaticMarkup(PrintOrderActions({ locale, orderId: "synthetic-order", text }));
    assert.doesNotMatch(html, /\/print\/receipt/);
    for (const mode of ["customer-copy", "ticket", "labels"]) assert.ok(html.includes(`/print/${mode}`));
    assert.match(html, /<form/);
    assert.match(html, /type="submit"/);
    // REC is an explicit action, never a navigation link.
    const legacy = renderToStaticMarkup(PrintOrderActions({ locale, orderId: "synthetic-order", text, modes: ["receipt"] }));
    assert.doesNotMatch(legacy, /<a/);
  }
});

test("explicit REC POST authorizes once, reuses the RPC result and redirects to its persisted snapshot", async()=>{
  const h=issueWith({data:{receipt_id:"receipt-1",receipt_number:"REC-1"},error:null});
  await assert.rejects(h.post("it","order-1"),e=>e.href==="/it/app/accounting/documents/receipts/receipt-1/print");
  assert.deepEqual(h.calls,[["access","it"],["rpc","issue_operational_receipt","order-1"],["revalidate","/it/app/accounting/documents"]]);
  const empty=issueWith({data:null,error:{code:"22023",message:"operational_receipt_items_required"}});
  await assert.rejects(empty.post("es","order-1"),e=>e.href==="/es/app/orders/order-1?itemsError=1");
  assert.equal(empty.calls.length,2);
  const denied=issueWith({data:null,error:null},true);
  await assert.rejects(denied.post("it","foreign"),/DENIED/);
  assert.deepEqual(denied.calls,[["access","it"]]);
});
