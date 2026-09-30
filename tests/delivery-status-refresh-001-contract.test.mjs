import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actions = readFileSync(new URL("../src/features/logistics/server/actions.ts", import.meta.url), "utf8");
const transition = actions.slice(
  actions.indexOf("export async function transitionDeliveryAction"),
  actions.indexOf("export async function returnDeliveryToWarehouseAction"),
);

test("successful delivery transition revalidates the Orders list", () => {
  assert.match(transition, /rpc\("transition_delivery_status"/);
  assert.match(transition, /if \(error\) \{[\s\S]*?\n  \}\n\n  revalidateOrder\(locale, orderId\);\n  revalidatePath\(`\/\$\{locale\}\/app\/orders`\);/);
  assert.match(transition, /revalidatePath\(`\/\$\{locale\}\/app\/orders`\);[\s\S]*transitionLeavesLogisticsSurface\(surface, targetStatus\)/);
});
