import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("service media accepts only validated JPEG, PNG or WebP within the shared limit", async () => {
  const validation = await source("src/features/branding/validation.ts");
  assert.match(validation, /MAX_BRAND_MEDIA_BYTES = 2 \* 1024 \* 1024/);
  assert.match(validation, /ORDER_PHOTO_MIME_TYPES\.includes/);
  assert.match(validation, /hasAllowedImageSignature/);
});

test("service image save preserves, replaces and explicitly removes the canonical path", async () => {
  const actions = await source("src/features/catalog-admin/server/actions.ts");
  assert.match(actions, /let nextImagePath = parsed\.input\.removeImage \? null : current\.portal_image_path/);
  assert.match(actions, /nextImagePath = upload\.path/);
  assert.match(actions, /portal_image_path: nextImagePath/);
  assert.match(actions, /oldManagedPath && oldManagedPath !== nextImagePath/);
});

test("upload and service update stay tenant-scoped and failed saves do not report success", async () => {
  const actions = await source("src/features/catalog-admin/server/actions.ts");
  assert.match(actions, /const path = `\$\{organizationId\}\/\$\{kind\}\/\$\{crypto\.randomUUID\(\)\}\.\$\{extension\}`/);
  assert.match(actions, /from\("services"\)[\s\S]*eq\("organization_id", membership\.organization\.id\)[\s\S]*eq\("id", parsed\.input\.serviceId\)/);
  assert.match(actions, /if \(upload\.error \|\| !upload\.path\) return fail\(\{\}, "upload"\)/);
  assert.match(actions, /if \(error\) \{[\s\S]*removeMedia\(supabase, uploadedPath\)[\s\S]*return fail/);
});

test("Catalog admin reloads and renders the persisted service image", async () => {
  const [queries, ui] = await Promise.all([
    source("src/features/catalog-admin/server/queries.ts"),
    source("src/components/catalog-admin/CatalogManagement.tsx"),
  ]);
  assert.match(queries, /portalImagePath: row\.portal_image_path/);
  assert.match(queries, /portalImageUrl: storageUrl\(supabase, row\.portal_image_path\)/);
  assert.match(ui, /src=\{service\.portalImageUrl\}/);
});

test("Terminal retrieves service media with tenant isolation and renders it on service cards", async () => {
  const [queries, ui] = await Promise.all([
    source("src/features/shop-terminal/server/queries.ts"),
    source("src/components/shop-terminal/ShopTerminalWorkspace.tsx"),
  ]);
  assert.match(queries, /select\("id, portal_image_path"\)[\s\S]*eq\("organization_id", membership\.organization\.id\)[\s\S]*in\("id", services\.map/);
  assert.match(queries, /imageUrl: serviceImageUrl/);
  assert.match(ui, /src=\{service\.imageUrl\}/);
});

test("Customer Portal renders each canonical service image", async () => {
  const [queries, ui] = await Promise.all([
    source("src/features/portal/server/queries.ts"),
    source("src/components/portal/CustomerOrderRequestForm.tsx"),
  ]);
  assert.match(queries, /portalImagePath: service\.portal_image_path/);
  assert.match(ui, /src=\{service\.portalImagePath\}/);
});

test("existing public bucket and policies constrain catalog media by role and organization", async () => {
  const [brandMigration, catalogMigration] = await Promise.all([
    source("supabase/migrations/20260824000400_brand_001_tenant_branding.sql"),
    source("supabase/migrations/20260824000500_catalog_admin_001_customer_catalog.sql"),
  ]);
  assert.match(brandMigration, /values \('brand-media', 'brand-media', true, 2097152/);
  assert.match(catalogMigration, /split_part\(name, '\/', 2\) in \('category', 'service'\)/);
  assert.match(catalogMigration, /array\['owner', 'manager'\]::public\.app_role\[\]/);
  assert.match(catalogMigration, /app_brand_media_path_organization_id\(portal_image_path\) = organization_id/);
});
