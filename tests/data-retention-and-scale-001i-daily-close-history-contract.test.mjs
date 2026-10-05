import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DAILY_CLOSE_HISTORY_PAGE_SIZE,
  dailyCloseHistoryFilterKey,
  dailyCloseHistoryHref,
  dailyCloseHistoryKeyset,
  dailyCloseHistoryPage,
  decodeDailyCloseHistoryCursor,
  encodeDailyCloseHistoryCursor,
  normalizeDailyCloseHistoryFilters,
} from "../src/features/daily-close/pagination.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const query = await source("src/features/daily-close/server/persisted-queries.ts");
const page = await source("src/app/[locale]/app/(dashboard)/daily-close/history/page.tsx");
const detail = await source("src/app/[locale]/app/(dashboard)/daily-close/history/[closeId]/page.tsx");
const sql = await source("supabase/migrations/20261005000100_data_retention_scale_001i_daily_close_history_scalability.sql");
const history = query.slice(query.indexOf("export async function listPersistedDailyCloses"), query.indexOf("export async function getPersistedDailyCloseById"));
const uuid = (n) => `${String(n).padStart(8, "0")}-1111-4111-8111-111111111111`;
const token = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const filters = normalizeDailyCloseHistoryFilters({ businessDate: "2026-10-05", locationId: uuid(1).toUpperCase() });
const position = { businessDate: "2026-10-05", closedAt: "2026-10-05T12:00:00.123456+00:00", id: uuid(1) };

test("cursor has only navigation fields, binds normalized date/scope, and rejects malformed values", () => {
  assert.deepEqual(filters, { businessDate: "2026-10-05", locationId: uuid(1) });
  assert.equal(dailyCloseHistoryFilterKey(filters), JSON.stringify(["2026-10-05", uuid(1)]));
  const raw = encodeDailyCloseHistoryCursor(position, "older", filters);
  const value = JSON.parse(Buffer.from(raw, "base64url"));
  assert.deepEqual(value, { v: 1, ...position, direction: "older", filterKey: dailyCloseHistoryFilterKey(filters) });
  assert.deepEqual(decodeDailyCloseHistoryCursor(raw, filters), { ...position, direction: "older" });
  assert.equal(decodeDailyCloseHistoryCursor(raw, { ...filters, businessDate: "2026-10-04" }), null);
  assert.equal(decodeDailyCloseHistoryCursor(raw, { ...filters, locationId: "organization" }), null);
  for (const invalid of ["!", `${raw}=`, "a".repeat(8193), token(null), token([]),
    token({ ...value, organizationId: uuid(2) }), token({ ...value, v: 2 }),
    token({ ...value, direction: "sideways" }), token({ ...value, id: "bad" }),
    token({ ...value, businessDate: "2026-02-30" }), token({ ...value, closedAt: "2026-02-30T12:00:00Z" })]) {
    assert.equal(decodeDailyCloseHistoryCursor(invalid, filters), null);
  }
  assert.deepEqual(normalizeDailyCloseHistoryFilters({ businessDate: "2026-02-30", locationId: "bad" }), { businessDate: undefined, locationId: undefined });
});

test("full three-column keyset traverses over 100 closes and reverses without duplicate rows", () => {
  assert.equal(DAILY_CLOSE_HISTORY_PAGE_SIZE, 25);
  const rows = Array.from({ length: 137 }, (_, index) => ({
    businessDate: `2026-10-${String(5 - Math.floor(index / 50)).padStart(2, "0")}`,
    closedAt: `2026-10-05T12:00:0${4 - Math.floor(index % 50 / 10)}Z`,
    id: uuid(137 - index),
  }));
  const compare = (a, b) => b.businessDate.localeCompare(a.businessDate)
    || b.closedAt.localeCompare(a.closedAt) || b.id.localeCompare(a.id);
  rows.sort(compare);
  let cursor = null;
  let secondPage;
  const found = [];
  do {
    const selected = rows.filter((row) => !cursor || compare(row, cursor) > 0).slice(0, 26);
    const result = dailyCloseHistoryPage(selected, cursor, filters);
    assert.ok(result.items.length <= 25);
    found.push(...result.items);
    if (cursor && !secondPage) secondPage = result;
    cursor = decodeDailyCloseHistoryCursor(result.olderCursor ?? undefined, filters);
  } while (cursor);
  assert.deepEqual(found, rows);
  const backCursor = decodeDailyCloseHistoryCursor(secondPage.newerCursor, filters);
  const back = dailyCloseHistoryPage(rows.filter((row) => compare(row, backCursor) < 0).reverse().slice(0, 26), backCursor, filters);
  assert.deepEqual(back.items, rows.slice(0, 25));
  assert.equal(back.newerCursor, null);
  assert.ok(back.olderCursor);
  assert.equal(dailyCloseHistoryKeyset({ ...position, direction: "older" }),
    `business_date.lt.${position.businessDate},and(business_date.eq.${position.businessDate},closed_at.lt.${position.closedAt}),and(business_date.eq.${position.businessDate},closed_at.eq.${position.closedAt},id.lt.${position.id})`);
  assert.match(dailyCloseHistoryKeyset({ ...position, direction: "newer" }), /business_date\.gt\.[^,]+,and\([^)]*closed_at\.gt\.[^)]*\),and\([^)]*id\.gt\./);
});

test("history query filters before a 26-row keyset limit and keeps persisted facts", () => {
  assert.match(history, /requireOwnerOrManager\(locale\)/);
  assert.match(history, /\.eq\("organization_id", membership\.organization\.id\)/);
  assert.match(history, /\.eq\("business_date", normalized\.businessDate\)/);
  assert.match(history, /\.is\("location_id", null\)/);
  assert.match(history, /\.eq\("location_id", normalized\.locationId\)/);
  assert.ok(history.indexOf('query.or(dailyCloseHistoryKeyset(cursor))') < history.indexOf('.limit(DAILY_CLOSE_HISTORY_PAGE_SIZE + 1)'));
  assert.match(history, /\.order\("business_date", \{ ascending \}\)\s*\.order\("closed_at", \{ ascending \}\)\s*\.order\("id", \{ ascending \}\)/);
  assert.match(history, /const ascending = cursor\?\.direction === "newer"/);
  assert.match(history, /if \(!rows\.length && cursor\)[\s\S]*cursor = null/);
  assert.doesNotMatch(history, /\.limit\(100\)|\.limit\(500\)|\.range\(|\.offset\(/);
  for (const field of ["businessDate", "closeNote", "closedAt", "id", "locationId", "locationName", "snapshotHash", "tenantTimezone"]) assert.match(history, new RegExp(`${field}:`));
});

test("history links preserve filters while Back to latest clears only cursor", () => {
  assert.equal(dailyCloseHistoryHref(filters, "abc"), `/app/daily-close/history?date=2026-10-05&scope=${uuid(1)}&cursor=abc`);
  assert.equal(dailyCloseHistoryHref(filters), `/app/daily-close/history?date=2026-10-05&scope=${uuid(1)}`);
  assert.equal(dailyCloseHistoryHref({}), "/app/daily-close/history");
  assert.match(page, /listPersistedDailyCloses\(locale, filters, query\.cursor\)/);
  assert.match(page, /history\.pagination\.olderCursor/);
  assert.match(page, /history\.pagination\.newerCursor/);
  assert.match(page, /query\.cursor \? <Link[\s\S]*dailyCloseHistoryHref\(filters\)/);
  assert.doesNotMatch(page, /name="cursor"/);
  assert.match(page, /href=\{`\/app\/daily-close\/history\/\$\{close\.id\}`\}/);
});

test("complete persisted scope discovery is tenant-bound and only the read RPC is callable", () => {
  assert.match(history, /\.rpc\("list_daily_close_history_scopes"\)/);
  assert.doesNotMatch(history, /\.limit\(500\)|new Map/);
  assert.match(history, /scopes\.scopes\.sort\(\(a, b\) => a\.name\.localeCompare\(b\.name\)\)/);
  assert.match(sql, /create function public\.list_daily_close_history_scopes\(\)\s*returns jsonb\s*language plpgsql stable security definer set search_path = public/);
  assert.match(sql, /app_current_organization_id\(\)/);
  assert.match(sql, /has_organization_role\(org_id, array\['owner', 'manager'\]::public\.app_role\[\]\)/);
  assert.match(sql, /select distinct d\.location_id[\s\S]*from public\.daily_closes d[\s\S]*d\.organization_id = org_id/);
  assert.match(sql, /d\.location_id is null/);
  assert.match(sql, /join public\.locations l on l\.organization_id = org_id and l\.id = p\.location_id/);
  assert.match(sql, /jsonb_agg\([\s\S]*order by l\.name, l\.id\)/);
  assert.match(sql, /revoke all on function public\.list_daily_close_history_scopes\(\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.list_daily_close_history_scopes\(\) to authenticated/);
  assert.equal((sql.match(/^create function /gm) ?? []).length, 1);
  assert.equal((sql.match(/^create index /gm) ?? []).length, 2);
  assert.match(sql, /create index daily_closes_org_history_keyset_idx\s+on public\.daily_closes \(organization_id, business_date desc, closed_at desc, id desc\)/);
  assert.match(sql, /create index daily_closes_org_location_history_keyset_idx\s+on public\.daily_closes \(organization_id, location_id, business_date desc, closed_at desc, id desc\)/);
  assert.doesNotMatch(sql, /\b(?:insert|update|delete|alter table|drop|create trigger|create policy|close_daily_close|calculate_daily_close_snapshot)\b/i);
});

test("history detail and saved snapshot remain read-only; five locales expose navigation", async () => {
  assert.match(detail, /getPersistedDailyCloseById\(locale, closeId\)/);
  assert.match(detail, /<PersistedSummary/);
  assert.doesNotMatch(detail + history, /getDailyCloseData|calculate_daily_close_snapshot|close_daily_close|\.insert\(|\.update\(|\.delete\(/);
  const messages = await Promise.all(["it", "es", "en", "fr", "de"].map(async (locale) => JSON.parse(await source(`src/i18n/${locale}/common.json`)).dailyClose.history));
  for (const message of messages) for (const key of ["navigation", "older", "newer", "latest"]) assert.ok(message[key]);
});
