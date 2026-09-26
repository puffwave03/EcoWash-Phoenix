import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const prior = "supabase/migrations/20260913000200_order_final_handoff_001.sql";
const current = "supabase/migrations/20260926000100_final_fulfillment_storage_exit.sql";

function rpc(sql, name, next) {
  const start = sql.search(new RegExp(`create(?: or replace)? function public\\.${name}\\(`));
  assert.ok(start >= 0, `${name} missing`);
  const end = next ? sql.search(new RegExp(`create(?: or replace)? function public\\.${next}\\(`)) : sql.length;
  assert.ok(end > start);
  return sql.slice(start, end).trim();
}

const handoffDelete = `  delete from public.order_storage
  where organization_id = org_id
    and order_id = target_order_id;

`;
const deliveryDelete = `

  if target_status = 'completed' then
    delete from public.order_storage
    where organization_id = org_id
      and order_id = parent_order_id;
  end if;`;

test("handoff exits storage only after canonical insert, in the same RPC", async () => {
  const sql = await source(current);
  const body = rpc(sql, "complete_customer_handoff", "transition_delivery_status");
  assert.match(body, /security definer\s+set search_path = public/);
  assert.ok(body.indexOf("returning * into canonical_handoff;") < body.indexOf(handoffDelete));
  assert.ok(body.indexOf("customer_handoff_unpaid_confirmation_required") < body.indexOf(handoffDelete));
  assert.ok(body.indexOf(handoffDelete) < body.indexOf("return canonical_handoff;", body.indexOf(handoffDelete)));
  assert.equal(body.split(handoffDelete).length, 2);
  assert.doesNotMatch(body, /exception\s+when|\bcommit\b|\brollback\b/i);
});

test("delivery exits storage only after a valid completed transition", async () => {
  const sql = await source(current);
  const body = rpc(sql, "transition_delivery_status");
  assert.match(body, /security definer\s+set search_path = public/);
  assert.ok(body.indexOf("transition not allowed") < body.indexOf(deliveryDelete));
  assert.ok(body.indexOf("where id = target_delivery_id and organization_id = org_id;") < body.indexOf(deliveryDelete));
  assert.equal(body.split(deliveryDelete).length, 2);
  assert.doesNotMatch(body, /exception\s+when|\bcommit\b|\brollback\b/i);
});

test("original RPC bodies, signatures, tenant guards and grants are preserved", async () => {
  const [oldSql, newSql] = await Promise.all([source(prior), source(current)]);
  const oldHandoff = rpc(oldSql, "complete_customer_handoff", "create_or_update_delivery")
    .replace("create function", "create or replace function");
  const newHandoff = rpc(newSql, "complete_customer_handoff", "transition_delivery_status")
    .replace(handoffDelete, "");
  assert.equal(newHandoff, oldHandoff);
  const oldDelivery = rpc(oldSql, "transition_delivery_status")
    .split("alter table public.order_customer_handoffs enable row level security;")[0].trim();
  const newDelivery = rpc(newSql, "transition_delivery_status").replace(deliveryDelete, "");
  assert.equal(newDelivery, oldDelivery);
  assert.doesNotMatch(newSql, /\b(?:grant|revoke|alter table|create trigger|drop function)\b/i);
});

test("only two tenant-scoped deletes; absent storage is a no-op and no history is rewritten", async () => {
  const sql = await source(current);
  assert.equal((sql.match(/delete from public\.order_storage/g) ?? []).length, 2);
  assert.equal((sql.match(/where organization_id = org_id\s+and order_id = (?:target_order_id|parent_order_id);/g) ?? []).length, 2);
  assert.doesNotMatch(sql, /\b(?:insert into|update) public\.(?:orders|payments|order_storage|order_status_history)\b/i);
  assert.doesNotMatch(sql, /delete from public\.(?:orders|deliveries|order_customer_handoffs|payments)/i);
  assert.doesNotMatch(sql, /\b(?:truncate|do \$\$|create table|alter table|drop table)\b/i);
  const migrations = await readdir(new URL("../supabase/migrations", import.meta.url));
  assert.equal(migrations.filter((name) => name === "20260926000100_final_fulfillment_storage_exit.sql").length, 1);
});

test("no application-side or manual storage exit path", async () => {
  const paths = [
    "src/features/handoffs/server/actions.ts",
    "src/features/logistics/server/actions.ts",
    "src/features/warehouse/server/storage-actions.ts",
    "src/components/warehouse/OrderStoragePanel.tsx",
  ];
  for (const path of paths) assert.doesNotMatch(await source(path), /(?:delete from public\.order_storage|\.from\("order_storage"\)\.delete\()/i);
});
