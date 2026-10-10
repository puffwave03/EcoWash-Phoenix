import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const actionPath = "src/features/platform-admin/server/tenant-onboarding.ts";
const identityPath = "src/features/platform-admin/server/owner-identity.ts";
const formPath = "src/components/platform/PlatformTenantOnboardingForm.tsx";

test("001C route and navigation remain inside the guarded Platform Admin area", async () => {
  const [route, layout, shell, directory] = await Promise.all([
    source("src/app/[locale]/platform/organizations/new/page.tsx"),
    source("src/app/[locale]/platform/layout.tsx"),
    source("src/components/platform/PlatformShell.tsx"),
    source("src/app/[locale]/platform/organizations/page.tsx"),
  ]);
  assert.match(route, /requirePlatformAdmin\(locale\)/);
  assert.match(layout, /requirePlatformAdmin\(locale\)/);
  assert.match(shell, /\/platform\/organizations\/new/);
  assert.match(directory, /\/platform\/organizations\/new/);
});

test("privileged Auth work follows the action guard and stays server-only", async () => {
  const [action, identity, admin] = await Promise.all([source(actionPath), source(identityPath), source("src/lib/supabase/admin.ts")]);
  assert.ok(action.indexOf("await requirePlatformAdmin(locale)") < action.indexOf("createSupabaseAdminClient()"));
  assert.match(identity, /import "server-only"/);
  assert.match(admin, /import "server-only"/);
  assert.doesNotMatch(action, /organization_id.*formData|get\("organization_id"\)/);
  assert.doesNotMatch(action, /get\("platformAdmin"\)|get\("isPlatformAdmin"\)/);
});

test("new Owner invite is followed by Auth user, email identity and profile checks before bootstrap", async () => {
  const [action, identity] = await Promise.all([source(actionPath), source(identityPath)]);
  assert.match(action, /inviteUserByEmail\(input\.ownerEmail/);
  assert.match(action, /ownerId = data\.user\.id/);
  assert.ok(action.indexOf("verifyOwnerIdentity(admin, ownerId, input.ownerEmail)") < action.indexOf('rpc("platform_bootstrap_tenant"'));
  assert.match(identity, /getUserById\(ownerId\)/);
  assert.match(identity, /data\.user\.email\?\.trim\(\)\.toLowerCase\(\) !== email/);
  assert.match(identity, /identity\.provider === "email"/);
  assert.match(identity, /identity\.identity_data\?\.email/);
  assert.match(identity, /from\("profiles"\)\.select\("id"\)\.eq\("id", ownerId\)/);
  assert.match(action, /if \(identity !== "ready"\)[\s\S]*?return/);
});

test("existing Owner path verifies supplied UUID and email without inviting again", async () => {
  const [action, validation, form] = await Promise.all([
    source(actionPath), source("src/features/platform-admin/tenant-onboarding-validation.ts"), source(formPath),
  ]);
  assert.match(validation, /input\.ownerMode === "existing" && !uuidPattern\.test\(input\.ownerId\)/);
  assert.match(action, /let ownerId = input\.ownerId/);
  assert.match(action, /verifyOwnerIdentity\(admin, ownerId, input\.ownerEmail\)/);
  assert.match(action, /identity === "mismatch" \? "identityMismatch"/);
  assert.match(form, /setModeOverride\("existing"\)/);
  assert.doesNotMatch(action, /listUsers\(|generateLink\(|resend\(/);
});

test("returned owner mode drives the radio selection and recovery fields", async () => {
  const [action, types, form] = await Promise.all([
    source(actionPath), source("src/features/platform-admin/types-onboarding.ts"), source(formPath),
  ]);
  assert.match(types, /ownerMode: OwnerMode/);
  assert.match(action, /ownerMode: input\.ownerMode/);
  assert.match(form, /ownerMode: "invite"/);
  assert.match(form, /const mode = modeOverride \?\? state\.ownerMode/);
  assert.match(form, /state\.preparedOwner\?\.id/);
  assert.match(form, /state\.preparedOwner\?\.email/);
});

test("onboarding submits FormData through an action transition without React form reset", async () => {
  const form = await source(formPath);
  assert.match(form, /onSubmit=\{\(event\) => \{\s*event\.preventDefault\(\);\s*const formData = new FormData\(event\.currentTarget\);\s*startTransition\(\(\) => \{\s*formAction\(formData\);/);
  assert.doesNotMatch(form, /<form[^>]*action=\{formAction\}/);
  assert.match(form, /checked=\{mode === "existing"\}/);
  assert.match(form, /checked=\{mode === "invite"\}/);
  assert.match(form, /name="locale"[^>]*onChange=\{\(event\) => setDefaultLocale\(event\.target\.value\)\} required value=\{defaultLocale\}/);
});

test("001B is called through the session client with its full canonical argument set", async () => {
  const action = await source(actionPath);
  assert.match(action, /const supabase = await createSupabaseServerClient\(\)/);
  assert.match(action, /supabase\.rpc\("platform_bootstrap_tenant", \{/);
  for (const arg of ["target_idempotency_key", "target_name", "target_slug", "target_default_currency",
    "target_timezone", "target_default_locale", "target_default_country_code", "target_owner_profile_id", "target_first_location_name"]) {
    assert.match(action, new RegExp(`${arg}:`));
  }
  assert.doesNotMatch(action, /admin\.rpc\("platform_bootstrap_tenant"/);
  assert.doesNotMatch(action, /\.from\("(?:organizations|organization_memberships|locations)"\)\.(?:insert|upsert)/);
});

test("same normalized submission reuses its key; changed input rotates it and prepared Owner is reusable", async () => {
  const action = await source(actionPath);
  assert.match(action, /tenantOnboardingFingerprint\(input\)/);
  assert.match(action, /previous\.fingerprint === null \|\| previous\.fingerprint === fingerprint \? previous\.key : randomUUID\(\)/);
  assert.match(action, /previous\.preparedOwner\?\.email === input\.ownerEmail/);
  assert.match(action, /if \(preparedOwner\) \{[\s\S]*?ownerId = preparedOwner\.id/);
  assert.match(action, /replayed: result\.replayed === true/);
});

test("known bootstrap errors have safe codes and failure retains the Owner recovery identity", async () => {
  const action = await source(actionPath);
  for (const code of ["platform_admin_required", "platform_tenant_bootstrap_idempotency_conflict",
    "platform_tenant_bootstrap_slug_conflict", "platform_tenant_bootstrap_owner_membership_conflict",
    "platform_tenant_bootstrap_owner_portal_conflict", "platform_tenant_bootstrap_owner_identity_invalid",
    "platform_tenant_bootstrap_input_invalid"]) assert.match(action, new RegExp(code));
  assert.match(action, /error: mapRpcError\(error\.message\), preparedOwner: recoveryOwner/);
  assert.match(action, /error: "unknown", preparedOwner: recoveryOwner/);
  assert.doesNotMatch(action, /error: error\.message|throw error/);
});

test("form exposes editable slug, recovery mode, success and invitation-requested wording", async () => {
  const [form, validation, page] = await Promise.all([
    source(formPath), source("src/features/platform-admin/tenant-onboarding-validation.ts"),
    source("src/app/[locale]/platform/organizations/new/page.tsx"),
  ]);
  assert.match(form, /name="slug" onChange/);
  assert.match(form, /state\.preparedOwner\.id/);
  assert.match(form, /state\.success\.replayed/);
  assert.match(form, /state\.success\.invitation === "requested"/);
  assert.match(form, /\/platform\/organizations\/\$\{state\.success\.organizationId\}/);
  const routing = await source("src/i18n/routing.ts");
  assert.match(validation, /routing\.locales\.includes/);
  assert.match(routing, /\["en", "it", "es", "fr", "de"\]/);
  assert.doesNotMatch(form, /defaultValue="(?:EUR|ES|Atlantic\/Canary)"/);
  assert.match(page, /randomUUID\(\)/);
});

test("five locales contain every onboarding message and audit label", async () => {
  const required = ["title", "description", "back", "fields", "helpers", "modes", "placeholders", "actions", "results", "errors"];
  const english = JSON.parse(await source("src/i18n/en/common.json")).platform.onboarding;
  const keys = (value, prefix = "") => Object.entries(value).flatMap(([key, child]) =>
    child && typeof child === "object" ? keys(child, `${prefix}${key}.`) : [`${prefix}${key}`]);
  for (const locale of ["en", "it", "es", "fr", "de"]) {
    const messages = JSON.parse(await source(`src/i18n/${locale}/common.json`)).platform;
    for (const key of required) assert.ok(messages.onboarding[key], `${locale}: ${key}`);
    assert.deepEqual(keys(messages.onboarding).sort(), keys(english).sort(), `${locale}: onboarding message keys`);
    assert.ok(messages.shell.onboarding, `${locale}: shell link`);
    assert.ok(messages.audit.actions.tenant_bootstrap, `${locale}: audit action`);
    for (const code of ["slugConflict", "ownerMembershipConflict", "ownerPortalConflict", "identityIncomplete", "idempotencyConflict", "platformAdminRequired"]) {
      assert.ok(messages.onboarding.errors[code], `${locale}: ${code}`);
    }
  }
});

test("001C adds no database migration", async () => {
  const migrations = await readdir(new URL("../supabase/migrations/", import.meta.url));
  assert.ok(!migrations.some((name) => name.includes("saas_tenant_bootstrap_001c")));
});
