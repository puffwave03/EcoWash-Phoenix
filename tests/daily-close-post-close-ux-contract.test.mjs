import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("closed-day state reuses the canonical tenant-local business-date resolver", async () => {
  const query = await source("src/features/daily-close/server/persisted-queries.ts");

  assert.match(query, /resolveDailyCloseBusinessDay\([\s\S]*membership\.organization\.timezone/);
  assert.match(query, /\.from\("daily_closes"\)/);
  assert.match(query, /\.eq\("organization_id", membership\.organization\.id\)/);
  assert.match(query, /\.eq\("business_date", businessDate\)/);
});

test("Shop loads close state in parallel with its existing data", async () => {
  const page = await source("src/app/[locale]/app/(dashboard)/shop/page.tsx");

  assert.match(page, /Promise\.all\(\[/);
  assert.match(page, /getCurrentDailyCloseState\(locale\)/);
  assert.match(page, /quickDropClosed = closeState\.organizationWide/);
});

test("organization-wide close takes priority over missing POS location", async () => {
  const panel = await source("src/components/quick-drop/QuickDropTerminalPanel.tsx");

  assert.match(panel, /closedDay \? text\.closedDayUnavailable : text\.locationRequired/);
});

test("missing POS location retains its existing message when the day is open", async () => {
  const panel = await source("src/components/quick-drop/QuickDropTerminalPanel.tsx");

  assert.match(panel, /closedDay \|\| !locationId/);
  assert.match(panel, /text\.locationRequired/);
});

test("closed-day Quick Drop controls are disabled without changing its server action", async () => {
  const [panel, action] = await Promise.all([
    source("src/components/quick-drop/QuickDropTerminalPanel.tsx"),
    source("src/features/quick-drop/server/actions.ts"),
  ]);

  assert.match(panel, /disabled=\{closedDay \|\| !locationId\}/);
  assert.match(panel, /if \(!customer \|\| closedDay \|\| !locationId \|\| isPending\) return/);
  assert.match(action, /rpc\("create_quick_drop_order"/);
});

test("location-specific close state applies only to the active Terminal location", async () => {
  const page = await source("src/app/[locale]/app/(dashboard)/shop/page.tsx");

  assert.match(page, /session\?\.locationId && closeState\.locationIds\.includes\(session\.locationId\)/);
});

test("all five locales expose the focused Quick Drop closed-day message", async () => {
  for (const locale of ["en", "it", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.ok(messages.postCloseGate.quickDrop.trim(), `${locale}.postCloseGate.quickDrop`);
  }
});

test("UX patch adds no migration or Portal change", async () => {
  const [page, panel] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/shop/page.tsx"),
    source("src/components/quick-drop/QuickDropTerminalPanel.tsx"),
  ]);

  assert.doesNotMatch(page + panel, /customer_portal|create_customer_portal_order_request/);
});
