#!/usr/bin/env node
// ECOWASH-PILOT-CATALOG-MEDIA-002F.
// Canonical fingerprints: UTF-8; services sorted by exact code, each record
// code<TAB>categoryKey<TAB>classification<TAB>sourcePath<LF>.
// Categories sorted by exact key, each record key<TAB>classification<TAB>
// sourcePath-or-NULL<LF>. No headers, escaping, BOM or Unicode normalization.
// Codes/keys/paths are validated to exclude tabs, newlines and the NULL token.
// The historical 178ce144... fingerprint has an unknown serialization and is
// intentionally not compared with these new hashes.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = "e09f1e0b-1c4d-4450-9a30-79999bee545a";
const PILOT = "5f9df6bc-ec65-4a03-96f6-a4e23e851a8c";
const OWNER_ID = "375e3f75-e081-4012-9891-6d0bfc0a22d4";
const OWNER_EMAIL = "ecowash.tenerife+phoenixpilot@gmail.com";
const PROJECT = "exthnplfokcucaqydney";
const URL = "https://" + PROJECT + ".supabase.co";
const BUCKET = "brand-media";
const MAX_BYTES = 2 * 1024 * 1024;
const APPROVED_SERVICE_SHA256 = "c33ab5e4d21eef209d2953f443ba677b811c9134f34f2f8c22a631fb8c607433";
const APPROVED_CATEGORY_SHA256 = "02ad070204c514f3f7d288d32539bf0070d37c2363db5ead170c722adeb2e284";
const APPROVED_SOURCE_BYTES_SHA256 = "be46789a20779f9ab89afc0bc8dc099fb1ef611c9d5d25d1902d25a0e158aa36";
const APPROVED_PILOT_CODE_UUID_SHA256 = "451ad0eb2b9a3918c7d3431437cc735f5377fb0dec7cf70be0d875a466c3abdc";
// Future CTO/PO review must replace null with one exact approved execution ID.
// A syntactically valid CLI argument can never unlock execution on its own.
const APPROVED_EXECUTION_ID = null;
const KEYS = ["bed_linen", "dry_cleaning", "home_textiles", "ironing",
  "laundry_by_weight", "leather", "professional_services", "rugs_bulky",
  "self_service", "traditional_ceremonial"];
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const managedPattern = new RegExp("^" + SOURCE + "/(service|category)/" + UUID + "\\.(jpg|jpeg|png|webp)$");
const destinationPattern = new RegExp("^" + PILOT + "/(service|category)/" + UUID + "\\.(jpg|jpeg|png|webp)$");
const staticPattern = /^\/images\/[A-Za-z0-9_./-]+\.(jpg|jpeg|png|webp)$/;
const staticPaths = new Set([
  "/images/home/hero/folded-white-linen.webp",
  "/images/home/industries/professional-laundry.webp",
  "/images/home/services/dry-cleaning.webp",
  "/images/home/services/ironing-finishing.webp",
]);
const mimeByExtension = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

export function classification(path) {
  if (path === null) return "none";
  if (managedPattern.test(path)) return "managed";
  if (staticPaths.has(path) && staticPattern.test(path) && !path.includes("..")) return "static";
  throw new Error("Unexpected image path or tenant ownership");
}

export function fingerprintServices(rows) {
  const lines = [...rows].sort((a, b) => a.code < b.code ? -1 : a.code > b.code ? 1 : 0)
    .map((row) => {
      assert.match(row.code, /^[A-Za-z0-9_-]+$/);
      assert.match(row.categoryKey, /^[a-z0-9_]+$/);
      assert.ok(row.sourcePath !== null);
      return [row.code, row.categoryKey, classification(row.sourcePath), row.sourcePath].join("\t") + "\n";
    }).join("");
  return createHash("sha256").update(lines, "utf8").digest("hex");
}

export function fingerprintCategories(rows) {
  const lines = [...rows].sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
    .map((row) => {
      assert.match(row.key, /^[a-z0-9_]+$/);
      assert.ok(row.sourcePath === null || managedPattern.test(row.sourcePath));
      return [row.key, row.sourcePath === null ? "none" : "managed",
        row.sourcePath ?? "NULL"].join("\t") + "\n";
    }).join("");
  return createHash("sha256").update(lines, "utf8").digest("hex");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function fingerprintCodeUuid(rows) {
  return sha256(Buffer.from([...rows].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([code, id]) => code + "\t" + id + "\n").join(""), "utf8"));
}

export function fingerprintSourceBytes(entries) {
  return sha256(Buffer.from([...entries].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([path, value]) => [path, value.size, value.mime, value.sha256].join("\t") + "\n").join(""), "utf8"));
}

export function assertExecutionAuthorization(requested, approved = APPROVED_EXECUTION_ID) {
  if (!approved || requested !== approved) {
    throw new Error("Execution disabled: exact separate CTO/PO authorization is not configured");
  }
}

// RFC 4122 UUIDv5, using the pilot organization as namespace. This gives
// stable pilot-owned paths across retries without reusing source object IDs.
export function destinationPath(kind, sourcePath) {
  assert.ok(["service", "category"].includes(kind));
  assert.match(sourcePath, managedPattern);
  assert.equal(sourcePath.split("/")[1], kind);
  const namespace = Buffer.from(PILOT.replaceAll("-", ""), "hex");
  const digest = createHash("sha1").update(namespace).update(kind + ":" + sourcePath).digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  const id = hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16)
    + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
  const extension = sourcePath.split(".").at(-1);
  const path = PILOT + "/" + kind + "/" + id + "." + extension;
  assert.match(path, destinationPattern);
  assert.notEqual(sourcePath.split("/")[2], path.split("/")[2]);
  return path;
}

export function identifyImage(bytes, extension) {
  if (bytes.length === 0 || bytes.length > MAX_BYTES) throw new Error("Invalid image size");
  const signature = bytes.subarray(0, 12);
  const jpeg = signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
  const png = signature.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp = signature.subarray(0, 4).toString() === "RIFF" && signature.subarray(8, 12).toString() === "WEBP";
  const actual = jpeg ? "image/jpeg" : png ? "image/png" : webp ? "image/webp" : null;
  if (!actual || actual !== mimeByExtension[extension]) throw new Error("Image signature/MIME mismatch");
  return actual;
}

function query(sql) {
  // Only fixed SELECT statements are passed to the linked staging inspector.
  assert.match(sql.trimStart().toLowerCase(), /^select /);
  const output = execFileSync("supabase", ["db", "query", "--linked", "--agent=yes", "--output", "json", sql], {
    cwd: ROOT, encoding: "utf8", maxBuffer: 5 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(output).rows;
}

function exactRows(actual, expected, fields) {
  assert.equal(actual.length, expected.length, "Manifest row count drift");
  const byKey = new Map(actual.map((row) => [row[fields[0]], row]));
  assert.equal(byKey.size, actual.length, "Duplicate mapping key");
  for (const row of expected) {
    const live = byKey.get(row[fields[0]]);
    assert.ok(live, "Missing mapping key " + row[fields[0]]);
    for (const field of fields) assert.equal(live[field], row[field], "Mapping drift: " + row[fields[0]] + "/" + field);
  }
}

function inspect(manifest) {
  const ref = readFileSync(join(ROOT, "supabase/.temp/project-ref"), "utf8").trim();
  assert.equal(ref, PROJECT, "Wrong linked Supabase project");
  const identities = query("select id,name,status from public.organizations where id in ('" + SOURCE + "','" + PILOT + "') order by id;");
  assert.equal(identities.length, 2, "Missing tenant");
  assert.equal(identities.find((r) => r.id === SOURCE)?.name, "EcoWash La Tejita");
  assert.equal(identities.find((r) => r.id === PILOT)?.name, "EcoWash La Tejita Tenerife");
  assert.ok(identities.every((r) => r.status === "active"), "Inactive source or destination tenant");
  const source = query("select id,code,portal_category_key,portal_image_path from public.services where organization_id='" + SOURCE + "' and is_active order by code;");
  const pilot = query("select id,organization_id,code,portal_category_key,portal_image_path,is_active from public.services where organization_id='" + PILOT + "' order by code;");
  const categories = query("select organization_id,category_key,image_path,is_active from public.organization_portal_categories where organization_id in ('" + SOURCE + "','" + PILOT + "') order by organization_id,category_key;");
  const objects = query("select name from storage.objects where bucket_id='" + BUCKET + "' and name like '" + PILOT + "/%' order by name;");
  const security = query("select (select count(*) from public.organization_memberships where organization_id='" + PILOT + "' and profile_id='" + OWNER_ID + "' and role='owner' and is_active) as active_owner, has_table_privilege('authenticated','public.services','UPDATE') as services_update, has_table_privilege('authenticated','public.organization_portal_categories','UPDATE') as categories_update, (select count(*) from storage.buckets where id='" + BUCKET + "' and public and file_size_limit=2097152) as bucket_ok;");
  const policies = query("select policyname,with_check from pg_policies where (schemaname='storage' and tablename='objects' and policyname='brand_media_insert_catalog_manager') or (schemaname='public' and tablename='services' and policyname='services_update_manager') or (schemaname='public' and tablename='organization_portal_categories' and policyname='organization_portal_categories_update_catalog_manager') order by policyname;");
  assert.equal(source.length, 219);
  assert.equal(pilot.length, 219);
  assert.equal(new Set(source.map((r) => r.code)).size, 219);
  assert.equal(new Set(pilot.map((r) => r.code)).size, 219);
  assert.equal(new Set(pilot.map((r) => r.id)).size, 219);
  const sourceIds = new Set(source.map((r) => r.id));
  assert.ok(pilot.every((r) => !sourceIds.has(r.id)), "Source service UUID reused");
  assert.ok(pilot.every((r) => r.is_active && r.organization_id === PILOT));
  exactRows(source.map((r) => ({ code: r.code, categoryKey: r.portal_category_key, sourcePath: r.portal_image_path })),
    manifest.services, ["code", "categoryKey", "sourcePath"]);
  const sourceApproved = categories.filter((r) => r.organization_id === SOURCE && KEYS.includes(r.category_key));
  exactRows(sourceApproved.map((r) => ({ key: r.category_key, sourcePath: r.image_path, isActive: r.is_active })),
    manifest.categories.map((r) => ({ ...r, isActive: true })), ["key", "sourcePath", "isActive"]);
  const pilotCategories = categories.filter((r) => r.organization_id === PILOT);
  assert.deepEqual(pilotCategories.map((r) => r.category_key).sort(), [...KEYS].sort());
  assert.ok(pilotCategories.every((r) => r.is_active));
  const sourceByCode = new Map(manifest.services.map((r) => [r.code, r]));
  for (const row of pilot) assert.equal(row.portal_category_key, sourceByCode.get(row.code)?.categoryKey);
  assert.equal(manifest.services.filter((r) => classification(r.sourcePath) === "managed").length, 179);
  assert.equal(manifest.services.filter((r) => classification(r.sourcePath) === "static").length, 40);
  assert.deepEqual(new Set(manifest.services.filter((r) => classification(r.sourcePath) === "static").map((r) => r.sourcePath)), staticPaths);
  assert.equal(manifest.categories.filter((r) => r.sourcePath !== null).length, 9);
  assert.equal(manifest.categories.find((r) => r.key === "home_textiles")?.sourcePath, null);
  assert.ok(!manifest.categories.some((r) => r.key === "special_services"));
  assert.equal(security[0].active_owner, 1);
  assert.equal(security[0].services_update, true);
  assert.equal(security[0].categories_update, true);
  assert.equal(security[0].bucket_ok, 1);
  assert.equal(policies.length, 3, "Required tenant policies missing");
  assert.ok(policies.find((r) => r.policyname === "brand_media_insert_catalog_manager")?.with_check.includes("owner = auth.uid()"));
  assert.ok(policies.find((r) => r.policyname === "brand_media_insert_catalog_manager")?.with_check.includes("app_brand_media_path_organization_id(name)"));
  assert.ok(policies.find((r) => r.policyname === "services_update_manager")?.with_check.includes("updated_by = auth.uid()"));
  assert.ok(policies.find((r) => r.policyname === "organization_portal_categories_update_catalog_manager")?.with_check.includes("has_organization_role"));
  return { pilot, pilotCategories, objects: objects.map((r) => r.name), security: security[0] };
}

async function fetchImage(path) {
  const response = await fetch(URL + "/storage/v1/object/public/" + BUCKET + "/" + path, { cache: "no-store" });
  if (!response.ok) throw new Error("Source or destination image unavailable: " + path + " HTTP " + response.status);
  const bytes = Buffer.from(await response.arrayBuffer());
  const extension = path.split(".").at(-1);
  const mime = identifyImage(bytes, extension);
  if (response.headers.get("content-type")?.split(";")[0] !== mime) throw new Error("Storage MIME mismatch: " + path);
  return { bytes, mime, sha256: sha256(bytes) };
}

async function verifyMedia(manifest, state) {
  const planned = new Map();
  for (const row of manifest.services) {
    if (classification(row.sourcePath) === "managed") planned.set(row.sourcePath, destinationPath("service", row.sourcePath));
  }
  for (const row of manifest.categories) {
    if (row.sourcePath) planned.set(row.sourcePath, destinationPath("category", row.sourcePath));
  }
  assert.equal(planned.size, 188, "Managed object count drift");
  assert.equal(new Set(planned.values()).size, 188, "Destination path collision");
  const sourceHashes = new Map();
  for (const [sourcePath, destination] of planned) {
    const source = await fetchImage(sourcePath);
    sourceHashes.set(sourcePath, { sha256: source.sha256, mime: source.mime, size: source.bytes.length });
    if (state.objects.includes(destination)) {
      const current = await fetchImage(destination);
      if (current.sha256 !== source.sha256 || current.mime !== source.mime) throw new Error("Conflicting destination object: " + destination);
    }
  }
  for (const path of staticPaths) {
    const file = realpathSync(join(ROOT, "public", path.slice(1)));
    assert.ok(file.startsWith(realpathSync(join(ROOT, "public")) + "/"), "Static path escape");
    assert.ok(existsSync(file));
    identifyImage(readFileSync(file), path.split(".").at(-1));
  }
  const plannedSet = new Set(planned.values());
  const unexpected = state.objects.filter((path) => !plannedSet.has(path));
  if (unexpected.length) throw new Error("Unapproved pilot Storage objects: " + unexpected.length);
  return { planned, sourceHashes, existingMatching: state.objects.length };
}

export function checkAssignments(manifest, state, planned) {
  const byCode = new Map(state.pilot.map((r) => [r.code, r]));
  for (const row of manifest.services) {
    const expected = classification(row.sourcePath) === "static" ? row.sourcePath : planned.get(row.sourcePath);
    const current = byCode.get(row.code);
    if (!current || (current.portal_image_path !== null && current.portal_image_path !== expected)) {
      throw new Error("Conflicting service association: " + row.code);
    }
  }
  const byKey = new Map(state.pilotCategories.map((r) => [r.category_key, r]));
  for (const row of manifest.categories) {
    const expected = row.sourcePath ? planned.get(row.sourcePath) : null;
    const current = byKey.get(row.key);
    if (!current || (current.image_path !== null && current.image_path !== expected)) {
      throw new Error("Conflicting category association: " + row.key);
    }
  }
}

export async function verifyFinalReadBack(
  manifest, state, planned, sourceHashes, readImage,
  expectedCodeUuidFingerprint = APPROVED_PILOT_CODE_UUID_SHA256,
) {
  assert.equal(state.pilot.length, 219, "Final service count differs");
  assert.equal(state.pilotCategories.length, 10, "Final category count differs");
  assert.equal(planned.size, 188, "Final planned copy count differs");
  assert.equal(state.objects.length, 188, "Final Storage object count differs");
  const expectedObjects = new Set(planned.values());
  assert.equal(expectedObjects.size, 188, "Duplicate planned destination");
  assert.deepEqual(new Set(state.objects), expectedObjects, "Missing or unexpected destination object");
  assert.equal(fingerprintCodeUuid(state.pilot.map((row) => [row.code, row.id])),
    expectedCodeUuidFingerprint, "Pilot code-to-UUID snapshot changed");
  const services = new Map(state.pilot.map((row) => [row.code, row]));
  assert.equal(services.size, 219, "Duplicate pilot service code");
  for (const row of manifest.services) {
    const current = services.get(row.code);
    const expected = classification(row.sourcePath) === "static" ? row.sourcePath : planned.get(row.sourcePath);
    assert.ok(current && current.organization_id === PILOT, "Foreign or missing pilot service");
    assert.equal(current.portal_category_key, row.categoryKey, "Service category changed: " + row.code);
    assert.equal(current.portal_image_path, expected, "Service image missing or changed: " + row.code);
  }
  const categories = new Map(state.pilotCategories.map((row) => [row.category_key, row]));
  assert.equal(categories.size, 10, "Duplicate pilot category key");
  for (const row of manifest.categories) {
    const current = categories.get(row.key);
    const expected = row.sourcePath ? planned.get(row.sourcePath) : null;
    assert.ok(current && current.organization_id === PILOT, "Foreign or missing pilot category");
    assert.equal(current.image_path, expected, "Category image missing or changed: " + row.key);
  }
  assert.equal(categories.get("home_textiles")?.image_path, null);
  for (const [sourcePath, destination] of planned) {
    const expected = sourceHashes.get(sourcePath);
    assert.ok(expected, "Missing approved source hash");
    const actual = await readImage(destination);
    assert.equal(actual.sha256, expected.sha256, "Destination SHA-256 mismatch: " + destination);
    assert.equal(actual.mime, expected.mime, "Destination MIME mismatch: " + destination);
    assert.equal(actual.bytes.length, expected.size, "Destination size mismatch: " + destination);
  }
  return { verifiedObjects: 188, verifiedServices: 219, verifiedCategories: 9 };
}

// A raw TTY reader never writes input bytes. readline.question echoes input
// itself even when the terminal ECHO flag is disabled, so it is unsafe here.
export function readSecretFromTTY(prompt = "Pilot Owner password (hidden): ", input = process.stdin, output = process.stdout) {
  if (!input.isTTY || typeof input.setRawMode !== "function") {
    throw new Error("Secure password entry requires an interactive TTY");
  }
  const wasRaw = Boolean(input.isRaw);
  return new Promise((resolve, reject) => {
    const bytes = [];
    let settled = false;
    const restore = () => {
      input.removeListener("data", onData);
      input.removeListener("error", onError);
      for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.removeListener(signal, onSignal);
      process.removeListener("exit", restoreRaw);
      input.setRawMode(wasRaw);
      input.pause();
      output.write("\n");
    };
    const restoreRaw = () => input.setRawMode(wasRaw);
    const finish = (error) => {
      if (settled) return;
      settled = true;
      let secret;
      if (!error) {
        const buffer = Buffer.from(bytes);
        secret = buffer.toString("utf8");
        buffer.fill(0);
      }
      bytes.fill(0);
      try {
        restore();
      } catch (restoreError) {
        reject(restoreError);
        return;
      }
      if (error) reject(error);
      else resolve(secret);
    };
    const onSignal = () => finish(new Error("Password entry interrupted"));
    const onError = () => finish(new Error("Password input failed"));
    const onData = (chunk) => {
      for (const byte of chunk) {
        if (byte === 3) return finish(new Error("Password entry interrupted")); // Ctrl-C in raw mode
        if (byte === 13 || byte === 10) return finish();
        if (byte === 127 || byte === 8) { // Backspace, including UTF-8 continuation bytes
          if (bytes.length) {
            bytes.pop();
            while (bytes.length && (bytes.at(-1) & 0xc0) === 0x80) bytes.pop();
          }
        } else if (byte >= 32 || byte === 9) {
          bytes.push(byte);
        }
      }
    };
    input.on("data", onData);
    input.on("error", onError);
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.once(signal, onSignal);
    process.once("exit", restoreRaw);
    try {
      input.setRawMode(true);
      output.write(prompt);
      input.resume();
    } catch {
      finish(new Error("Secure password prompt failed"));
    }
  });
}

async function ownerClient() {
  if (!process.stdin.isTTY) throw new Error("Owner authentication requires an interactive TTY");
  // Read only the public Supabase configuration. Never load the local
  // service-role key into this process or into the authenticated client.
  const publicConfig = {};
  for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
    const match = line.match(/^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY)=(.*)$/);
    if (match) publicConfig[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  assert.equal(publicConfig.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, ""), URL, "Wrong Supabase URL");
  const anonKey = publicConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  assert.ok(anonKey, "Missing public anon key");
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(URL, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let password = await readSecretFromTTY();
  let authResult;
  try {
    authResult = await client.auth.signInWithPassword({ email: OWNER_EMAIL, password });
  } finally {
    password = undefined;
  }
  const { data, error } = authResult;
  if (error || data.user?.id !== OWNER_ID || data.user?.email !== OWNER_EMAIL) throw new Error("Pilot Owner authentication failed");
  const membership = await client.from("organization_memberships")
    .select("id,organization_id,profile_id,role,is_active")
    .eq("organization_id", PILOT).eq("profile_id", OWNER_ID).eq("role", "owner").eq("is_active", true);
  if (membership.error || membership.data?.length !== 1) throw new Error("Pilot Owner membership unavailable");
  return client;
}

async function execute(manifest, state, verified, authorization) {
  assertExecutionAuthorization(authorization);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let response;
  try {
    response = await rl.question("Type COPY-188-ASSOCIATE-228 to execute the separately approved transfer: ");
  } finally {
    rl.close();
  }
  if (response !== "COPY-188-ASSOCIATE-228") throw new Error("Execution confirmation rejected");
  const client = await ownerClient();
  const progress = {
    verifiedObjects: 0, associatedServices: 0, associatedCategories: 0,
    lastVerifiedObject: null, lastAssociatedService: null, lastAssociatedCategory: null,
  };
  let completion;
  try {
    // Copy phase. Retry accepts only byte-identical existing objects; no upsert.
    for (const [sourcePath, destination] of verified.planned) {
      const source = await fetchImage(sourcePath);
      const approved = verified.sourceHashes.get(sourcePath);
      assert.equal(source.sha256, approved?.sha256, "Source changed during execution");
      const existing = state.objects.includes(destination);
      if (!existing) {
        const result = await client.storage.from(BUCKET).upload(destination, source.bytes, {
          contentType: source.mime, cacheControl: "31536000", upsert: false,
        });
        if (result.error) {
          const concurrent = await fetchImage(destination).catch(() => null);
          if (!concurrent || concurrent.sha256 !== source.sha256 || concurrent.mime !== source.mime) {
            throw new Error("Upload failed: " + destination);
          }
        }
      }
      const copied = await fetchImage(destination);
      if (copied.sha256 !== source.sha256 || copied.mime !== source.mime) throw new Error("Copy integrity failed: " + destination);
      progress.verifiedObjects += 1;
      progress.lastVerifiedObject = destination;
    }
    // Association phase starts only after all 188 destination bytes verify.
    const byCode = new Map(state.pilot.map((r) => [r.code, r]));
    for (const row of manifest.services) {
      const target = classification(row.sourcePath) === "static" ? row.sourcePath : verified.planned.get(row.sourcePath);
      if (byCode.get(row.code).portal_image_path !== target) {
        const result = await client.from("services").update({ portal_image_path: target, updated_by: OWNER_ID })
          .eq("organization_id", PILOT).eq("id", byCode.get(row.code).id).is("portal_image_path", null)
          .select("id,portal_image_path");
        if (result.error || result.data?.length !== 1 || result.data[0].portal_image_path !== target) {
          throw new Error("Service association failed: " + row.code);
        }
      }
      progress.associatedServices += 1;
      progress.lastAssociatedService = row.code;
    }
    for (const row of manifest.categories) {
      if (!row.sourcePath) continue;
      const target = verified.planned.get(row.sourcePath);
      const current = state.pilotCategories.find((r) => r.category_key === row.key);
      if (current.image_path !== target) {
        const result = await client.from("organization_portal_categories").update({ image_path: target })
          .eq("organization_id", PILOT).eq("category_key", row.key).is("image_path", null)
          .select("category_key,image_path");
        if (result.error || result.data?.length !== 1 || result.data[0].image_path !== target) {
          throw new Error("Category association failed: " + row.key);
        }
      }
      progress.associatedCategories += 1;
      progress.lastAssociatedCategory = row.key;
    }
    // An operation is not successful until a fresh, exact database/Storage
    // read-back verifies every association and all destination bytes.
    completion = await verifyFinalReadBack(manifest, inspect(manifest),
      verified.planned, verified.sourceHashes, fetchImage);
  } catch (error) {
    console.error(JSON.stringify({ status: "INCOMPLETE_EXECUTION", ...progress }));
    throw error;
  } finally {
    await client.auth.signOut();
  }
  return completion;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args[0] === "--dry-run" && (args.length === 1 || (args.length === 2 && args[1] === "--details"));
  const executeMode = args[0] === "--execute" && args.length === 3 && args[1] === "--authorization-id";
  if (!dryRun && !executeMode) throw new Error("Use --dry-run or --execute --authorization-id FUTURE_CTO_MISSION");
  if (executeMode) assertExecutionAuthorization(args[2]);
  if (executeMode && !process.stdin.isTTY) throw new Error("Execution requires an interactive TTY");
  const manifest = JSON.parse(readFileSync(join(ROOT, "scripts/pilot-catalog-media-002f.manifest.json"), "utf8"));
  assert.equal(manifest.sourceOrganizationId, SOURCE);
  assert.equal(manifest.destinationOrganizationId, PILOT);
  assert.deepEqual(manifest.categories.map((r) => r.key).sort(), [...KEYS].sort());
  const serviceFingerprint = fingerprintServices(manifest.services);
  const categoryFingerprint = fingerprintCategories(manifest.categories);
  assert.equal(serviceFingerprint, APPROVED_SERVICE_SHA256, "Frozen service manifest changed");
  assert.equal(categoryFingerprint, APPROVED_CATEGORY_SHA256, "Frozen category manifest changed");
  const state = inspect(manifest);
  const verified = await verifyMedia(manifest, state);
  checkAssignments(manifest, state, verified.planned);
  const mapping = state.pilot.map((r) => [r.code, r.id]);
  const mappingFingerprint = fingerprintCodeUuid(mapping);
  const bytesFingerprint = fingerprintSourceBytes(verified.sourceHashes.entries());
  assert.equal(mappingFingerprint, APPROVED_PILOT_CODE_UUID_SHA256, "Pilot code-to-UUID snapshot drift");
  assert.equal(bytesFingerprint, APPROVED_SOURCE_BYTES_SHA256, "Source byte snapshot drift");
  const report = {
    mode: dryRun ? "DRY_RUN_READ_ONLY" : "EXECUTE",
    project: PROJECT, sourceServices: manifest.services.length,
    destinationServices: state.pilot.length,
    sourceServiceFingerprint: serviceFingerprint,
    scopedCategoryFingerprint: categoryFingerprint,
    destinationCodeUuidFingerprint: mappingFingerprint,
    sourceBytesFingerprint: bytesFingerprint,
    managedServiceCopies: 179, staticServiceAssociations: 40,
    managedCategoryCopies: 9, managedCopies: verified.planned.size,
    serviceAssociations: 219, categoryAssociations: 9, totalAssociations: 228,
    sourceByteChecks: verified.sourceHashes.size,
    matchingDestinationObjects: verified.existingMatching,
    destinationPathCollisions: 0,
    ownerMembership: state.security.active_owner === 1,
    authenticatedTableUpdateGrants: state.security.services_update && state.security.categories_update,
  };
  if (dryRun && args[1] === "--details") {
    report.destinationCodeUuidMappings = mapping;
    report.sourceImageIntegrity = [...verified.sourceHashes.entries()].map(([path, value]) => ({ path, ...value }));
    report.plannedDestinationPaths = [...verified.planned.entries()];
  }
  if (dryRun) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    const completion = await execute(manifest, state, verified, args[2]);
    process.stdout.write(JSON.stringify({ status: "EXECUTION_VERIFIED_COMPLETE", ...completion }, null, 2) + "\n");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("STOP_REVIEW_REQUIRED:", error.message);
    process.exitCode = 1;
  });
}
