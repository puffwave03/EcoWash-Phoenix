import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const actions = read("src/features/sales-documents/server/actions.ts");
const printPage = read("src/app/[locale]/app/(dashboard)/orders/[orderId]/print/receipt/page.tsx");
const orderPage = read("src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx");
const sql = read("supabase/migrations/20260908000100_accounting_sales_documents_001.sql");
const issueSql = sql.slice(sql.indexOf("create function public.issue_operational_receipt"), sql.indexOf("create function public.cancel_operational_receipt"));
const issueAction = actions.slice(actions.indexOf("export async function issueOperationalReceipt"), actions.indexOf("export async function cancelOperationalReceiptAction"));

function issueWith(result) {
  const exports = {};
  const calls = [];
  const code = ts.transpileModule(issueAction, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, {
    exports,
    requirePrintAccess: async (locale) => { calls.push(["access", locale]); },
    createSupabaseServerClient: async () => ({
      rpc: (name, args) => {
        calls.push(["rpc", name, args.target_order_id]);
        return { single: async () => result };
      },
    }),
  });
  return { issue: exports.issueOperationalReceipt, calls };
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

test("known failure returns to Order items alert; success still prints persisted receipt", async () => {
  assert.match(printPage, /const receipt = await issueOperationalReceipt\(locale, orderId\)/);
  assert.match(printPage, /if \(receipt\.status === "items_required"\) \{\s*redirect\(`\/\$\{locale\}\/app\/orders\/\$\{orderId\}\?itemsError=1#items`\);\s*\}/);
  assert.match(printPage, /redirect\(`\/\$\{locale\}\/app\/accounting\/documents\/receipts\/\$\{receipt\.id\}\/print`\)/);
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
