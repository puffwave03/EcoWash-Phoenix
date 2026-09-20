import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const listPagePath = "src/app/[locale]/app/(dashboard)/daily-close/history/page.tsx";
const detailPagePath = "src/app/[locale]/app/(dashboard)/daily-close/history/[closeId]/page.tsx";
const queryPath = "src/features/daily-close/server/persisted-queries.ts";

test("1 history list reads only persisted daily closes with bounded ordering", async () => {
  const query = await source(queryPath);
  const history = query.slice(query.indexOf("export async function listPersistedDailyCloses"), query.indexOf("export async function getPersistedDailyCloseById"));
  assert.match(history, /from\("daily_closes"\)/g);
  assert.match(history, /order\("business_date", \{ ascending: false \}\)/);
  assert.match(history, /\.limit\(100\)/);
  assert.doesNotMatch(history, /getDailyCloseData|calculate_daily_close_snapshot|\.rpc\(/);
});

test("2 history filters use business date and persisted location scope", async () => {
  const query = await source(queryPath);
  assert.match(query, /filters\.businessDate[\s\S]*\.eq\("business_date", filters\.businessDate\)/);
  assert.match(query, /filters\.locationId === "organization"[\s\S]*\.is\("location_id", null\)/);
  assert.match(query, /\.eq\("location_id", filters\.locationId\)/);
});

test("3 detail lookup is tenant isolated and opens one persisted close", async () => {
  const query = await source(queryPath);
  const detail = query.slice(query.indexOf("export async function getPersistedDailyCloseById"));
  assert.match(detail, /requireOwnerOrManager\(locale\)/);
  assert.match(detail, /\.eq\("organization_id", membership\.organization\.id\)/);
  assert.match(detail, /\.eq\("id", closeId\)/);
  assert.match(detail, /\.maybeSingle<DailyCloseDetailRow>\(\)/);
});

test("4 detail renders the saved snapshot and never requests live Daily Close data", async () => {
  const [detailPage, workflow] = await Promise.all([
    source(detailPagePath),
    source("src/components/daily-close/DailyCloseWorkflow.tsx"),
  ]);
  const persisted = workflow.slice(workflow.indexOf("export function PersistedSummary"), workflow.indexOf("function previewWarnings"));
  assert.match(detailPage, /getPersistedDailyCloseById\(locale, closeId\)/);
  assert.match(detailPage, /<PersistedSummary/);
  assert.match(persisted, /readDailyCloseSnapshot\(close\.snapshot\)/);
  assert.doesNotMatch(detailPage + persisted, /getDailyCloseData|calculate_daily_close_snapshot/);
});

test("5 location and organization-wide scopes are displayed from persisted rows", async () => {
  const [query, listPage, detailPage] = await Promise.all([
    source(queryPath),
    source(listPagePath),
    source(detailPagePath),
  ]);
  assert.match(query, /location:locations!daily_closes_location_same_org\(name\)/);
  assert.match(listPage, /close\.locationName \?\? t\("organizationWide"\)/);
  assert.match(detailPage, /close\.locationName \?\? t\("history\.organizationWide"\)/);
});

test("6 history remains read-only while exposing export and print actions", async () => {
  const [query, listPage, detailPage] = await Promise.all([
    source(queryPath),
    source(listPagePath),
    source(detailPagePath),
  ]);
  const historySource = `${query.slice(query.indexOf("export async function listPersistedDailyCloses"))}\n${listPage}\n${detailPage}`;
  assert.doesNotMatch(historySource, /\.insert\(|\.update\(|\.delete\(|\.rpc\(|requestDailyCloseAction/);
  assert.doesNotMatch(historySource, /reopen|deleteAction/i);
});

test("7 list and detail navigation remain responsive on mobile and desktop", async () => {
  const [dashboard, listPage, detailPage, exportActions] = await Promise.all([
    source("src/components/daily-close/DailyCloseDashboard.tsx"),
    source(listPagePath),
    source(detailPagePath),
    source("src/components/daily-close/DailyCloseExportActions.tsx"),
  ]);
  assert.match(dashboard, /href="\/app\/daily-close\/history"/);
  assert.match(listPage, /md:grid-cols-\[1fr_1fr_auto\]/);
  assert.match(listPage, /sm:grid-cols-\[1fr_1fr_auto\]/);
  assert.ok((listPage.match(/w-full[^"]*sm:w-auto/g) ?? []).length >= 2);
  assert.match(detailPage, /<DailyCloseExportActions/);
  assert.match(exportActions, /w-full[^"]*sm:w-auto/);
});

test("8 all five locales expose identical minimal history keys", async () => {
  const locales = ["en", "it", "es", "fr", "de"];
  const messages = await Promise.all(locales.map(async (locale) => JSON.parse(await source(`src/i18n/${locale}/common.json`)).dailyClose.history));
  const keys = Object.keys(messages[0]).sort();
  for (const message of messages) {
    assert.deepEqual(Object.keys(message).sort(), keys);
    for (const value of Object.values(message)) assert.equal(typeof value, "string");
  }
});
