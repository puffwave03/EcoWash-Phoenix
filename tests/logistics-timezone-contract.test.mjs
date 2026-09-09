import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isoToOrganizationDateTimeLocal,
  organizationDateTimeLocalToIso,
} from "../src/lib/organization-timezone.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const CANARY = "Atlantic/Canary";

test("summer and winter wall-clock values become the correct Canary instants", () => {
  assert.equal(organizationDateTimeLocalToIso("2026-09-09T11:00", CANARY), "2026-09-09T10:00:00.000Z");
  assert.equal(organizationDateTimeLocalToIso("2026-01-09T11:00", CANARY), "2026-01-09T11:00:00.000Z");
});

test("tenant wall-clock values round trip without using the runtime timezone", () => {
  const originalTimeZone = process.env.TZ;

  try {
    for (const runtimeTimeZone of ["UTC", "America/New_York", "Asia/Tokyo"]) {
      process.env.TZ = runtimeTimeZone;
      const instant = organizationDateTimeLocalToIso("2026-09-09T11:00", CANARY);

      assert.equal(instant, "2026-09-09T10:00:00.000Z");
      assert.equal(isoToOrganizationDateTimeLocal(instant, CANARY), "2026-09-09T11:00");
    }
  } finally {
    if (originalTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimeZone;
  }
});

test("nonexistent and ambiguous Canary wall times require a new explicit choice", () => {
  assert.equal(organizationDateTimeLocalToIso("2026-03-29T01:30", CANARY), null);
  assert.equal(organizationDateTimeLocalToIso("2026-10-25T01:30", CANARY), null);
});

test("manager form and staff formatter resolve the same intended time", () => {
  const instant = organizationDateTimeLocalToIso("2026-09-09T11:00", CANARY);

  assert.equal(isoToOrganizationDateTimeLocal(instant, CANARY), "2026-09-09T11:00");
  assert.equal(new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: CANARY,
  }).format(new Date(instant)), "11:00");
});

test("approved write and rendering boundaries use the shared organization timezone", async () => {
  const [actions, panel, page, shop, dashboard, dashboardQueries] = await Promise.all([
    source("src/features/logistics/server/actions.ts"),
    source("src/components/logistics/LogisticsPanel.tsx"),
    source("src/app/[locale]/app/(dashboard)/orders/[orderId]/page.tsx"),
    source("src/features/shop-terminal/server/actions.ts"),
    source("src/components/dashboard/OperationalDashboard.tsx"),
    source("src/features/dashboard/server/queries.ts"),
  ]);

  assert.equal((actions.match(/organizationDateTimeLocalToIso\(input\.scheduledAt, membership\.organization\.timezone\)/g) ?? []).length, 2);
  assert.doesNotMatch(panel, /value\.slice\(0, 16\)/);
  assert.match(panel, /isoToOrganizationDateTimeLocal\(value, timeZone\)/);
  assert.match(page, /timeZone=\{access\.membership\.organization\.timezone\}/);
  assert.match(shop, /target_delivery_scheduled_at: normalizedDeliveryScheduledAt/);
  assert.match(dashboard, /formatTime\(item\.scheduledAt, locale, timeZone\)/);
  assert.match(dashboardQueries, /timeZone: resolvedTimeZone/);
});
