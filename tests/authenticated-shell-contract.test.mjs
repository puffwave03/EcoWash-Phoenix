import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("authenticated app routes bypass all public marketing chrome", async () => {
  const frame = await source("src/layouts/SiteFrame.tsx");

  assert.match(frame, /pathname === "\/app"/);
  assert.match(frame, /pathname\.startsWith\("\/app\/"\)/);
  assert.match(frame, /if \(usesAuthenticatedShell\) return children/);
});

test("application shell retains compact identity, role, account and logout controls", async () => {
  const [shell, navigation] = await Promise.all([
    source("src/components/dashboard/DashboardShell.tsx"),
    source("src/components/dashboard/AppNavigation.tsx"),
  ]);

  assert.match(shell, /currentUserName/);
  assert.match(shell, /access\.membership\.role/);
  assert.match(shell, /<LogoutButton/);
  assert.match(navigation, /activeItem\.label/);
  assert.match(navigation, /min-h-11/);
  assert.match(navigation, /lg:hidden/);
  assert.doesNotMatch(`${shell}\n${navigation}`, /requestDemo|navigationItems.*solutions/);
});
