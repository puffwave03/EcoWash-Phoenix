import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  decodePosPaymentCursor,
  decodePosSessionCursor,
  encodePosPaymentCursor,
  encodePosSessionCursor,
  paginatePosRows,
  posCursorBoundary,
  posHistoryHref,
  POS_HISTORY_PAGE_SIZE,
} from "../src/features/pos/pagination.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const sessionId = "11111111-1111-4111-8111-111111111111";
const otherSessionId = "22222222-2222-4222-8222-222222222222";
const position = { timestamp: "2026-10-04T10:30:00.123Z", id: "33333333-3333-4333-8333-333333333333" };
const token = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

test("001F cursors use strict versioned shapes without tenant identity", () => {
  const sessionCursor = encodePosSessionCursor(position, "older");
  const paymentCursor = encodePosPaymentCursor(position, "newer", sessionId);
  assert.deepEqual(JSON.parse(Buffer.from(sessionCursor, "base64url").toString()), {
    v: 1, openedAt: position.timestamp, id: position.id, direction: "older",
  });
  assert.deepEqual(JSON.parse(Buffer.from(paymentCursor, "base64url").toString()), {
    v: 1, createdAt: position.timestamp, id: position.id, direction: "newer", sessionId,
  });
  assert.deepEqual(decodePosSessionCursor(sessionCursor), { ...position, direction: "older" });
  assert.deepEqual(decodePosPaymentCursor(paymentCursor, sessionId), { ...position, direction: "newer", sessionId });
  assert.equal(decodePosPaymentCursor(paymentCursor, otherSessionId), null);
  assert.equal(decodePosSessionCursor(paymentCursor), null);
  assert.equal(decodePosPaymentCursor(sessionCursor, sessionId), null);
});

test("001F malformed, altered and invalid-time cursors reset to latest", () => {
  for (const value of [undefined, "!!!", "a".repeat(513), token({ v: 2, openedAt: position.timestamp, id: position.id, direction: "older" }),
    token({ v: 1, openedAt: "2026-02-30T10:30:00Z", id: position.id, direction: "older" }),
    token({ v: 1, openedAt: position.timestamp, id: "not-a-uuid", direction: "older" }),
    token({ v: 1, openedAt: position.timestamp, id: position.id, direction: "sideways" }),
    token({ v: 1, openedAt: position.timestamp, id: position.id, direction: "older", organizationId: sessionId })]) {
    assert.equal(decodePosSessionCursor(value), null);
  }
  assert.equal(decodePosPaymentCursor(token({ v: 1, createdAt: position.timestamp, id: position.id, direction: "older", sessionId, organizationId: otherSessionId }), sessionId), null);
});

test("001F tuple boundaries and sentinel pagination preserve newest-first display", () => {
  assert.equal(POS_HISTORY_PAGE_SIZE, 25);
  assert.equal(posCursorBoundary("opened_at", { ...position, direction: "older" }),
    `opened_at.lt.${position.timestamp},and(opened_at.eq.${position.timestamp},id.lt.${position.id})`);
  assert.equal(posCursorBoundary("created_at", { ...position, direction: "newer" }),
    `created_at.gt.${position.timestamp},and(created_at.eq.${position.timestamp},id.gt.${position.id})`);
  const rows = Array.from({ length: 26 }, (_, i) => ({ id: `${String(i + 1).padStart(8, "0")}-1111-4111-8111-111111111111`, created_at: `2026-10-04T10:${String(59 - i).padStart(2, "0")}:00Z` }));
  const latest = paginatePosRows(rows, null, (row) => row.created_at, encodePosSessionCursor);
  assert.equal(latest.items.length, 25);
  assert.equal(latest.items[0].id, rows[0].id);
  assert.equal(latest.pagination.newerCursor, null);
  assert.ok(latest.pagination.olderCursor);
  const newer = paginatePosRows([...rows].reverse(), { ...position, direction: "newer" }, (row) => row.created_at, encodePosSessionCursor);
  assert.equal(newer.items.length, 25);
  assert.equal(newer.items[0].id, rows[1].id);
  assert.ok(newer.pagination.newerCursor);
  assert.ok(newer.pagination.olderCursor);
});

test("001F independent POS URLs retain q and the other history cursor", () => {
  const paymentCursor = encodePosPaymentCursor(position, "older", sessionId);
  const historyCursor = encodePosSessionCursor(position, "older");
  const both = new URL(posHistoryHref("cliente", paymentCursor, historyCursor), "https://example.test");
  assert.equal(both.searchParams.get("q"), "cliente");
  assert.equal(both.searchParams.get("paymentCursor"), paymentCursor);
  assert.equal(both.searchParams.get("historyCursor"), historyCursor);
  assert.equal(new URL(posHistoryHref("cliente", null, historyCursor), both).searchParams.get("historyCursor"), historyCursor);
  assert.equal(new URL(posHistoryHref("cliente", paymentCursor, null), both).searchParams.get("paymentCursor"), paymentCursor);
});

test("001F both queries filter and order before the 26-row limit without offset", async () => {
  const queries = await source("src/features/pos/server/queries.ts");
  const payments = queries.slice(queries.indexOf("export async function listPosSessionPayments"), queries.indexOf("export async function listPosSessionHistory"));
  const history = queries.slice(queries.indexOf("export async function listPosSessionHistory"), queries.indexOf("export async function listPosLocations"));
  for (const [body, column] of [[payments, "created_at"], [history, "opened_at"]]) {
    assert.match(body, /requirePosAccess\(locale\)/);
    assert.match(body, /eq\("organization_id", membership\.organization\.id\)/);
    assert.match(body, new RegExp(`order\\("${column}", \\{ ascending \\}\\)\\.order\\("id", \\{ ascending \\}\\)`));
    assert.match(body, new RegExp(`posCursorBoundary\\("${column}", cursor\\)`));
    assert.match(body, /limit\(POS_HISTORY_PAGE_SIZE \+ 1\)/);
    assert.doesNotMatch(body, /\.range\(|\.offset\(|limit\(100\)|limit\(25\)/);
  }
  assert.match(payments, /eq\("pos_session_id", sessionId\)/);
  assert.match(payments, /paginatePosRows\(data \?\? \[\], cursor, \(row\) => row\.created_at/);
  assert.match(history, /membership\.role === "staff"\) return \{ items: \[\]/);
  assert.match(history, /paginatePosRows\(data \?\? \[\], cursor, \(row\) => row\.opened_at/);
});

test("001F page and UI retain independent navigation while summary and refund stay canonical", async () => {
  const [page, ui, queries] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/pos/page.tsx"),
    source("src/components/pos/PosWorkspace.tsx"),
    source("src/features/pos/server/queries.ts"),
  ]);
  assert.match(page, /decodePosSessionCursor\(historyCursorInput\)/);
  assert.match(page, /decodePosPaymentCursor\(paymentCursorInput, session\.id\)/);
  assert.match(page, /historyCursor \? historyCursorInput/);
  assert.match(page, /paymentCursor \? paymentCursorInput/);
  assert.match(page, /getPosSessionSummary\(locale, session\.id\)/);
  assert.match(queries, /rpc\("get_pos_session_summary", \{ target_session_id: sessionId \}\)/);
  assert.match(page, /canSeeHistory = access\.membership\.role !== "staff"/);
  assert.match(ui, /<RefundForm action=\{actions\.refund\} payment=\{payment\} sessionId=\{session\.id\}/);
  assert.match(ui, /name="paymentCursor" type="hidden"/);
  assert.match(ui, /name="historyCursor" type="hidden"/);
  assert.match(ui, /<PaginationNav navigation=\{paymentNavigation\}/);
  assert.match(ui, /<PaginationNav navigation=\{historyNavigation\}/);
});

test("001F migration adds only the two approved indexes and all locales provide controls", async () => {
  const sql = await source("supabase/migrations/20261004000100_data_retention_scale_001f_pos_payment_history_pagination.sql");
  assert.equal((sql.match(/create index /g) ?? []).length, 2);
  assert.match(sql, /on public\.pos_sessions \(organization_id, opened_at desc, id desc\)/);
  assert.match(sql, /on public\.payments \(organization_id, pos_session_id, created_at desc, id desc\)[\s\S]*where pos_session_id is not null/);
  assert.doesNotMatch(sql, /alter table|create function|drop |update |delete |insert |policy|rls|rpc/i);
  for (const locale of ["it", "es", "en", "fr", "de"]) {
    const labels = JSON.parse(await source(`src/i18n/${locale}/common.json`)).pos.pagination;
    for (const key of ["navigation", "older", "newer", "latest"]) assert.ok(labels[key]);
  }
});
