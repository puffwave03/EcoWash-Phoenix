#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_PROJECT_REF = "exthnplfokcucaqydney";
const REQUIRED_BUCKETS = ["brand-media", "order-media"];
const PAGE_SIZE = 1000;
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LINKED_REF_FILE = join(REPOSITORY_ROOT, "supabase", ".temp", "project-ref");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) fail(`Required environment variable is unavailable: ${name}`);
  return value;
}

function safePathSegment(segment) {
  return (
    typeof segment === "string" &&
    segment.length > 0 &&
    segment !== "." &&
    segment !== ".." &&
    !segment.includes("/") &&
    !segment.includes("\\") &&
    !segment.includes("\0")
  );
}

function safeObjectPath(path) {
  const segments = path.split("/");
  return segments.length > 0 && segments.every(safePathSegment);
}

function encodeObjectPath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function checksumLine(hash, path) {
  if (path.includes("\n") || path.includes("\\")) {
    return `\\${hash}  ${path.replaceAll("\\", "\\\\").replaceAll("\n", "\\n")}`;
  }
  return `${hash}  ${path}`;
}

function git(command) {
  return execFileSync("git", ["-C", REPOSITORY_ROOT, ...command], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

async function request(url, options, label) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      const body = await response.text();
      const error = new Error(`${label} failed with HTTP ${response.status}: ${body.slice(0, 300)}`);
      if (response.status !== 429 && response.status < 500) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
    }
    if (attempt < 3) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 1000));
    }
  }
  throw lastError;
}

const args = process.argv.slice(2);
if (args.length !== 1 || !isAbsolute(args[0])) {
  fail("Usage: node --env-file=.env.local scripts/backup-staging-storage.mjs /absolute/path/to/secure-backup-root");
}

let linkedProjectRef;
try {
  linkedProjectRef = readFileSync(LINKED_REF_FILE, "utf8").trim();
} catch {
  fail("Supabase project is not linked; refusing to choose a target.");
}
if (linkedProjectRef !== EXPECTED_PROJECT_REF) {
  fail("Refusing backup: linked Supabase ref is not the approved staging target.");
}

const supabaseUrl = requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
const serviceRoleKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
let parsedSupabaseUrl;
try {
  parsedSupabaseUrl = new URL(supabaseUrl);
} catch {
  fail("NEXT_PUBLIC_SUPABASE_URL is not a valid URL.");
}
if (
  parsedSupabaseUrl.protocol !== "https:" ||
  parsedSupabaseUrl.hostname !== `${EXPECTED_PROJECT_REF}.supabase.co`
) {
  fail("Refusing backup: Supabase URL is not the approved staging target.");
}

const requestedBackupRoot = resolve(args[0]);
const relativeToRepository = relative(REPOSITORY_ROOT, requestedBackupRoot);
if (relativeToRepository === "" || (!relativeToRepository.startsWith(`..${sep}`) && relativeToRepository !== "..")) {
  fail("Backup root must be outside the repository.");
}

process.umask(0o077);
mkdirSync(requestedBackupRoot, { recursive: true, mode: 0o700 });
const backupRoot = realpathSync(requestedBackupRoot);
const resolvedRelativeToRepository = relative(REPOSITORY_ROOT, backupRoot);
if (
  resolvedRelativeToRepository === "" ||
  (!resolvedRelativeToRepository.startsWith(`..${sep}`) && resolvedRelativeToRepository !== "..")
) {
  fail("Backup root resolves inside the repository.");
}

const startedAt = new Date();
const timestamp = startedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const backupDirectory = join(
  backupRoot,
  `ecowash-phoenix-staging-storage-${EXPECTED_PROJECT_REF}-${timestamp}`,
);
mkdirSync(backupDirectory, { mode: 0o700 });
writeFileSync(join(backupDirectory, "backup-status.txt"), "status=INCOMPLETE\n", { mode: 0o600 });

const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
};

async function listBuckets() {
  const response = await request(`${supabaseUrl}/storage/v1/bucket`, { headers }, "Bucket listing");
  const buckets = await response.json();
  if (!Array.isArray(buckets)) throw new Error("Bucket listing returned an invalid payload.");
  return buckets;
}

async function listPrefix(bucket, prefix) {
  const entries = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const response = await request(
      `${supabaseUrl}/storage/v1/object/list/${encodeURIComponent(bucket)}`,
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          prefix,
          limit: PAGE_SIZE,
          offset,
          sortBy: { column: "name", order: "asc" },
        }),
      },
      `Object listing for ${bucket}/${prefix}`,
    );
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error(`Object listing for ${bucket}/${prefix} returned an invalid payload.`);
    entries.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return entries;
}

async function listObjectsRecursively(bucket, prefix = "") {
  const objects = [];
  const entries = await listPrefix(bucket, prefix);
  for (const entry of entries) {
    if (!safePathSegment(entry?.name)) {
      throw new Error(`Unsafe Storage path segment returned for bucket ${bucket}.`);
    }
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id === null || entry.id === undefined) {
      objects.push(...(await listObjectsRecursively(bucket, path)));
    } else {
      objects.push({ ...entry, path });
    }
  }
  return objects;
}

async function downloadObject(bucket, object) {
  if (!safeObjectPath(object.path)) throw new Error(`Unsafe object path returned for bucket ${bucket}.`);
  const response = await request(
    `${supabaseUrl}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${encodeObjectPath(object.path)}`,
    { headers },
    `Object download for ${bucket}/${object.path}`,
  );
  const buffer = Buffer.from(await response.arrayBuffer());
  const target = join(backupDirectory, "objects", bucket, ...object.path.split("/"));
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  writeFileSync(target, buffer, { mode: 0o600 });
  return {
    bucket,
    path: object.path,
    bytes: buffer.length,
    sha256: sha256(buffer),
    contentType: object.metadata?.mimetype ?? response.headers.get("content-type") ?? undefined,
    etag: object.metadata?.eTag ?? object.metadata?.etag ?? response.headers.get("etag") ?? undefined,
    createdAt: object.created_at ?? undefined,
    updatedAt: object.updated_at ?? undefined,
    lastAccessedAt: object.last_accessed_at ?? undefined,
  };
}

try {
  const bucketDefinitions = await listBuckets();
  const bucketById = new Map(bucketDefinitions.map((bucket) => [bucket.id, bucket]));
  for (const bucket of REQUIRED_BUCKETS) {
    if (!bucketById.has(bucket)) throw new Error(`Required staging bucket is unavailable: ${bucket}`);
  }

  const manifest = [];
  for (const bucket of REQUIRED_BUCKETS) {
    mkdirSync(join(backupDirectory, "objects", bucket), { recursive: true, mode: 0o700 });
    const objects = await listObjectsRecursively(bucket);
    objects.sort((left, right) => left.path.localeCompare(right.path));
    for (const object of objects) {
      manifest.push(await downloadObject(bucket, object));
    }
  }

  manifest.sort((left, right) => `${left.bucket}/${left.path}`.localeCompare(`${right.bucket}/${right.path}`));
  const manifestFile = join(backupDirectory, "objects-manifest.json");
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });

  const finishedAt = new Date();
  const counts = Object.fromEntries(
    REQUIRED_BUCKETS.map((bucket) => [bucket, manifest.filter((object) => object.bucket === bucket).length]),
  );
  const bytes = Object.fromEntries(
    REQUIRED_BUCKETS.map((bucket) => [
      bucket,
      manifest.filter((object) => object.bucket === bucket).reduce((sum, object) => sum + object.bytes, 0),
    ]),
  );
  const metadata = [
    "backup_task=BACKUP-DR-001B",
    `project_ref=${EXPECTED_PROJECT_REF}`,
    `started_at_utc=${startedAt.toISOString()}`,
    `finished_at_utc=${finishedAt.toISOString()}`,
    `duration_seconds=${Math.max(0, Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000))}`,
    `branch=${git(["branch", "--show-current"])}`,
    `head=${git(["rev-parse", "HEAD"])}`,
    `worktree=${git(["status", "--porcelain"]) ? "dirty" : "clean"}`,
    `buckets=${REQUIRED_BUCKETS.join(",")}`,
    `brand-media.objects=${counts["brand-media"]}`,
    `brand-media.bytes=${bytes["brand-media"]}`,
    `brand-media.public=${String(bucketById.get("brand-media")?.public === true)}`,
    `order-media.objects=${counts["order-media"]}`,
    `order-media.bytes=${bytes["order-media"]}`,
    `order-media.public=${String(bucketById.get("order-media")?.public === true)}`,
    `total.objects=${manifest.length}`,
    `total.bytes=${manifest.reduce((sum, object) => sum + object.bytes, 0)}`,
    "coverage=actual object bytes plus per-object path, byte size, content type, timestamps, and SHA-256",
    "excluded=Storage restore, database metadata restore, managed Auth, environment secrets, platform configuration, logs, PITR, retention deletion",
    "remote_mutation=none",
  ];
  const metadataFile = join(backupDirectory, "backup-metadata.txt");
  writeFileSync(metadataFile, `${metadata.join("\n")}\n`, { mode: 0o600 });

  const checksumEntries = [
    ...manifest.map((object) => ({
      path: `objects/${object.bucket}/${object.path}`,
      sha256: object.sha256,
    })),
    { path: "objects-manifest.json", sha256: sha256(readFileSync(manifestFile)) },
    { path: "backup-metadata.txt", sha256: sha256(readFileSync(metadataFile)) },
  ].sort((left, right) => left.path.localeCompare(right.path));
  const checksumFile = join(backupDirectory, "SHA256SUMS");
  writeFileSync(
    checksumFile,
    `${checksumEntries.map((entry) => checksumLine(entry.sha256, entry.path)).join("\n")}\n`,
    { mode: 0o600 },
  );

  for (const entry of checksumEntries) {
    const target = join(backupDirectory, ...entry.path.split("/"));
    if (!statSync(target).isFile() || sha256(readFileSync(target)) !== entry.sha256) {
      throw new Error(`Integrity verification failed for ${entry.path}`);
    }
  }

  writeFileSync(
    join(backupDirectory, "backup-status.txt"),
    `status=COMPLETE\nverified_files=${checksumEntries.length}\nverified_at_utc=${new Date().toISOString()}\n`,
    { mode: 0o600 },
  );
  chmodSync(backupDirectory, 0o700);

  console.log(`Staging Storage backup completed: ${backupDirectory}`);
  console.log(`Objects: brand-media=${counts["brand-media"]} order-media=${counts["order-media"]} total=${manifest.length}`);
  console.log(`Bytes: brand-media=${bytes["brand-media"]} order-media=${bytes["order-media"]} total=${manifest.reduce((sum, object) => sum + object.bytes, 0)}`);
  console.log(`SHA-256 verified files: ${checksumEntries.length}`);
} catch (error) {
  console.error(`Storage backup failed; incomplete artifacts were retained at: ${backupDirectory}`);
  throw error;
}
