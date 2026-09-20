import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildDailyCloseExportRows,
  createDailyClosePdf,
  serializeDailyCloseCsv,
} from "../src/features/daily-close/export.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const detailPath = "src/app/[locale]/app/(dashboard)/daily-close/history/[closeId]/page.tsx";
const csvRoutePath = "src/app/[locale]/app/(dashboard)/daily-close/history/[closeId]/export/csv/route.ts";
const pdfRoutePath = "src/app/[locale]/app/(dashboard)/daily-close/history/[closeId]/export/pdf/route.ts";

const close = {
  businessDate: "2026-09-20",
  businessDayEndExclusive: "2026-09-21T00:00:00Z",
  businessDayStart: "2026-09-20T00:00:00Z",
  calculationVersion: "test",
  closeNote: "Verified close",
  closedAt: "2026-09-20T20:00:00Z",
  closedBy: "11111111-1111-4111-8111-111111111111",
  createdAt: "2026-09-20T20:00:00Z",
  id: "22222222-2222-4222-8222-222222222222",
  locationId: null,
  locationName: null,
  organizationId: "33333333-3333-4333-8333-333333333333",
  requestFingerprint: "fingerprint",
  snapshot: {
    blockers: [],
    finalFulfillment: { completedOrderCount: 4 },
    logistics: { completedDeliveryIds: ["delivery"], completedPickupIds: ["pickup"], deliveriesDueOpen: 2, inProgress: 1, overdueDeliveries: 0, overduePickups: 1, pickupsDueOpen: 3 },
    orders: { created: 7, productionCompleted: 5 },
    payments: [{ bankTransferCollected: 0, cardCollected: 30, cashCollected: 60, collectedGross: 90, collectedNet: 80, confirmedPaymentCount: 2, currency: "EUR", discountTotal: 5, onlineCollected: 0, orderCount: 7, otherCollected: 0, outstanding: 20, outstandingOrderCount: 1, refunds: 10, salesGross: 105, salesNet: 100 }],
    pos: { cashPaymentsWithoutValidSession: 0, closedSessions: 1, countedCash: 100, currency: "EUR", expectedCash: 100, openSessions: 0, openingCash: 10, sessionCount: 1, variance: 0 },
    warnings: [{ code: "open_production", count: 2 }],
  },
  snapshotHash: "hash",
  snapshotSchemaVersion: 1,
  tenantTimezone: "Atlantic/Canary",
};

const rows = buildDailyCloseExportRows(close, "All locations");

test("1 export model is deterministic and sourced from persisted metadata and snapshot", () => {
  assert.deepEqual(rows.slice(0, 7).map((row) => row.key), ["report_type", "business_date", "scope", "closed_at", "closed_by", "close_note", "snapshot_hash"]);
  assert.ok(rows.some((row) => row.section === "operational" && row.key === "orders_created" && row.value === 7));
  assert.ok(rows.some((row) => row.section === "accounting" && row.key === "salesNet" && row.currency === "EUR" && row.value === 100));
  assert.ok(rows.some((row) => row.section === "pos" && row.key === "variance" && row.value === 0));
  assert.ok(rows.some((row) => row.section === "logistics" && row.key === "completedDeliveryIds" && row.value === 1));
  assert.ok(rows.some((row) => row.section === "warnings" && row.key === "open_production" && row.value === 2));
});

test("2 CSV is flat, deterministic and protects spreadsheet formula values", () => {
  const first = serializeDailyCloseCsv(rows);
  const second = serializeDailyCloseCsv(rows);
  assert.equal(first, second);
  assert.match(first, /^"section","key","currency","value"\r\n/);
  assert.match(first, /"accounting","salesNet","EUR","100"/);
  assert.match(serializeDailyCloseCsv([{ currency: "", key: "note", section: "metadata", value: "=unsafe" }]), /"'=unsafe"/);
});

test("3 PDF writer produces a downloadable multi-section PDF without a dependency", () => {
  const pdf = createDailyClosePdf(rows, "en", {
    labels: {},
    nonFiscal: "Internal operational report - non-fiscal",
    page: "Page",
    reportTitle: "Daily Close",
    sections: { accounting: "Accounting", blockers: "Blockers", logistics: "Logistics", metadata: "Details", operational: "Operations", pos: "POS", warnings: "Warnings" },
    snapshotUnavailable: "Snapshot unavailable",
  });
  const binary = Buffer.from(pdf).toString("latin1");
  assert.ok(binary.startsWith("%PDF-1.4"));
  assert.ok(binary.endsWith("%%EOF\n"));
  assert.match(binary, /Internal operational report - non-fiscal/);
  assert.match(binary, /\/Type \/Catalog/);
});

test("4 PDF and CSV routes retain tenant-scoped persisted-close access", async () => {
  const [pdfRoute, csvRoute, query] = await Promise.all([source(pdfRoutePath), source(csvRoutePath), source("src/features/daily-close/server/persisted-queries.ts")]);
  for (const route of [pdfRoute, csvRoute]) assert.match(route, /getPersistedDailyCloseById\(locale, closeId\)/);
  assert.match(pdfRoute, /"Content-Type": "application\/pdf"/);
  assert.match(csvRoute, /"Content-Type": "text\/csv; charset=utf-8"/);
  assert.match(query, /getPersistedDailyCloseById[\s\S]*\.eq\("organization_id", membership\.organization\.id\)[\s\S]*\.eq\("id", closeId\)/);
});

test("5 print action uses the persisted detail and print-only layout", async () => {
  const [actions, detail, styles] = await Promise.all([
    source("src/components/daily-close/DailyCloseExportActions.tsx"),
    source(detailPath),
    source("src/styles/globals.css"),
  ]);
  assert.match(actions, /onClick=\{\(\) => window\.print\(\)\}/);
  assert.match(detail, /daily-close-print-document/);
  assert.match(detail, /<PersistedSummary/);
  assert.match(styles, /body:has\(\.daily-close-print-document\)/);
});

test("6 exports never call live Daily Close calculation or mutate data", async () => {
  const files = await Promise.all([source(pdfRoutePath), source(csvRoutePath), source(detailPath), source("src/features/daily-close/export.ts")]);
  const combined = files.join("\n");
  assert.doesNotMatch(combined, /getDailyCloseData|calculate_daily_close_snapshot|requestDailyCloseAction/);
  assert.doesNotMatch(combined, /\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
});

test("7 five locales expose identical export labels", async () => {
  const locales = ["en", "it", "es", "fr", "de"];
  const values = await Promise.all(locales.map(async (locale) => JSON.parse(await source(`src/i18n/${locale}/common.json`)).dailyClose.export));
  const topology = (value) => JSON.stringify({ root: Object.keys(value).sort(), accounting: Object.keys(value.accountingLabels).sort(), sections: Object.keys(value.sections).sort() });
  for (const value of values) assert.equal(topology(value), topology(values[0]));
});

test("8 export adds no PDF package or database migration", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  for (const dependency of ["jspdf", "pdfkit", "@react-pdf/renderer", "puppeteer"]) assert.equal(dependencies[dependency], undefined);
  assert.equal((await source("src/features/daily-close/export.ts")).includes("daily_closes"), false);
});
