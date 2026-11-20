import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadPreviewModule, previewProps, previewHtml } from "../scripts/preview-billing-simplified-ticket.mjs";

const require = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const { unpaidTicketData } = loadPreviewModule("src/features/printing/unpaid-ticket.ts");
const { parseTicketSettings } = loadPreviewModule("src/features/printing/ticket-settings.ts");
const { OperationalOrderTicket, BillingSimplifiedTicket } = loadPreviewModule("src/components/billing/BillingSimplifiedTicket.tsx");
const render = (component, props) => renderToStaticMarkup(createElement(component, props));
const plain = (html) => html.replace(/<style>[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
function context(tenant = "A") {
  return {
    organizationName: `Tenant ${tenant}`, timezone: "Atlantic/Canary", quickDropFinancialState: null,
    branding: { brand: { name: `Tenant ${tenant}`, logoPath: `https://example.invalid/${tenant}.png` }, support: { address: "Stored address", email: null, phone: null } },
    order: { id: `order-${tenant}`, orderNumber: `${tenant}-001`, customerName: `Customer ${tenant}`, isActive: true,
      productionStatus: "received", dueAt: "2026-11-20T10:00:00Z", currency: "EUR", subtotal: 14, discountAmount: 1, total: 13 },
    items: [{ id: "line", description: "Stored service", quantity: 2, unitType: "piece", unitPrice: 7, lineTotal: 14 }],
    payments: [], paymentSummary: { totalDue: 13, totalPaid: 0, balanceDue: 13, paymentStatus: "unpaid" },
    logistics: { pickup: null, delivery: { status: "scheduled", scheduledAt: "2026-11-21T17:30:00Z" } },
  };
}
function operational(c = context(), footer = "First line\nSecond line") {
  const ticket = unpaidTicketData(c);
  assert.ok(ticket);
  return render(OperationalOrderTicket, { data: ticket.data, locale: "es", timeZone: c.timezone,
    presentation: { branding: { logoPath: c.branding.brand.logoPath, logoUrl: c.branding.brand.logoPath },
      serviceConditions: footer, scheduleByOrder: { [c.order.id]: ticket.schedule }, payment: { paidAmount: 0, outstandingAmount: 13 } } });
}
test("unpaid operational paper reuses the fiscal layout, stored amounts and no fiscal identity/number", () => {
  const html = operational(), text = plain(html);
  for (const label of ["TICKET OPERATIVO · NO FISCAL", "Pedido: A-001", "Customer A", "Stored service", "Subtotal 14,00", "Dto. 1,00", "TOTAL 13,00", "Pagado 0,00", "Pendiente 13,00"]) assert.ok(text.includes(label), label);
  assert.match(html, /data-fiscal-issued="false"/);
  assert.match(html, /size:80mm/);
  assert.doesNotMatch(text, /FACTURA SIMPLIFICADA|Serie:|Fecha de emisión|NIF|Base imponible|BORRADOR/);
  assert.equal((html.match(/<table /g) ?? []).length, 1);
});
test("work readiness and actual delivery/pickup appointments stay distinct; absent/cancelled appointments are absent", () => {
  const c = context(), text = plain(operational(c));
  assert.match(text, /Trabajo previsto listo:.*20 nov 2026, 10:00/);
  assert.match(text, /Entrega prevista:.*21 nov 2026, 17:30/);
  assert.doesNotMatch(text, /Recogida prevista/);
  c.logistics.delivery.status = "cancelled";
  assert.doesNotMatch(plain(operational(c)), /Entrega prevista/);
  c.logistics.pickup = { status: "scheduled", scheduledAt: "2026-11-22T11:00:00Z" };
  assert.match(plain(operational(c)), /Recogida prevista:.*22 nov 2026, 11:00/);
});
test("partial/paid/refunded/unpriced/cancelled/inconsistent orders cannot use the unpaid paper", () => {
  for (const mutate of [
    c => { c.payments.push({ status: "confirmed", amount: 5 }); },
    c => { c.paymentSummary.totalPaid = 5; }, c => { c.paymentSummary.paymentStatus = "paid"; },
    c => { c.payments.push({ status: "confirmed", amount: 13 }, { status: "refunded", amount: 13 }); },
    c => { c.quickDropFinancialState = "unpriced"; }, c => { c.order.productionStatus = "cancelled"; },
    c => { c.order.isActive = false; }, c => { c.items = []; }, c => { c.paymentSummary.balanceDue = 12; },
    c => { c.order.total = NaN; },
  ]) { const c = context(); mutate(c); assert.equal(unpaidTicketData(c), null); }
});
test("tenant footer/logo/customer are isolated, multiline escaped text, optional and no mutation on reprint", () => {
  const a = context("A"), b = context("B"), before = JSON.stringify(a);
  const html = operational(a, '<script>alert(1)</script>\nNext line');
  assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script>/);
  assert.match(html, /white-space:pre-wrap/);
  assert.ok(html.indexOf('<footer') > html.indexOf('simplified-operational"'));
  assert.doesNotMatch(operational(b, "Tenant B note"), /Customer A|A\.png|alert\(1\)/);
  assert.doesNotMatch(operational(a, " \n"), /<footer/);
  assert.equal(operational(a), operational(a)); assert.equal(JSON.stringify(a), before);
});
test("settings normalize an explicitly supplied series; never invent one or accept oversized/invalid input", () => {
  assert.equal(parseTicketSettings("", "").simplifiedSeries, null);
  assert.equal(parseTicketSettings("a\nb", " lab-s ").simplifiedSeries, "LAB-S");
  assert.equal(parseTicketSettings("a\nb", "lab").footer, "a\nb");
  for (const value of ["BAD/1", "more-than-twelve", "<script>"]) assert.equal(parseTicketSettings("", value), null);
  assert.equal(parseTicketSettings("x".repeat(4001), "S"), null);
});
function compiled(source, mocks) {
  const m = { exports: {} };
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText,
    { module: m, exports: m.exports, require: name => {
      if (name in mocks) return mocks[name];
      if (name.startsWith("@/")) return loadPreviewModule(`src/${name.slice(2)}.ts`);
      if (name === "./simplified-ticket-copy") return loadPreviewModule("src/components/billing/simplified-ticket-copy.ts");
      return require(name);
    } });
  return m.exports;
}
test("historical issued fiscal paper stays identical to approved 78e877f, without new footer or appointments", () => {
  const original = compiled(execFileSync("git", ["show", "78e877f:src/components/billing/BillingSimplifiedTicket.tsx"], { encoding: "utf8" }), {});
  for (const scenario of ["walkin", "named", "tenant-b"]) {
    const props = previewProps(scenario);
    props.document.fiscalUseAllowed = true;
    Object.assign(props.document.document, { status: "issued", number: "2026-S-000001", issuedAt: "2026-11-19T12:00:00Z" });
    delete props.demonstration; delete props.presentation.serviceConditions; delete props.presentation.pickupByOrder;
    assert.equal(render(BillingSimplifiedTicket, props), render(original.BillingSimplifiedTicket, props));
  }
});
test("new fiscal paper uses frozen presentation supplied by Billing, amounts and invoice identity unchanged", () => {
  const props = previewProps("named"); delete props.presentation.serviceConditions;
  props.document.presentation = { serviceConditions: "Stored conditions\nStored second line", scheduleByOrder: {
    [props.document.orders[0].id]: { readyAt: "2026-11-20T10:00:00Z", pickupAt: null, deliveryAt: "2026-11-21T12:00:00Z" },
  } };
  const before = JSON.stringify(props.document), html = render(BillingSimplifiedTicket, props);
  assert.match(html, /Stored conditions\nStored second line/);
  assert.match(plain(html), /Trabajo previsto listo:.*Entrega prevista:/);
  assert.match(plain(html), /Base imponible 12,15.*IGIC \(7%\) 0,85.*TOTAL 13,00/);
  assert.equal(JSON.stringify(props.document), before);
  props.document.fiscalUseAllowed = true;
  Object.assign(props.document.document, { status: "issued", number: "2026-S-000001", issuedAt: "2026-11-19T12:00:00Z" });
  delete props.demonstration;
  props.presentation.serviceConditions = "Later tenant configuration";
  assert.match(render(BillingSimplifiedTicket, props), /Stored conditions/);
  assert.doesNotMatch(render(BillingSimplifiedTicket, props), /Later tenant configuration/);
});
test("save action derives organization server-side and rejects Manager/Staff before RPC", async () => {
  let role = "owner", rpcCalls = [], reads = [];
  const access = { membership: { organization: { id: "tenant-A" } } };
  const mocks = { "server-only": {}, "next/cache": { revalidatePath() {} },
    "@/lib/auth/require-role": { async requireOwner() { assert.equal(role, "owner"); return access; } },
    "@/features/entitlements/server/resolver": { async hasEntitlement() { return true; } },
    "@/lib/supabase/server": { async createSupabaseServerClient() { return {
      async rpc(...args) { rpcCalls.push(args); return { error: null }; },
      from(table) { return { select() { return this; }, eq(field, id) { reads.push([table, field, id]); return this; },
        async single() { return { data: { ticket_footer: "A note" } }; }, async maybeSingle() { return { data: { simplified_series: "A-S" } }; } }; },
    }; } },
    "../ticket-settings": loadPreviewModule("src/features/printing/ticket-settings.ts"),
  };
  const { saveTicketSettingsAction } = compiled(read("src/features/printing/server/ticket-settings-actions.ts"), mocks);
  const form = new FormData(); form.set("intent", "footer"); form.set("footer", "A note\nline 2"); form.set("simplifiedSeries", "a-s"); form.set("organization_id", "tenant-B");
  assert.equal(await saveTicketSettingsAction("es", "idle", form), "saved");
  assert.deepEqual(JSON.parse(JSON.stringify(rpcCalls)), [["update_current_ticket_settings", { target_footer: "A note\nline 2", target_simplified_series: null, target_update_series: false }]]);
  const queries = compiled(read("src/features/printing/server/ticket-settings.ts"), mocks);
  assert.equal((await queries.getOwnerTicketSettings("es")).footer, "A note");
  assert.deepEqual(reads, [["organizations", "id", "tenant-A"], ["organization_billing_settings", "organization_id", "tenant-A"]]);
  for (role of ["manager", "staff"]) await assert.rejects(saveTicketSettingsAction("es", "idle", form));
  assert.equal(rpcCalls.length, 1);
});
test("operational route has only reads and canonical print access, receipt links keep their previous default", () => {
  const route = read("src/app/[locale]/app/(dashboard)/orders/[orderId]/print/unpaid/page.tsx");
  assert.match(route, /requirePrintAccess/); assert.match(route, /membership.organization.id/);
  assert.doesNotMatch(route, /\.rpc\(|issueOperationalReceipt|issueBilling|\.insert\(|\.update\(/);
  const actions = read("src/components/printing/PrintOrderActions.tsx");
  assert.match(actions, /unpaid = false/); assert.match(actions, /unpaid \? .*print\/unpaid.* : .*print\/receipt/);
});
test("Owner without Billing saves footer independently of a hidden configured series; forged series actions are denied", async () => {
  let entitled = false, reads = [], rpcCalls = [], billingError = null;
  const mocks = {
    "server-only": {}, "next/cache": { revalidatePath() {} },
    "@/features/entitlements/server/resolver": { async hasEntitlement() { return entitled; } },
    "@/lib/auth/require-role": { async requireOwner() { return { membership: { organization: { id: "tenant-A" } } }; } },
    "@/lib/supabase/server": { async createSupabaseServerClient() { return {
      async rpc(...args) { rpcCalls.push(args); return { error: null }; },
      from(table) { reads.push(table); return { select() { return this; }, eq(field, id) {
        assert.equal(id, "tenant-A"); assert.equal(field, table === "organizations" ? "id" : "organization_id"); return this;
      }, async single() { return { data: { ticket_footer: "Existing footer" }, error: null }; },
      async maybeSingle() { return { data: billingError ? null : { simplified_series: "STORED-S" }, error: billingError }; } }; },
    }; } },
    "../ticket-settings": loadPreviewModule("src/features/printing/ticket-settings.ts"),
  };
  const { getOwnerTicketSettings } = compiled(read("src/features/printing/server/ticket-settings.ts"), mocks);
  const { saveTicketSettingsAction } = compiled(read("src/features/printing/server/ticket-settings-actions.ts"), mocks);
  const hidden = await getOwnerTicketSettings("es");
  assert.equal(hidden.canEditSeries, false); assert.equal(hidden.footer, "Existing footer");
  assert.deepEqual(reads, ["organizations"]); // No read of the hidden Billing row.
  const form = new FormData(); form.set("intent", "footer"); form.set("footer", "Changed footer");
  form.set("simplifiedSeries", "BAD/IGNORED"); form.set("organization_id", "tenant-B");
  assert.equal(await saveTicketSettingsAction("es", "idle", form), "saved");
  assert.deepEqual(JSON.parse(JSON.stringify(rpcCalls)), [["update_current_ticket_settings", {
    target_footer: "Changed footer", target_simplified_series: null, target_update_series: false,
  }]]);
  form.set("intent", "series");
  for (const value of ["", "NEW-S", "STORED-S"]) {
    form.set("simplifiedSeries", value);
    assert.equal(await saveTicketSettingsAction("es", "idle", form), "error");
  }
  assert.equal(rpcCalls.length, 1);
  entitled = true;
  const visible = await getOwnerTicketSettings("es");
  assert.equal(visible.canEditSeries, true); assert.equal(visible.simplifiedSeries, "STORED-S");
  form.set("simplifiedSeries", "new-s");
  assert.equal(await saveTicketSettingsAction("es", "idle", form), "saved");
  assert.deepEqual(JSON.parse(JSON.stringify(rpcCalls[1][1])), { target_footer: null, target_simplified_series: "NEW-S", target_update_series: true });
  billingError = { code: "42501" };
  const unavailable = await getOwnerTicketSettings("es");
  assert.equal(unavailable.canEditSeries, false); assert.equal(unavailable.footer, "Existing footer");
  form.delete("intent");
  assert.equal(await saveTicketSettingsAction("es", "idle", form), "error");
  assert.equal(rpcCalls.length, 2);
});
test("footer and series have separate forms, and the series form is absent without permission", () => {
  const { TicketSettingsForm } = compiled(read("src/components/printing/TicketSettingsForm.tsx"), {
    "@/components/Button": { Button: ({ children, ...props }) => createElement("button", props, children) },
  });
  const base = { locale: "es", action: async () => "saved" };
  const hidden = render(TicketSettingsForm, { ...base, settings: { footer: "Existing footer", simplifiedSeries: null, canEditSeries: false } });
  assert.match(hidden, /name="footer"/); assert.doesNotMatch(hidden, /name="simplifiedSeries"/);
  const visible = render(TicketSettingsForm, { ...base, settings: { footer: "Existing footer", simplifiedSeries: "STORED-S", canEditSeries: true } });
  const forms = visible.match(/<form[\s\S]*?<\/form>/g);
  assert.equal(forms.length, 3);
  assert.match(forms[0], /value="footer"/); assert.doesNotMatch(forms[0], /name="simplifiedSeries"/);
  assert.match(forms[1], /value="specialMessage"/); assert.match(forms[1], /name="ticket_special_message"/);
  assert.match(forms[2], /value="series"/); assert.doesNotMatch(forms[2], /name="footer"/);
});
test("operational route executes canonical access checks, scopes footer to membership and never creates a receipt", async () => {
  let tenant = "A", allowed = true, calls = [];
  const mocks = {
    "@/components/billing/BillingSimplifiedTicket": { OperationalOrderTicket },
    "@/components/printing/PrintButton": { PrintButton: () => createElement("button", null, "Print") },
    "next-intl/server": { async getTranslations() { return () => "Print"; } },
    "@/features/printing/server/access": { async requirePrintAccess() { assert.ok(allowed, "PRINT_ACCESS_DENIED"); return { membership: { organization: { id: tenant } } }; } },
    "@/features/printing/server/queries": { async getPrintOrderContext(_locale, orderId) {
      assert.equal(orderId, `order-${tenant}`, "FOREIGN_ORDER"); return context(tenant);
    } },
    "@/lib/supabase/server": { async createSupabaseServerClient() { return {
      from(table) { calls.push(table); return { select() { return this; }, eq(field, id) { assert.equal(field, "id"); assert.equal(id, tenant); return this; },
        async single() { return { data: { ticket_footer: `Only ${tenant} footer` }, error: null }; } }; },
    }; } },
    "@/features/printing/unpaid-ticket": { unpaidTicketData },
    "@/features/printing/ticket-settings": loadPreviewModule("src/features/printing/ticket-settings.ts"),
  };
  const page = compiled(read("src/app/[locale]/app/(dashboard)/orders/[orderId]/print/unpaid/page.tsx"), mocks).default;
  for (tenant of ["A", "B"]) {
    const html = renderToStaticMarkup(await page({ params: Promise.resolve({ locale: "es", orderId: `order-${tenant}` }) }));
    assert.match(html, new RegExp(`Only ${tenant} footer`));
    assert.doesNotMatch(html, new RegExp(`Customer ${tenant === "A" ? "B" : "A"}`));
  }
  await assert.rejects(page({ params: Promise.resolve({ locale: "es", orderId: "order-A" }) }), /FOREIGN_ORDER/);
  allowed = false;
  await assert.rejects(page({ params: Promise.resolve({ locale: "es", orderId: "order-B" }) }), /PRINT_ACCESS_DENIED/);
  assert.deepEqual(calls, ["organizations", "organizations"]);
});

test("existing isolated preview offers unpaid examples without a fiscal number, identity or tax summary", () => {
  const html = previewHtml("unpaid-long");
  const paper = plain(html.slice(html.indexOf('data-fiscal-issued="false"')));
  assert.match(paper, /TICKET OPERATIVO · NO FISCAL.*Pedido: DEMO-EW-001/);
  assert.doesNotMatch(paper, /NIF DE EJEMPLO|FACTURA SIMPLIFICADA|EJEMPLO-DEMO-S-000001|Base imponible/);
});
