import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actions = readFileSync(new URL("../src/features/logistics/server/actions.ts", import.meta.url), "utf8");
const transition = actions.slice(
  actions.indexOf("export async function transitionDeliveryAction"),
  actions.indexOf("export async function returnDeliveryToWarehouseAction"),
);

test("successful Order detail delivery transition revalidates before a clean detail redirect", () => {
  assert.match(transition, /if \(error\) \{[\s\S]*?\n  \}\n\n  revalidateOrder\(locale, orderId\);/);
  assert.match(transition, /revalidateOrder\(locale, orderId\);[\s\S]*revalidatePath\(`\/\$\{locale\}\/app\/orders`\);[\s\S]*if \(surface === "order"\) \{\s*redirect\(`\/\$\{locale\}\/app\/orders\/\$\{orderId\}#logistics`\);\s*\}/);
});

test("workspace completion and cancellation keep their existing redirect", () => {
  assert.match(transition, /if \(transitionLeavesLogisticsSurface\(surface, targetStatus\)\) \{\s*redirect\(logisticsWorkspacePath\(locale, "deliveries"\)\);\s*\}\s*if \(surface === "order"\)/);
});
