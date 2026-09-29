import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { resolveProductionAssignee } from "../src/features/shop-terminal/production-assignee.ts";

const assignments = [{ id: "production", label: "Production Test" }, { id: "quality", label: "Quality Test" }];
const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const workspace = read("src/components/shop-terminal/ShopTerminalWorkspace.tsx");

test("configured Quality Test wins over first Production Test on initial/new order", () => {
  assert.equal(resolveProductionAssignee(assignments, "quality"), "quality");
  assert.match(workspace, /useState\(resolvedProductionDefault\)/);
  assert.match(workspace, /setProductionAssigneeId\(resolvedProductionDefault\)/);
  assert.doesNotMatch(workspace, /productionAssignments\[0\]/);
});

test("absent, stale or unavailable configured defaults fail safe to Unassigned", () => {
  for (const configured of [null, "inactive"]) assert.equal(resolveProductionAssignee(assignments, configured), "");
  assert.equal(resolveProductionAssignee([], "quality"), "");
});

test("valid manual/draft override survives and next order returns to location default", () => {
  assert.equal(resolveProductionAssignee(assignments, "quality", "production"), "production");
  assert.equal(resolveProductionAssignee(assignments, "quality"), "quality");
  assert.match(workspace, /onChange=\{\(event\) => setProductionAssigneeId\(event.target.value\)\}/);
});

test("missing draft choice inherits default but stale and explicit Unassigned do not", () => {
  assert.equal(resolveProductionAssignee(assignments, "quality", undefined), "quality");
  assert.equal(resolveProductionAssignee(assignments, "quality", "stale"), "");
  assert.equal(resolveProductionAssignee(assignments, "quality", ""), "");
  assert.match(workspace, /typeof draft.productionAssigneeId === "string" \? draft.productionAssigneeId : undefined/);
  assert.match(workspace, /setProductionAssigneeId\(resolveProductionAssignee\(\s+productionAssignments, defaultProductionAssigneeId, draft\?\.productionAssigneeId/);
});

test("submission carries selected default/manual choice and explicit Unassigned is null", () => {
  const expression = workspace.match(/productionAssigneeId: (productionAssigneeId \|\| null),/)[1];
  const submit = new Function("productionAssigneeId", `return ${expression}`);
  assert.equal(submit(resolveProductionAssignee(assignments, "quality")), "quality");
  assert.equal(submit("production"), "production");
  assert.equal(submit(""), null);
});

test("server loads only active tenant locations and uses existing session/single-location resolution", () => {
  const query = read("src/features/shop-terminal/server/queries.ts");
  const page = read("src/app/[locale]/app/(dashboard)/shop/page.tsx");
  assert.match(query, /select\("id, default_production_assignee_id", \{ count: "exact" \}\)/);
  assert.match(query, /eq\("organization_id", membership.organization.id\)/);
  assert.match(query, /eq\("is_active", true\)/);
  assert.match(query, /is\("deleted_at", null\)/);
  assert.match(query, /locationId \? row.id === locationId : locations.count === 1/);
  assert.match(query, /productionAssignments: !locations.error && locations.count === 1 \? assignments.all : \[\]/);
  assert.match(page, /listShopOperationalOptions\(locale, session\?\.locationId \?\? null\)/);
  assert.match(page, /defaultProductionAssigneeId=\{operationalOptions.defaultProductionAssigneeId\}/);
});
