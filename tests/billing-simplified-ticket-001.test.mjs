import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadPreviewModule, previewHtml, previewProps } from "../scripts/preview-billing-simplified-ticket.mjs";

const { BillingSimplifiedTicket } = loadPreviewModule("src/components/billing/BillingSimplifiedTicket.tsx");
const { simplifiedTicketCopy } = loadPreviewModule("src/components/billing/simplified-ticket-copy.ts");
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const text = (html) => html.replace(/<style>[\s\S]*?<\/style>/g, "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
function freeze(value) {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function render(props) {
  const before = JSON.stringify(props);
  const result = renderToStaticMarkup(createElement(BillingSimplifiedTicket, freeze(props)));
  assert.equal(JSON.stringify(props), before, "Rendering must not mutate any snapshot or operational data");
  return result;
}

test("synthetic ticket shows exact issuer, number, series, date, services and stored inclusive amounts", () => {
  const props = previewProps();
  const html = render(props), plain = text(html);
  for (const value of ["FACTURA SIMPLIFICADA", props.document.issuer.legalName, props.document.issuer.taxId,
    props.document.issuer.addressLine1, props.demonstration.number, props.document.document.series,
    "18 nov 2026, 12:34", "camisa", "2 ud.", "1,5 kg", "4,00", "1,00", "7,00", "6,00",
    "Base imponible 12,15", "IGIC (7%) 0,85", "TOTAL 13,00"]) assert.ok(plain.includes(value), value);
  assert.match(html, /<img[^>]*class="print-brand-logo"/);
  assert.match(html, /data-fiscal-issued="false"/);
  assert.match(plain, /DEMOSTRACIÓN · DATOS SINTÉTICOS/);
  assert.doesNotMatch(plain, /DOCUMENTO INCOMPLETO|fiscalmente no válido|notFiscal|documento fiscalmente non valido/);
});

test("shared walk-in is only a visual label; no fiscal identity is added to the document", () => {
  const props = previewProps();
  assert.equal(props.document.recipient, null);
  assert.match(text(render(props)), /Cliente sin identificar/);
  assert.equal(props.document.recipient, null);
  assert.equal(props.document.document.number, null);
  assert.equal(props.document.document.issuedAt, null);
});

test("named recipient preserves actual supplied name, NIF and address instead of the walk-in label", () => {
  const html = text(render(previewProps("named")));
  assert.match(html, /Cliente de ejemplo/);
  assert.match(html, /NIF CLIENTE DE EJEMPLO/);
  assert.match(html, /Calle de Prueba, 20/);
  assert.doesNotMatch(html, /Cliente sin identificar/);
});

test("an omitted recipient without shared-walk-in provenance is incomplete and never labelled unidentified", () => {
  const props = previewProps();
  delete props.presentation.isSharedWalkIn;
  const html = render(props);
  assert.match(text(html), /DOCUMENTO INCOMPLETO.*Tipo de destinatario/);
  assert.doesNotMatch(text(html), /Cliente sin identificar/);
});

for (const key of ["legalName", "taxId", "addressLine1", "city", "postalCode", "countryCode"]) {
  test(`missing required issuer ${key} is visibly incomplete without a fabricated replacement`, () => {
    const props = previewProps();
    props.document.issuer[key] = null;
    const html = render(props);
    assert.match(html, /role="alert"/);
    assert.match(text(html), /DOCUMENTO INCOMPLETO/);
    assert.match(html, /data-fiscal-issued="false"/);
    assert.equal(props.document.issuer[key], null);
  });
}

test("real draft cannot borrow a demo number or date and remains visibly incomplete", () => {
  const props = previewProps();
  delete props.demonstration;
  const html = render(props), plain = text(html);
  assert.match(plain, /BORRADOR.*DOCUMENTO INCOMPLETO.*Número.*Fecha de emisión/);
  assert.doesNotMatch(plain, /EJEMPLO-DEMO-S-000001/);
  assert.equal(props.document.document.number, null);
});

test("issued or otherwise incompatible inputs cannot render a fiscal article", () => {
  for (const mutate of [
    (props) => { props.document.document.status = "issued"; },
    (props) => { props.document.document.number = "REAL-123"; },
    (props) => { props.document.fiscalUseAllowed = true; },
  ]) {
    const props = previewProps(); mutate(props);
    const html = render(props);
    assert.match(text(html), /DOCUMENTO INCOMPLETO/);
    assert.doesNotMatch(html, /<article/);
    assert.doesNotMatch(html, /REAL-123/);
  }
});

test("payment and pickup are separate operational data and never change fiscal amounts", () => {
  const props = previewProps();
  props.presentation.payment = { paidAmount: 5, outstandingAmount: 8, methodLabel: "Tarjeta" };
  const html = render(props);
  const fiscal = text(html.match(/<article[\s\S]*?<\/article>/)[0]);
  const operational = text(html.slice(html.indexOf('class="simplified-operational"')));
  assert.match(fiscal, /TOTAL 13,00/);
  assert.doesNotMatch(fiscal, /Pagado|Pendiente|Tarjeta|Recogida/);
  assert.match(operational, /Pagado 5,00.*Pendiente 8,00.*Tarjeta.*DEMO-EW-001.*20 nov 2026, 17:30/);
});

test("absent payment/pickup data do not become a zero payment or an invented pickup date", () => {
  const props = previewProps();
  delete props.presentation.payment; delete props.presentation.pickupByOrder;
  const html = text(render(props));
  assert.match(html, /Pagado No disponible.*Pendiente No disponible/);
  assert.doesNotMatch(html, /Recogida prevista|Efectivo/);
});

test("display values come directly from Billing without tax calculations or rounded-unit reconstruction", () => {
  const props = previewProps();
  Object.assign(props.document.tax, { taxableBase: 10.01, amount: 2.99, rate: 9.5 });
  props.document.items[0].unitPrice = .93;
  props.document.items[0].taxableBase = 2.80;
  const plain = text(render(props));
  assert.match(plain, /Base imponible 10,01.*IGIC \(9,5%\) 2,99.*TOTAL 13,00/);
  assert.match(plain, /0,93/);
});

test("repeated rendering and long untrusted descriptions remain escaped and have no side effects", () => {
  const props = previewProps("long");
  props.document.items[0].description += " <script>alert('x')</script>";
  const first = render(props);
  assert.equal(render(props), first);
  assert.match(first, /&lt;script&gt;/);
  assert.doesNotMatch(first, /<script>/);
  assert.match(first, /overflow-wrap:anywhere/);
});

test("missing amounts, services and invalid dates are signalled without silently showing zero", () => {
  const props = previewProps();
  props.document.tax.amount = NaN;
  props.document.items = [];
  props.demonstration.issuedAt = "not-a-date";
  const html = text(render(props));
  assert.match(html, /DOCUMENTO INCOMPLETO.*Fecha de emisión.*Servicios e importes/);
  assert.match(html, /IGIC \(7%\) —/);
});

test("a missing currency is incomplete and cannot crash rendering or invent a currency", () => {
  const props = previewProps();
  props.document.totals.currency = "";
  const plain = text(render(props));
  assert.match(plain, /DOCUMENTO INCOMPLETO.*Servicios e importes/);
  assert.match(plain, /TOTAL —/);
});

for (const locale of ["es", "it", "en", "fr", "de"]) test(`${locale}: labels are complete and print status stays outside fiscal content`, () => {
  const html = render(previewProps("walkin", locale));
  assert.deepEqual(Object.keys(simplifiedTicketCopy[locale]).sort(), Object.keys(simplifiedTicketCopy.es).sort());
  assert.match(text(html), /FACTURA SIMPLIFICADA/);
  assert.ok(text(html).includes(simplifiedTicketCopy[locale].demo));
  const fiscal = html.match(/<article[\s\S]*?<\/article>/)[0];
  assert.ok(!fiscal.includes(simplifiedTicketCopy[locale].demo));
  assert.doesNotMatch(html, /common\.billing\.|undefined/);
});

test("preview remains an explicit loopback script with no app route, business imports or emission control", () => {
  const script = read("scripts/preview-billing-simplified-ticket.mjs");
  assert.match(script, /listen\(4180, "127\.0\.0\.1"/);
  const html = previewHtml();
  assert.match(html, /window\.print\(\)/);
  assert.match(text(html), /ejemplos sintéticos/);
  assert.doesNotMatch(script, /require\(["']dotenv|createSupabase|\.rpc\(|fetch\(/);
  assert.doesNotMatch(read("src/components/billing/BillingSimplifiedTicket.tsx"), /server\/actions|createSupabase|\.rpc\(|fetch\(|Math\.round/);
});

test("80mm named print page, intact demo state, repeated column headings and unsplit service groups are scoped", () => {
  const html = render(previewProps());
  assert.match(html, /@page billing-simplified-ticket \{ size:80mm 297mm; margin:3mm; \}/);
  assert.match(html, /\.billing-simplified-ticket thead \{ display:table-header-group/);
  assert.match(html, /\.billing-simplified-ticket tbody \{ break-inside:avoid/);
  assert.doesNotMatch(html, /\.simplified-state\s*\{[^}]*display:none/);
  assert.equal((html.match(/scope="col"/g) ?? []).length, 4);
  assert.equal((html.match(/<tbody>/g) ?? []).length, 2);
});

test("tenant logos follow the persisted Billing issuer path without a Phoenix fallback", () => {
  for (const scenario of ["walkin", "tenant-b"]) {
    const props = previewProps(scenario);
    const html = render(props);
    assert.ok(html.includes(props.presentation.branding.logoUrl));
    assert.ok(text(html).includes(props.document.issuer.legalName));
    assert.doesNotMatch(html, /Phoenix_by_EcoWash/);
  }
  const props = previewProps();
  props.presentation.branding = previewProps("tenant-b").presentation.branding;
  const html = render(props);
  assert.doesNotMatch(html, /<img\b/);
  assert.ok(text(html).includes(props.document.issuer.legalName));
});

test("missing issuer logo, URL or branding uses only the issuer's text heading", () => {
  for (const change of [
    (props) => { props.document.issuer.logoPath = null; },
    (props) => { props.presentation.branding.logoUrl = null; },
    (props) => { delete props.presentation.branding; },
  ]) {
    const props = previewProps(); change(props);
    const html = render(props);
    assert.doesNotMatch(html, /<img\b/);
    assert.ok(html.includes(`<h1>${props.document.issuer.legalName}</h1>`));
  }
});

test("optional service conditions are the last section, retain newlines and never create an empty footer", () => {
  const props = previewProps();
  props.presentation.serviceConditions = "Prima riga di esempio.\nSeconda riga di esempio.";
  const html = render(props);
  assert.ok(html.includes(props.presentation.serviceConditions));
  assert.ok(html.indexOf('class="simplified-terms"') > html.indexOf('class="simplified-operational"'));
  assert.match(html, /white-space:pre-wrap/);
  for (const value of [undefined, null, "", " \n\t"]) {
    const empty = previewProps(); empty.presentation.serviceConditions = value;
    assert.doesNotMatch(render(empty), /<footer\b/);
  }
});

test("service conditions are escaped text and cannot introduce arbitrary HTML", () => {
  const props = previewProps();
  props.presentation.serviceConditions = '<script>alert(1)</script>\n<img src="x" onerror="alert(2)">';
  const html = render(props);
  const footer = html.match(/<footer[\s\S]*?<\/footer>/)[0];
  assert.match(footer, /&lt;script&gt;/);
  assert.match(footer, /&lt;img/);
  assert.doesNotMatch(footer, /<script|<img/);
});

test("changing the service note cannot change the fiscal rendering or activate issuance", () => {
  const first = previewProps(); first.presentation.serviceConditions = "Nota A";
  const second = previewProps(); second.presentation.serviceConditions = "Nota B\nSeconda riga";
  const firstHtml = render(first), secondHtml = render(second);
  const fiscal = (html) => html.match(/<article[\s\S]*?<\/article>/)[0];
  assert.equal(fiscal(firstHtml), fiscal(secondHtml));
  assert.deepEqual(first.document, second.document);
  assert.match(firstHtml, /data-fiscal-issued="false"/);
  assert.match(secondHtml, /data-fiscal-issued="false"/);
});

test("fiscal content, operations and the optional note share one compact print sheet", () => {
  const html = render(previewProps());
  assert.equal((html.match(/class="[^"]*simplified-paper"/g) ?? []).length, 1);
  assert.match(html, /max-height:14mm; max-width:42mm/);
  assert.match(html, /object-fit:contain/);
  assert.match(html, /class="simplified-fiscal"/);
  assert.match(html, /class="simplified-operational"/);
  assert.match(html, /class="simplified-terms"/);
  assert.match(html, /font-size:17px; font-weight:bold/);
});
