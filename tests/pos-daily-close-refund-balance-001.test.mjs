import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { getNetCollected } from "../src/features/payments/refunds.ts";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const plain = value => JSON.parse(JSON.stringify(value));
const order = (id, total, extra = {}) => ({ id, total, subtotal: total, order_number: id, organization_id: "tenant-a", location_id: "site-a", currency: "EUR", created_at: "2026-11-07T10:00:00Z", operational_business_date: null, is_active: true, production_status: "received", due_at: null, completed_at: null, cancelled_at: null, customer: { display_name: "Synthetic customer" }, property: null, assigned_to_profile: null, ...extra });
const payment = (id, orderId, amount, status = "confirmed", extra = {}) => ({ id, order_id: orderId, amount, status, organization_id: "tenant-a", paid_at: "2026-11-07T11:00:00Z", channel: "pos", method: "cash", pos_session_id: "session-a", refunded_from_payment_id: status === "refunded" ? "p-174" : null, ...extra });

// Real Accounting/Daily Close queries, only read-only in-memory doubles. No
// database, RPC writer, Docker resource or persisted snapshot is modified.
function harness({ role = "owner", refundAmount = 4, refundDate = "2026-11-07T12:00:00Z", cancelled = false } = {}) {
  const rows = {
    organizations: [{ id: "tenant-a", default_currency: "EUR" }],
    locations: [{ id: "site-a", organization_id: "tenant-a", name: "A", is_active: true, deleted_at: null }, { id: "site-b", organization_id: "tenant-a", name: "B", is_active: true, deleted_at: null }, { id: "foreign-site", organization_id: "tenant-b", name: "Foreign", is_active: true, deleted_at: null }],
    orders: [order("EW-000174", 8.5, cancelled ? { production_status: "cancelled", cancelled_at: "2026-11-07T12:30:00Z" } : {}), order("EW-000175", 9.5), order("other-site", 20, { location_id: "site-b" }), order("foreign-order", 1000, { organization_id: "tenant-b", location_id: "foreign-site" })],
    payments: [payment("p-174", "EW-000174", 4), payment("p-175", "EW-000175", 4), payment("p-b", "other-site", 1), payment("foreign-payment", "EW-000174", 300, "confirmed", { organization_id: "tenant-b" }), payment("foreign-refund", "EW-000175", 300, "refunded", { organization_id: "tenant-b" })],
    order_status_history: [], order_items: [], pos_sessions: [], pickups: [], deliveries: [], order_customer_handoffs: [],
  };
  if (refundAmount) rows.payments.push(payment("r-174", "EW-000174", refundAmount, "refunded", { paid_at: refundDate }));
  rows.order_items = rows.orders.map(o => ({ order_id: o.id, organization_id: o.organization_id, is_active: true }));
  const calls = [];
  let clientCount = 0;
  const at = (row, key) => key.split(".").reduce((v, part) => v?.[part], row);
  const supabase = { from(table) {
    assert.ok(Object.hasOwn(rows, table), `Unexpected table: ${table}`);
    const filters = [], operations = [];
    let selected = "", slice = [0, 1000];
    const add = (op, key, value, predicate) => { operations.push([op, key, value]); filters.push(predicate); return q; };
    function result(single = false) {
      calls.push({ table, selected, operations: [...operations] });
      const data = rows[table].map(row => table === "payments" ? { ...row, order: rows.orders.find(o => o.id === row.order_id && o.organization_id === row.organization_id) ?? null } : row)
        .filter(row => !(table === "payments" && selected.includes("!inner") && !row.order))
        .filter(row => filters.every(f => f(row))).slice(...slice);
      return { data: single ? data[0] ?? null : data, error: null };
    }
    const q = {
      select(s) { selected = s; return this; },
      eq(k, v) { return add("eq", k, v, r => at(r, k) === v); },
      neq(k, v) { return add("neq", k, v, r => at(r, k) !== v); },
      in(k, v) { return add("in", k, v, r => v.includes(at(r, k))); },
      is(k, v) { return add("is", k, v, r => at(r, k) === v); },
      gte(k, v) { return add("gte", k, v, r => at(r, k) != null && at(r, k) >= v); },
      lt(k, v) { return add("lt", k, v, r => at(r, k) != null && at(r, k) < v); },
      contains(k, v) { return add("contains", k, v, r => Object.entries(v).every(([key, value]) => at(r, k)?.[key] === value)); },
      or(expression) {
        const explicit = expression.match(/operational_business_date\.(eq|lte)\.([\d-]+)/);
        const start = expression.match(/created_at\.gte\.([^,]+)/)?.[1];
        const end = expression.match(/created_at\.lt\.([^,)]+)/)?.[1];
        assert.ok(explicit && end, `Unexpected OR expression: ${expression}`);
        return add("or", "operational_business_date", expression, r => r.operational_business_date == null
          ? (!start || r.created_at >= start) && r.created_at < end
          : explicit[1] === "eq" ? r.operational_business_date === explicit[2] : r.operational_business_date <= explicit[2]);
      },
      order() { return this; }, range(from, to) { slice = [from, to + 1]; return this; },
      returns: async () => result(), single: async () => result(true), maybeSingle: async () => result(true),
      then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); },
    };
    return q;
  } };
  const cache = new Map();
  function load(path) {
    if (cache.has(path)) return cache.get(path);
    const compiled = { exports: {} };
    runInNewContext(ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
      module: compiled, exports: compiled.exports, console,
      require(name) {
        if (name === "server-only") return {};
        if (name === "@/lib/auth/require-role") return { requireOwnerOrManager: async () => {
          if (!["owner", "manager"].includes(role)) throw Error("ROLE_DENIED");
          return { membership: { organization: { id: "tenant-a", timezone: "Atlantic/Canary" } } };
        } };
        if (name === "@/lib/supabase/server") return { createSupabaseServerClient: async () => { clientCount++; return supabase; } };
        if (name.startsWith("@/features/")) return load(`src/${name.slice(2)}.ts`);
        throw Error(`Unexpected import: ${name}`);
      },
    }, { filename: path });
    cache.set(path, compiled.exports); return compiled.exports;
  }
  const period = { startDate: "2026-11-07", endDateExclusive: "2026-11-08" };
  return { rows, calls, clients: () => clientCount,
    accounting: (extra = {}) => load("src/features/accounting/server/queries.ts").getAccountingSummary("it", { locationId: "site-a", salesPeriod: period, paymentPeriod: period, ...extra }),
    daily: (extra = {}) => load("src/features/daily-close/server/queries.ts").getDailyCloseData("it", { businessDate: "2026-11-07", locationId: "site-a", ...extra }),
  };
}

test("UAT: real queries produce 14.00, correct attention items and original cash totals", async () => {
  const h = harness(), before = plain(h.rows);
  const a = (await h.accounting()).currencies[0], d = await h.daily();
  assert.equal(d.complete, true);
  for (const value of [a, d.payments[0]]) assert.deepEqual(plain({ due: value.outstanding, gross: value.collectedGross, refunds: value.refunds, net: value.collectedNet }), { due: 14, gross: 8, refunds: 4, net: 4 });
  for (const o of h.rows.orders.filter(o => o.organization_id === "tenant-a" && o.location_id === "site-a")) {
    const ledger = h.rows.payments.filter(p => p.organization_id === o.organization_id && p.order_id === o.id);
    const due = o.total - getNetCollected(ledger);
    const item = d.groups.paymentIssues.find(item => item.orderId === o.id);
    assert.equal(Number(item.missingAmount.split(" ")[0]), due);
    assert.equal(item.paymentStatus, due === o.total ? "unpaid" : "partially_paid");
  }
  assert.deepEqual(h.rows, before);
  const lifetime = h.calls.filter(c => c.table === "payments" && c.operations.some(([op, k]) => op === "in" && k === "order_id"));
  assert.ok(lifetime.length >= 3);
  for (const call of lifetime) {
    assert.ok(call.operations.some(([op, k, v]) => op === "in" && k === "status" && v.includes("confirmed") && v.includes("refunded")));
    assert.ok(!call.operations.some(([, key]) => key === "paid_at"));
    assert.ok(call.operations.some(([op, k, v]) => op === "eq" && k === "organization_id" && v === "tenant-a"));
  }
});

for (const [refundAmount, outstanding] of [[0, 10], [1.25, 11.25], [4, 14]]) test(`real queries: refund ${refundAmount} restores only the registered amount`, async () => {
  const h = harness({ refundAmount });
  assert.equal((await h.accounting()).currencies[0].outstanding, outstanding);
  assert.equal((await h.daily()).payments[0].outstanding, outstanding);
});

test("cancelled order is excluded from both residual lists while its cash movements remain", async () => {
  const h = harness({ cancelled: true });
  const a = (await h.accounting()).currencies[0], d = await h.daily();
  assert.deepEqual(plain(a.orderIds), ["EW-000175"]);
  assert.equal(a.salesNet, 9.5); assert.equal(a.outstanding, 5.5);
  assert.equal(d.payments[0].outstanding, 5.5);
  assert.deepEqual(plain(d.groups.paymentIssues.map(o => o.orderId)), ["EW-000175"]);
  assert.deepEqual(plain([a.collectedGross, a.refunds, a.collectedNet]), [8, 4, 4]);
});

test("later refund updates the live residual, but daily cash retains payment event dates", async () => {
  const h = harness({ refundDate: "2026-11-08T12:00:00Z" });
  const originalDay = await h.daily();
  assert.deepEqual(plain([originalDay.payments[0].outstanding, originalDay.payments[0].collectedGross, originalDay.payments[0].refunds, originalDay.payments[0].collectedNet]), [14, 8, 0, 8]);
  const refundDay = await h.daily({ businessDate: "2026-11-08" });
  assert.deepEqual(plain([refundDay.payments[0].outstanding, refundDay.payments[0].collectedGross, refundDay.payments[0].refunds, refundDay.payments[0].collectedNet]), [0, 0, 4, -4]);
  const a = (await h.accounting({ paymentPeriod: { startDate: "2026-11-08", endDateExclusive: "2026-11-09" } })).currencies[0];
  assert.equal(a.outstanding, 14); assert.equal(a.collectedNet, -4);
});

test("tenant and location filters exclude foreign payments and keep site totals distinct", async () => {
  const h = harness();
  assert.equal((await h.daily()).payments[0].outstanding, 14);
  assert.equal((await h.daily({ locationId: "site-b" })).payments[0].outstanding, 19);
  assert.equal((await h.accounting({ locationId: null })).currencies[0].outstanding, 33);
  await assert.rejects(h.accounting({ locationId: "foreign-site" }), /accounting_location_invalid/);
});
for (const role of ["staff", "customer"]) test(`${role} is denied before any Accounting or Daily Close query`, async () => {
  const h = harness({ role });
  await assert.rejects(h.accounting(), /ROLE_DENIED/); await assert.rejects(h.daily(), /ROLE_DENIED/);
  assert.equal(h.clients(), 0); assert.equal(h.calls.length, 0);
});
