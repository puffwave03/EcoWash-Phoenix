import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { readDailyCloseSnapshot } from "../src/features/daily-close/snapshot.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const panelPath = "src/components/daily-close/DailyCloseClosePanel.tsx";
const workflowPath = "src/components/daily-close/DailyCloseWorkflow.tsx";
const pagePath = "src/app/[locale]/app/(dashboard)/daily-close/page.tsx";

test("1 not-closed state exposes a deliberate close-day action", async () => {
  const panel = await source(panelPath);
  assert.match(panel, /!confirmationOpen \? <>[\s\S]*text\.closeAction/);
  assert.match(panel, /onClick=\{openConfirmation\}/);
});

test("2 persisted close state prominently identifies the closed day", async () => {
  const workflow = await source(workflowPath);
  assert.match(workflow, /function PersistedSummary/);
  assert.match(workflow, /text\.closed/);
  assert.match(workflow, /text\.closedDescription/);
});

test("3 already-closed state cannot render a second active close panel", async () => {
  const workflow = await source(workflowPath);
  assert.match(workflow, /if \(persistedClose\) return <PersistedSummary/);
  assert.match(workflow, /return <DailyCloseClosePanel/);
});

test("4 obvious preview blockers prevent entry and confirmation", async () => {
  const [panel, workflow] = await Promise.all([source(panelPath), source(workflowPath)]);
  assert.match(workflow, /ready: data\.complete && blockers\.length === 0/);
  assert.match(panel, /if \(!preview\.ready\) return/);
  assert.match(panel, /disabled=\{!preview\.ready\}/);
  assert.match(panel, /disabled=\{isPending \|\| !preview\.ready/);
});

test("5 authoritative RPC blockers remain visible without losing confirmation state", async () => {
  const panel = await source(panelPath);
  assert.match(panel, /result\.blockers\.length/);
  assert.match(panel, /setServerBlockers\(result\.blockers\.map/);
  assert.match(panel, /aria-live="polite"[\s\S]*serverBlockers/);
  assert.doesNotMatch(panel, /setNote\(""\)/);
});

test("6 preview warnings are displayed but do not determine readiness", async () => {
  const [panel, workflow, query] = await Promise.all([
    source(panelPath),
    source(workflowPath),
    source("src/features/daily-close/server/queries.ts"),
  ]);
  assert.match(panel, /preview\.warnings\.length \? <IssueList/);
  assert.match(workflow, /ready: data\.complete && blockers\.length === 0/);
  assert.doesNotMatch(workflow, /ready:[^\n]*warnings/);
  assert.match(workflow, /add\("cash_variance", data\.cashVarianceSessions\)/);
  assert.match(workflow, /add\("non_session_non_cash_activity", data\.nonSessionNonCashActivity\)/);
  assert.match(query, /row\.method !== "cash" && row\.pos_session_id === null/);
});

test("7 warnings require explicit acknowledgement before submission", async () => {
  const panel = await source(panelPath);
  assert.match(panel, /warningAcknowledgementRequired = preview\.warnings\.length > 0/);
  assert.match(panel, /warningAcknowledgementRequired && !acknowledged/);
  assert.match(panel, /type="checkbox"/);
  assert.match(panel, /text\.acknowledgeWarnings/);
});

test("8 a no-warning close has no acknowledgement control", async () => {
  const panel = await source(panelPath);
  assert.match(panel, /warningAcknowledgementRequired \? <label[\s\S]*type="checkbox"[\s\S]*: null/);
});

test("9 optional note is retained and submitted to the canonical action", async () => {
  const panel = await source(panelPath);
  assert.match(panel, /maxLength=\{1000\}/);
  assert.match(panel, /onChange=\{\(event\) => setNote\(event\.target\.value\)\}/);
  assert.match(panel, /locationId: preview\.locationId,[\s\S]*note,/);
});

test("10 synchronous lock and transition state prevent double submit", async () => {
  const panel = await source(panelPath);
  assert.match(panel, /submissionLocked = useRef\(false\)/);
  assert.match(panel, /isPending[\s\S]*submissionLocked\.current/);
  assert.match(panel, /submissionLocked\.current = true/);
  assert.match(panel, /disabled=\{isPending/);
});

test("11 one UUID is reused throughout the same close attempt", async () => {
  const panel = await source(panelPath);
  assert.match(panel, /idempotencyKey = useRef<string \| null>\(null\)/);
  assert.match(panel, /idempotencyKey\.current = crypto\.randomUUID\(\)/);
  assert.match(panel, /idempotencyKey: idempotencyKey\.current as string/);
});

test("12 idempotent existing result is a successful completed outcome", async () => {
  const panel = await source(panelPath);
  assert.match(panel, /result\.status === "created" \|\| result\.status === "existing"/);
  assert.match(panel, /setCompleted\(true\)/);
});

test("13 successful close refreshes into persisted server state", async () => {
  const [panel, page] = await Promise.all([source(panelPath), source(pagePath)]);
  assert.match(panel, /router\.refresh\(\)/);
  assert.match(page, /getPersistedDailyClose\(locale/);
  assert.match(page, /persistedClose=\{persistedClose\}/);
});

test("14 persisted summary reads the saved snapshot, not preview totals", async () => {
  const workflow = await source(workflowPath);
  const persisted = workflow.slice(workflow.indexOf("function PersistedSummary"), workflow.indexOf("function previewWarnings"));
  assert.match(persisted, /readDailyCloseSnapshot\(close\.snapshot\)/);
  assert.match(persisted, /snapshot\.ordersCreated/);
  assert.match(persisted, /snapshot\.payments\.map/);
  assert.doesNotMatch(persisted, /data\.(orders|payments|pos|logistics)/);
});

test("15 saved snapshot normalization remains independent from later live-preview changes", () => {
  const saved = {
    finalFulfillment: { completedOrderCount: 4 },
    logistics: { completedDeliveryIds: ["delivery"], completedPickupIds: ["pickup"], deliveriesDueOpen: 2, inProgress: 1, pickupsDueOpen: 3 },
    orders: { created: 7, productionCompleted: 5 },
    payments: [{ collectedNet: 90, confirmedPaymentCount: 1, currency: "EUR", refundCount: 1, refunds: 10 }],
    pos: { countedCash: 100, currency: "EUR", expectedCash: 100, variance: 0 },
    warnings: [{ code: "open_production", count: 2 }],
  };
  assert.deepEqual(readDailyCloseSnapshot(saved), {
    finalFulfillmentCompleted: 4,
    logistics: { completedDeliveries: 1, completedPickups: 1, deliveriesDueOpen: 2, inProgress: 1, pickupsDueOpen: 3 },
    ordersCreated: 7,
    payments: [{ collectedNet: 90, confirmedPaymentCount: 1, currency: "EUR", refundCount: 1, refunds: 10 }],
    pos: { countedCash: 100, currency: "EUR", expectedCash: 100, variance: 0 },
    productionCompleted: 5,
    warnings: [{ code: "open_production", count: 2 }],
  });
});

test("16 location-specific scope is preserved through read and close", async () => {
  const [page, panel] = await Promise.all([source(pagePath), source(panelPath)]);
  assert.match(page, /locationId: data\.selectedLocationId/);
  assert.match(panel, /locationId: preview\.locationId/);
});

test("17 organization-wide scope remains canonical null", async () => {
  const [workflow, validation] = await Promise.all([
    source(workflowPath),
    source("src/features/daily-close/validation.ts"),
  ]);
  assert.match(workflow, /if \(!locationId\) return allLocations/);
  assert.match(validation, /locationId: rawLocationId \|\| null/);
});

test("18 Owner is authorized through the existing P2A guard", async () => {
  const role = await source("src/lib/auth/require-role.ts");
  assert.match(role, /requireOwnerOrManager[\s\S]*\["owner", "manager"\]/);
});

test("19 Manager is authorized through the existing P2A guard", async () => {
  const [action, query] = await Promise.all([
    source("src/features/daily-close/server/actions.ts"),
    source("src/features/daily-close/server/persisted-queries.ts"),
  ]);
  assert.match(action, /requireOwnerOrManager\(locale\)/);
  assert.match(query, /requireOwnerOrManager\(locale\)/);
});

test("20 Staff remains denied before Daily Close workflow rendering", async () => {
  const page = await source(pagePath);
  assert.match(page, /membership\.role === "staff"[\s\S]*app\/access-denied/);
});

test("21 narrow-screen controls stack, fill width, and remain touch-sized", async () => {
  const panel = await source(panelPath);
  assert.match(panel, /flex flex-col-reverse gap-3 sm:flex-row/);
  assert.equal((panel.match(/className="w-full sm:w-auto"/g) ?? []).length, 3);
  assert.match(panel, /min-h-12 items-start/);
  assert.match(panel, /min-h-28 w-full resize-y/);
  assert.match(panel, /overflow-hidden/);
});

test("22 desktop confirmation and summaries use responsive grids", async () => {
  const [panel, workflow] = await Promise.all([source(panelPath), source(workflowPath)]);
  assert.match(panel, /sm:grid-cols-3/);
  assert.match(panel, /sm:flex-row sm:justify-end/);
  assert.match(workflow, /lg:grid-cols-4/);
  assert.match(workflow, /lg:grid-cols-5/);
});

test("23 all five locales have identical definitive-close key topology", async () => {
  const locales = ["en", "it", "es", "fr", "de"];
  const messages = await Promise.all(locales.map(async (locale) => JSON.parse(await source(`src/i18n/${locale}/common.json`)).dailyClose.definitive));
  const keys = (value) => Object.keys(value).sort();
  for (const message of messages) {
    assert.deepEqual(keys(message), keys(messages[0]));
    assert.deepEqual(keys(message.labels), keys(messages[0].labels));
    assert.deepEqual(keys(message.errors), keys(messages[0].errors));
    assert.deepEqual(keys(message.serverBlockers), keys(messages[0].serverBlockers));
    assert.deepEqual(keys(message.warningLabels), keys(messages[0].warningLabels));
  }
});

test("24 P1 preview sections and filters remain present", async () => {
  const dashboard = await source("src/components/daily-close/DailyCloseDashboard.tsx");
  for (const section of ["business-day", "orders", "payments", "pos", "logistics", "attention"]) {
    assert.match(dashboard, new RegExp(`daily-close-${section}`));
  }
  assert.match(dashboard, /name="date"/);
  assert.match(dashboard, /name="location"/);
});

test("25 P2B adds no database migration or financial mutation", async () => {
  const [panel, workflow, migrations] = await Promise.all([
    source(panelPath),
    source(workflowPath),
    readdir(new URL("../supabase/migrations", import.meta.url)),
  ]);
  assert.equal(migrations.some((name) => /p2b/i.test(name)), false);
  assert.doesNotMatch(`${panel}\n${workflow}`, /record_pos_payment|record_pos_refund|payments\.(insert|update|delete)/);
});

test("26 P2B adds no lifecycle mutation and calls only the approved close action", async () => {
  const [panel, page] = await Promise.all([source(panelPath), source(pagePath)]);
  assert.doesNotMatch(`${panel}\n${page}`, /transition_order_status|complete_customer_handoff|complete_pickup|complete_delivery/);
  assert.match(page, /requestDailyCloseAction\.bind\(null, locale\)/);
});
