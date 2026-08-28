import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveAuthLanding } from "../src/lib/auth/context-routing.ts";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const tenant = { membershipId: "membership", organization: { id: "tenant", name: "Tenant" }, role: "owner" };

test("login landing distinguishes platform-only, tenant-only, dual and customer access", () => {
  assert.equal(resolveAuthLanding({ hasPortalAccess: false, isPlatformAdmin: true, tenantMemberships: [] }), "platform");
  assert.equal(resolveAuthLanding({ hasPortalAccess: false, isPlatformAdmin: false, tenantMemberships: [tenant] }), "tenant");
  assert.equal(resolveAuthLanding({ hasPortalAccess: false, isPlatformAdmin: true, tenantMemberships: [tenant] }), "context");
  assert.equal(resolveAuthLanding({ hasPortalAccess: true, isPlatformAdmin: false, tenantMemberships: [] }), "portal");
  assert.equal(resolveAuthLanding({ hasPortalAccess: false, isPlatformAdmin: false, tenantMemberships: [] }), "denied");
});

test("Owner, Manager and Staff remain tenant contexts without platform access", () => {
  for (const role of ["owner", "manager", "staff"]) {
    assert.equal(resolveAuthLanding({
      hasPortalAccess: false,
      isPlatformAdmin: false,
      tenantMemberships: [{ ...tenant, role }],
    }), "tenant");
  }
});

test("direct platform and app routes retain independent authoritative guards", async () => {
  const [platformLayout, platformGuard, appLayout, membershipGuard] = await Promise.all([
    source("src/app/[locale]/platform/layout.tsx"),
    source("src/lib/auth/require-platform-admin.ts"),
    source("src/app/[locale]/app/(dashboard)/layout.tsx"),
    source("src/lib/auth/require-membership.ts"),
  ]);

  assert.match(platformLayout, /requirePlatformAdmin\(locale\)/);
  assert.match(platformGuard, /rpc\("is_platform_admin"\)/);
  assert.doesNotMatch(platformGuard, /requireMembership|organization_memberships/);
  assert.match(appLayout, /requireMembership\(locale\)/);
  assert.doesNotMatch(membershipGuard, /is_platform_admin|requirePlatformAdmin/);
});

test("dual access lands on a protected selector and cannot form a redirect loop", async () => {
  const [login, page] = await Promise.all([
    source("src/app/[locale]/login/actions.ts"),
    source("src/app/[locale]/auth/context/page.tsx"),
  ]);

  assert.match(login, /landing === "context"/);
  assert.match(login, /\/auth\/context/);
  assert.match(page, /requireAuth\(locale\)/);
  assert.match(page, /landing === "platform"/);
  assert.match(page, /landing === "tenant"/);
  assert.match(page, /landing === "portal"/);
  assert.match(page, /landing === "denied"/);
  assert.doesNotMatch(page, /landing === "context"[\s\S]{0,120}redirect/);
  assert.match(page, /href="\/platform"/);
  assert.match(page, /href="\/app"/);
});

test("context discovery is user-bound, read-only and future-ready for multiple memberships", async () => {
  const contexts = await source("src/lib/auth/get-auth-contexts.ts");

  assert.match(contexts, /\.eq\("profile_id", userId\)/);
  assert.match(contexts, /\.eq\("user_id", userId\)/);
  assert.match(contexts, /platform_service_status !== "active"/);
  assert.match(contexts, /tenantMemberships/);
  assert.match(contexts, /flatMap/);
  assert.doesNotMatch(contexts, /\.insert\(|\.update\(|\.delete\(|entitlement/);
});

test("dual users receive shell-isolated context switches only when the other context exists", async () => {
  const [dashboard, navigation, platform] = await Promise.all([
    source("src/components/dashboard/DashboardShell.tsx"),
    source("src/components/dashboard/AppNavigation.tsx"),
    source("src/components/platform/PlatformShell.tsx"),
  ]);

  assert.match(dashboard, /platformAccess \?/);
  assert.match(dashboard, /href="\/platform"/);
  assert.match(navigation, /platformAccess && switchToPlatformLabel/);
  assert.match(platform, /tenantName \?/);
  assert.match(platform, /href="\/app"/);
  assert.doesNotMatch(platform, /\/app\/orders|\/app\/customers|\/app\/billing/);
});

test("all locales include context selector and switch vocabulary", async () => {
  for (const locale of ["en", "it", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`));
    assert.equal(typeof messages.auth.context.title, "string");
    assert.equal(typeof messages.auth.context.platformAction, "string");
    assert.equal(typeof messages.auth.context.tenantAction, "string");
    assert.equal(typeof messages.auth.dashboard.switchToPlatform, "string");
    assert.equal(typeof messages.platform.shell.switchToTenant, "string");
  }
});
