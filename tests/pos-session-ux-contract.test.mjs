import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("1-4 Terminal separates canonical till status from the existing POS action", async () => {
  const [page, terminal] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/shop/page.tsx"),
    source("src/components/shop-terminal/ShopTerminalWorkspace.tsx"),
  ]);

  assert.match(page, /getCurrentPosSession\(locale\)/);
  assert.match(terminal, /session \? text\.tillOpen : text\.tillClosed/);
  assert.match(terminal, /session \? text\.tillManagement : text\.openTill/);
  assert.ok((terminal.match(/href="\/app\/pos" locale=\{locale\}/g) ?? []).length >= 3);
  assert.doesNotMatch(terminal, /openPosSession|open_pos_session/);
});

test("5 Daily Close keeps the open-session count and adds generic POS navigation", async () => {
  const dashboard = await source("src/components/daily-close/DailyCloseDashboard.tsx");

  assert.match(dashboard, /blocker\.key === "open_pos_session"/);
  assert.match(dashboard, /href="\/app\/pos" locale=\{locale\}>\{text\.blockers\.managePos\}/);
  assert.match(dashboard, /blocker\.count === undefined \? label : `\$\{label\}: \$\{blocker\.count\}`/);
  assert.doesNotMatch(dashboard, /sessionId|closePosSessionAction/);
});

test("6-7 every existing POS mutation revalidates Daily Close", async () => {
  const actions = await source("src/features/pos/server/actions.ts");
  const refreshStart = actions.indexOf("function refresh");
  const refreshEnd = actions.indexOf("export async function openPosSessionAction", refreshStart);
  const refresh = actions.slice(refreshStart, refreshEnd);

  assert.match(refresh, /revalidatePath\(`\/\$\{locale\}\/app\/daily-close`\)/);
  assert.match(actions, /open_pos_session[\s\S]*refresh\(locale\)/);
  assert.match(actions, /close_pos_session[\s\S]*refresh\(locale\)/);
});

test("8-12 existing POS authorization and tenant/staff scoping remain canonical", async () => {
  const [shopPage, shopAccess, posAccess, capabilities, queries] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/shop/page.tsx"),
    source("src/features/shop-terminal/server/access.ts"),
    source("src/features/pos/server/access.ts"),
    source("src/lib/auth/capabilities.ts"),
    source("src/features/pos/server/queries.ts"),
  ]);

  assert.match(shopPage, /requireShopTerminalAccess\(locale\)/);
  assert.match(shopAccess, /requireEntitlement\(locale, FEATURES\.shopTerminal\)[\s\S]*requirePosAccess\(locale\)/);
  assert.match(posAccess, /requireEntitlement\(locale, FEATURES\.pos\)[\s\S]*requireOperationalCapability\(locale, "pos"\)/);
  assert.match(capabilities, /role === "owner" \|\| role === "manager"/);
  assert.match(capabilities, /DEFAULT_STAFF_OPERATIONAL_CAPABILITIES[\s\S]*capability !== "pos"/);
  assert.match(queries, /\.eq\("organization_id", membership\.organization\.id\)\.eq\("status", "open"\)/);
  assert.match(queries, /membership\.role === "staff"[\s\S]*\.eq\("opened_by", profile\.id\)/);
});

test("13-14 desktop and mobile expose distinct readable status and action controls", async () => {
  const terminal = await source("src/components/shop-terminal/ShopTerminalWorkspace.tsx");

  assert.match(terminal, /terminalHeader[\s\S]*text\.operator[\s\S]*<span[^>]+>[\s\S]*text\.tillOpen[\s\S]*<Link[^>]+href="\/app\/pos"/);
  assert.match(terminal, /md:hidden[\s\S]*flex shrink-0 flex-col items-end gap-1[\s\S]*min-h-11[\s\S]*href="\/app\/pos"/);
});

test("15-16 POS workflow and financial RPC boundaries remain unchanged", async () => {
  const [page, workspace, actions, navigation] = await Promise.all([
    source("src/app/[locale]/app/(dashboard)/pos/page.tsx"),
    source("src/components/pos/PosWorkspace.tsx"),
    source("src/features/pos/server/actions.ts"),
    source("src/components/dashboard/AppNavigation.tsx"),
  ]);

  assert.match(page, /openPosSessionAction[\s\S]*closePosSessionAction/);
  assert.match(workspace, /OpenSessionForm[\s\S]*CloseSessionForm[\s\S]*text\.history\.title/);
  for (const rpc of ["open_pos_session", "record_pos_payment", "record_pos_refund", "close_pos_session"])
    assert.match(actions, new RegExp(`rpc\\("${rpc}"`));
  assert.match(navigation, /const counterNavigationItems = shopNavigationItem \? \[shopNavigationItem\] : posNavigationItem \? \[posNavigationItem\] : \[\]/);
});

test("all five locales contain natural till status and action vocabulary", async () => {
  for (const locale of ["en", "it", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    for (const key of ["openTill", "tillClosed", "tillManagement", "tillOpen"])
      assert.equal(typeof messages.shopTerminal.labels[key], "string", `${locale} shopTerminal.labels.${key}`);
    assert.equal(typeof messages.dailyClose.blockers.managePos, "string", `${locale} dailyClose.blockers.managePos`);
  }
});
