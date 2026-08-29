import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createLabelCode, createOrderCode, parsePhoenixCode } from "../src/features/barcode/payload.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const orderId = "11111111-1111-4111-8111-111111111111";
const itemId = "22222222-2222-4222-8222-222222222222";
const migrationPath = "supabase/migrations/20260829000500_barcode_001_reference_entitlement.sql";

test("1 versioned order payload round-trips without business or tenant data", () => {
  const code = createOrderCode(orderId.toUpperCase());
  assert.equal(code, `PHX1:O:${orderId}`);
  assert.deepEqual(parsePhoenixCode(code), { kind: "order", orderId });
  assert.doesNotMatch(code, /customer|tenant|price|payment|@/i);
});

test("2 versioned label payload round-trips with canonical item and unit reference", () => {
  const code = createLabelCode(orderId, itemId, 3);
  assert.equal(code, `PHX1:L:${orderId}:${itemId}:3`);
  assert.deepEqual(parsePhoenixCode(code), { itemId, kind: "label", orderId, unitIndex: 3 });
  assert.notEqual(code, createLabelCode(orderId, itemId, 2));
  assert.notEqual(createOrderCode(orderId), createOrderCode("33333333-3333-4333-8333-333333333333"));
});

test("3 parser is strict, whitespace-tolerant and rejects unversioned or malformed input", () => {
  assert.deepEqual(parsePhoenixCode(`  ${createOrderCode(orderId)}\n`), { kind: "order", orderId });
  for (const code of ["", orderId, `PHX2:O:${orderId}`, `PHX1:L:${orderId}:${itemId}:-1`, `PHX1:O:${orderId}:extra`]) {
    assert.equal(parsePhoenixCode(code), null);
  }
});

test("4 print label identity follows discrete-unit and continuous-line semantics", async () => {
  const labels = await source("src/features/printing/labels.ts");
  assert.match(labels, /isDiscreteServiceUnit\(item\.unitType\) \? copyIndex \+ 1 : 0/);
  assert.match(labels, /createLabelCode\(context\.order\.id, label\.itemId, label\.unitIndex\)/);
  assert.doesNotMatch(labels, /garment|tracking/i);
});

test("5 the shared renderer creates an accessible standards-based QR SVG", async () => {
  const renderer = await source("src/components/barcode/ScannableQrCode.tsx");
  assert.match(renderer, /QRCode\.create\(payload, \{ errorCorrectionLevel: "M" \}\)/);
  assert.match(renderer, /role="img"/);
  assert.match(renderer, /aria-label=\{ariaLabel\}/);
  assert.match(renderer, /QUIET_ZONE = 4/);
  assert.doesNotMatch(renderer, /dangerouslySetInnerHTML|canvas/);
});

test("6 PRINT replaces the reserved area and puts scannable codes on ticket and labels", async () => {
  const document = await source("src/components/printing/OrderPrintDocument.tsx");
  assert.match(document, /createOrderCode\(context\.order\.id\)/);
  assert.match(document, /payload=\{label\.codePayload\}/);
  assert.doesNotMatch(document, /print-code-area/);
});

test("7 resolver rechecks terminal access, barcode entitlement and tenant ownership", async () => {
  const actions = await source("src/features/shop-terminal/server/actions.ts");
  assert.match(actions, /requireShopTerminalAccess\(locale\)/);
  assert.match(actions, /requireEntitlement\(locale, FEATURES\.barcode\)/);
  assert.match(actions, /from\("orders"\)[\s\S]*eq\("organization_id", membership\.organization\.id\)[\s\S]*eq\("id", parsed\.orderId\)/);
});

test("8 label resolution verifies the canonical active item and unit boundary", async () => {
  const actions = await source("src/features/shop-terminal/server/actions.ts");
  assert.match(actions, /from\("order_items"\)/);
  assert.match(actions, /eq\("order_id", order\.id\)/);
  assert.match(actions, /eq\("id", parsed\.itemId\)/);
  assert.match(actions, /eq\("is_active", true\)/);
  assert.match(actions, /parsed\.unitIndex <= Math\.max\(1, Math\.trunc\(Number\(item\.quantity\)\)\)/);
});

test("9 safe misses do not reveal cross-tenant order or item details", async () => {
  const actions = await source("src/features/shop-terminal/server/actions.ts");
  const resolver = actions.slice(actions.indexOf("export async function resolveShopCodeAction"), actions.indexOf("export async function loadShopServicesAction"));
  assert.match(resolver, /error: "not_found", orderId: null, orderNumber: null/g);
  assert.doesNotMatch(resolver, /customer|price|payment|organizationName/);
});

test("10 Terminal provides a compact keyboard-wedge and manual-submit workflow", async () => {
  const workspace = await source("src/components/shop-terminal/ShopTerminalWorkspace.tsx");
  assert.match(workspace, /<form[\s\S]*onSubmit=\{resolveCode\}/);
  assert.match(workspace, /actions\.resolveCode\(raw\)/);
  assert.match(workspace, /router\.push\(`\/app\/orders\/\$\{result\.orderId\}`\)/);
  assert.match(workspace, /aria-live="polite"/);
  assert.doesNotMatch(workspace, /getUserMedia|camera|BarcodeDetector/);
});

test("11 barcode UI is entitlement-gated and all supported locales are complete", async () => {
  const page = await source("src/app/[locale]/app/(dashboard)/shop/page.tsx");
  assert.match(page, /FEATURES\.barcode/);
  assert.match(page, /canScan=\{entitlementEnabled\(entitlements, FEATURES\.barcode\)\}/);
  for (const locale of ["it", "en", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.equal(Object.keys(messages.barcode.terminal).length, 6);
    assert.equal(Object.keys(messages.barcode.print).length, 3);
  }
});

test("12 migration is additive entitlement-only and creates no parallel barcode schema", async () => {
  const sql = await source(migrationPath);
  assert.match(sql, /insert into public\.organization_entitlements/);
  assert.match(sql, /'barcode'/);
  assert.match(sql, /where organization\.slug = 'ecowash-la-tejita'/);
  assert.doesNotMatch(sql, /\b(update|delete|truncate|drop|alter table|create table)\b/i);
  const migrations = await source(migrationPath);
  assert.doesNotMatch(migrations, /barcode_(identit|event|scan)|garment/i);
});
