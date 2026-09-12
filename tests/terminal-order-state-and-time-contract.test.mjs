import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { deriveOrderDisplayStatus } from "../src/features/orders/display-status.ts";
import { formatOrganizationDateTime } from "../src/lib/organization-timezone.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const completed = (pickupStatus, deliveryStatus) => deriveOrderDisplayStatus({
  deliveryStatus,
  pickupStatus,
  productionStatus: "completed",
});

test("counter order remains ready for pickup until pickup closes", () => {
  assert.equal(completed("scheduled", null), "ready_for_pickup");
  assert.equal(completed(null, null), "ready_for_pickup");
  assert.equal(completed("completed", null), "completed");
});

test("completed production follows the delivery lifecycle", () => {
  assert.equal(completed(null, "scheduled"), "delivery_scheduled");
  assert.equal(completed(null, "in_progress"), "delivery_in_progress");
  assert.equal(completed(null, "completed"), "completed");
  assert.equal(completed("scheduled", "completed"), "ready_for_pickup");
  assert.equal(completed("completed", "completed"), "completed");
});

test("active production remains the visible production status", () => {
  for (const productionStatus of ["received", "washing", "drying", "ironing", "quality_check", "packing", "ready", "on_hold"]) {
    assert.equal(deriveOrderDisplayStatus({
      deliveryStatus: "in_progress",
      pickupStatus: "completed",
      productionStatus,
    }), productionStatus);
  }
});

test("Tenerife receipt time is independent of runtime timezone", () => {
  const originalTimeZone = process.env.TZ;

  try {
    for (const runtimeTimeZone of ["UTC", "America/New_York", "Asia/Tokyo"]) {
      process.env.TZ = runtimeTimeZone;
      assert.equal(formatOrganizationDateTime(
        "2026-09-12T07:48:00.000Z",
        "en-GB",
        "Atlantic/Canary",
        { hour: "2-digit", hour12: false, minute: "2-digit" },
      ), "08:48");
    }
  } finally {
    if (originalTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimeZone;
  }
});

test("receipt, order list and detail use the tenant timezone and derived lifecycle", async () => {
  const [receipt, receiptQueries, list, orderQueries, detail, myDay] = await Promise.all([
    source("src/components/sales-documents/OperationalReceiptDocument.tsx"),
    source("src/features/sales-documents/server/queries.ts"),
    source("src/components/orders/OrderList.tsx"),
    source("src/features/orders/server/queries.ts"),
    source("src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx"),
    source("src/features/work/server/queries.ts"),
  ]);

  assert.match(receipt, /formatOrganizationDateTime\(document\.issuedAt, locale, receipt\.timeZone\)/);
  assert.match(receiptQueries, /mapReceipt\(data, membership\.organization\.timezone, logoUrl\)/);
  assert.match(list, /order\.displayStatus/);
  assert.match(list, /formatDate\(order\.dueAt, locale, timeZone\)/);
  assert.match(orderQueries, /from\("deliveries"\)\.select\("order_id, status"\)/);
  assert.match(orderQueries, /deriveOrderDisplayStatus/);
  assert.match(detail, /displayStatusLabels\[displayStatus\]/);
  assert.match(detail, /access\.membership\.organization\.timezone/);
  assert.match(myDay, /deliveriesQuery[\s\S]*\.in\("status", \["scheduled", "in_progress"\]\)/);
});
