#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, createReadStream, createWriteStream, mkdirSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const EXPECTED_PROJECT_REF = "exthnplfokcucaqydney";
export const REQUIRED_BUCKETS = ["brand-media", "order-media", "accounting-exports"];
const PAGE_SIZE = 1000;
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LINKED_REF_FILE = join(REPOSITORY_ROOT, "supabase", ".temp", "project-ref");

class BackupError extends Error {}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new BackupError(`Required environment variable is unavailable: ${name}`);
  return value;
}

function safePathSegment(segment) {
  return typeof segment === "string" && segment.length > 0 && segment !== "." && segment !== ".." &&
    !segment.includes("/") && !segment.includes("\\") && !segment.includes("\0");
}

function safeObjectPath(path) {
  return typeof path === "string" && path.split("/").every(safePathSegment);
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
    encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function lexicalCompare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

export async function request(fetchImpl, url, options, label, delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(url, options);
    } catch {
      if (attempt === 3) throw new BackupError(`${label}: network failure.`);
    }
    if (response) {
      if (response.ok) return response;
      if (response.status !== 429 && response.status < 500) throw new BackupError(`${label}: HTTP ${response.status}.`);
      if (attempt === 3) throw new BackupError(`${label}: HTTP ${response.status}.`);
    }
    await delay(attempt * 1000);
  }
  throw new BackupError(`${label}: request failed.`);
}

async function responseJson(response, label) {
  try {
    return await response.json();
  } catch {
    throw new BackupError(`${label}: invalid JSON response.`);
  }
}

function bucketDefinitions(buckets) {
  if (!Array.isArray(buckets)) throw new BackupError("Bucket listing returned an invalid payload.");
  const byId = new Map();
  for (const bucket of buckets) {
    if (typeof bucket?.id !== "string") throw new BackupError("Bucket listing returned an invalid definition.");
    if (byId.has(bucket.id)) throw new BackupError("Bucket listing contains duplicate definitions.");
    byId.set(bucket.id, bucket);
  }
  for (const bucketName of REQUIRED_BUCKETS) {
    const bucket = byId.get(bucketName);
    if (!bucket) throw new BackupError(`Required staging bucket is unavailable: ${bucketName}`);
    if (bucket.name !== bucketName || bucket.public !== (bucketName === "brand-media")) {
      throw new BackupError(`Required staging bucket configuration differs: ${bucketName}`);
    }
    if (bucketName === "accounting-exports" &&
      (!Array.isArray(bucket.allowed_mime_types) || bucket.allowed_mime_types.length !== 1 ||
        bucket.allowed_mime_types[0] !== "application/zip")) {
      throw new BackupError("Required staging bucket configuration differs: accounting-exports");
    }
  }
  return byId;
}

function objectSignature(object) {
  const size = object.metadata?.size;
  if (typeof object.id !== "string" || !object.id || typeof object.updated_at !== "string" || !object.updated_at ||
    typeof size !== "number" || !Number.isSafeInteger(size) || size < 0) {
    throw new BackupError("Storage inventory is missing essential object metadata; NOT VERIFIED.");
  }
  return {
    id: object.id, updatedAt: object.updated_at, size,
    etag: object.metadata?.eTag ?? object.metadata?.etag ?? null,
    version: object.version ?? object.metadata?.version ?? null,
  };
}

export function compareInventories(initial, final) {
  for (const bucketName of REQUIRED_BUCKETS) {
    if (JSON.stringify(stableValue(initial.buckets.get(bucketName))) !== JSON.stringify(stableValue(final.buckets.get(bucketName)))) {
      throw new BackupError("Storage bucket definition changed during backup; INCOMPLETE.");
    }
  }
  if (initial.objects.length !== final.objects.length) throw new BackupError("Storage inventory changed during backup; INCOMPLETE.");
  for (let index = 0; index < initial.objects.length; index += 1) {
    const before = initial.objects[index];
    const after = final.objects[index];
    if (before.bucket !== after.bucket || before.path !== after.path ||
      JSON.stringify(objectSignature(before)) !== JSON.stringify(objectSignature(after))) {
      throw new BackupError("Storage inventory changed during backup; INCOMPLETE.");
    }
  }
}

export async function captureInventory(fetchImpl, supabaseUrl, headers, pageSize = PAGE_SIZE, delay) {
  const bucketResponse = await request(fetchImpl, `${supabaseUrl}/storage/v1/bucket`, { headers }, "Bucket listing", delay);
  const buckets = bucketDefinitions(await responseJson(bucketResponse, "Bucket listing"));
  const objects = [];
  const seen = new Set();

  async function listPrefix(bucket, prefix) {
    for (let offset = 0; ; offset += pageSize) {
      const response = await request(fetchImpl, `${supabaseUrl}/storage/v1/object/list/${encodeURIComponent(bucket)}`, {
        method: "POST", headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ prefix, limit: pageSize, offset, sortBy: { column: "name", order: "asc" } }),
      }, "Object listing", delay);
      const page = await responseJson(response, "Object listing");
      if (!Array.isArray(page) || page.length > pageSize) throw new BackupError("Object listing returned an invalid payload.");
      for (const entry of page) {
        if (!safePathSegment(entry?.name)) throw new BackupError("Object listing returned an unsafe path.");
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        const key = JSON.stringify([bucket, path]);
        if (seen.has(key)) throw new BackupError("Object listing contains a duplicate bucket/path; INCOMPLETE.");
        seen.add(key);
        if (entry.id === null) await listPrefix(bucket, path);
        else {
          objectSignature(entry);
          objects.push({ ...entry, bucket, path });
        }
      }
      if (page.length < pageSize) break;
    }
  }

  for (const bucket of REQUIRED_BUCKETS) await listPrefix(bucket, "");
  objects.sort((left, right) => lexicalCompare(`${left.bucket}/${left.path}`, `${right.bucket}/${right.path}`));
  return { buckets, objects };
}

async function hashFile(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function downloadObject(fetchImpl, supabaseUrl, headers, backupDirectory, object, delay) {
  if (!safeObjectPath(object.path)) throw new BackupError("Object listing returned an unsafe path.");
  const response = await request(fetchImpl,
    `${supabaseUrl}/storage/v1/object/authenticated/${encodeURIComponent(object.bucket)}/${encodeObjectPath(object.path)}`,
    { headers }, "Object download", delay);
  if (!response.body) throw new BackupError("Object download returned no stream; INCOMPLETE.");
  const target = join(backupDirectory, "objects", object.bucket, ...object.path.split("/"));
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  const hash = createHash("sha256");
  let bytes = 0;
  const hashingStream = new Transform({
    transform(chunk, encoding, callback) {
      bytes += chunk.length;
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(response.body), hashingStream, createWriteStream(target, { flags: "wx", mode: 0o600 }));
  } catch {
    throw new BackupError("Object stream or private file write failed; INCOMPLETE.");
  }
  const signature = objectSignature(object);
  const responseEtag = response.headers.get("etag");
  if (bytes !== signature.size || (signature.etag && responseEtag && signature.etag !== responseEtag)) {
    throw new BackupError("Downloaded object differs from initial inventory; INCOMPLETE.");
  }
  return {
    bucket: object.bucket, path: object.path, bytes, sha256: hash.digest("hex"),
    contentType: object.metadata?.mimetype ?? response.headers.get("content-type") ?? undefined,
    etag: signature.etag ?? responseEtag ?? undefined,
    createdAt: object.created_at ?? undefined, updatedAt: object.updated_at,
    lastAccessedAt: object.last_accessed_at ?? undefined,
  };
}

export async function runBackup({ backupRoot, supabaseUrl, headers, fetchImpl, gitInfo = git, pageSize = PAGE_SIZE, delay }) {
  process.umask(0o077);
  mkdirSync(backupRoot, { recursive: true, mode: 0o700 });
  const secureRoot = realpathSync(backupRoot);
  if (!statSync(secureRoot).isDirectory() || (statSync(secureRoot).mode & 0o077) !== 0) {
    throw new BackupError("Backup root must be a private directory.");
  }
  const resolvedRelativeToRepository = relative(REPOSITORY_ROOT, secureRoot);
  if (resolvedRelativeToRepository === "" ||
    (!resolvedRelativeToRepository.startsWith(`..${sep}`) && resolvedRelativeToRepository !== "..")) {
    throw new BackupError("Backup root resolves inside the repository.");
  }
  const startedAt = new Date();
  const timestamp = startedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const backupDirectory = join(secureRoot, `ecowash-phoenix-staging-storage-${EXPECTED_PROJECT_REF}-${timestamp}`);
  mkdirSync(backupDirectory, { mode: 0o700 });
  writeFileSync(join(backupDirectory, "backup-status.txt"), "status=INCOMPLETE\n", { mode: 0o600 });

  const initial = await captureInventory(fetchImpl, supabaseUrl, headers, pageSize, delay);
  const manifest = [];
  for (const bucket of REQUIRED_BUCKETS) mkdirSync(join(backupDirectory, "objects", bucket), { recursive: true, mode: 0o700 });
  for (const object of initial.objects) manifest.push(await downloadObject(fetchImpl, supabaseUrl, headers, backupDirectory, object, delay));
  const manifestFile = join(backupDirectory, "objects-manifest.json");
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });

  const finishedAt = new Date();
  const counts = Object.fromEntries(REQUIRED_BUCKETS.map((bucket) => [bucket, manifest.filter((object) => object.bucket === bucket).length]));
  const bytes = Object.fromEntries(REQUIRED_BUCKETS.map((bucket) => [bucket,
    manifest.filter((object) => object.bucket === bucket).reduce((sum, object) => sum + object.bytes, 0)]));
  const metadata = [
    "backup_task=BACKUP-DR-001B", `project_ref=${EXPECTED_PROJECT_REF}`,
    `started_at_utc=${startedAt.toISOString()}`, `finished_at_utc=${finishedAt.toISOString()}`,
    `duration_seconds=${Math.max(0, Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000))}`,
    `branch=${gitInfo(["branch", "--show-current"])}`, `head=${gitInfo(["rev-parse", "HEAD"])}`,
    `worktree=${gitInfo(["status", "--porcelain"]) ? "dirty" : "clean"}`,
    `buckets=${REQUIRED_BUCKETS.join(",")}`,
    ...REQUIRED_BUCKETS.flatMap((bucket) => [
      `${bucket}.objects=${counts[bucket]}`, `${bucket}.bytes=${bytes[bucket]}`,
      `${bucket}.public=${String(initial.buckets.get(bucket).public)}`,
    ]),
    `total.objects=${manifest.length}`,
    `total.bytes=${manifest.reduce((sum, object) => sum + object.bytes, 0)}`,
    "coverage=actual object bytes plus per-object path, byte size, content type, timestamps, and SHA-256",
    "excluded=Storage restore, database metadata restore, managed Auth, environment secrets, platform configuration, logs, PITR, retention deletion",
    "remote_mutation=none",
  ];
  const metadataFile = join(backupDirectory, "backup-metadata.txt");
  writeFileSync(metadataFile, `${metadata.join("\n")}\n`, { mode: 0o600 });

  const checksumEntries = [
    ...manifest.map((object) => ({ path: `objects/${object.bucket}/${object.path}`, sha256: object.sha256 })),
    { path: "objects-manifest.json", sha256: sha256(readFileSync(manifestFile)) },
    { path: "backup-metadata.txt", sha256: sha256(readFileSync(metadataFile)) },
  ].sort((left, right) => lexicalCompare(left.path, right.path));
  writeFileSync(join(backupDirectory, "SHA256SUMS"),
    `${checksumEntries.map((entry) => checksumLine(entry.sha256, entry.path)).join("\n")}\n`, { mode: 0o600 });
  for (const entry of checksumEntries) {
    const target = join(backupDirectory, ...entry.path.split("/"));
    if (!statSync(target).isFile() || (await hashFile(target)) !== entry.sha256) {
      throw new BackupError("Local integrity verification failed; INCOMPLETE.");
    }
  }

  const final = await captureInventory(fetchImpl, supabaseUrl, headers, pageSize, delay);
  compareInventories(initial, final);
  chmodSync(backupDirectory, 0o700);
  const completedStatus = join(backupDirectory, "backup-status-complete.tmp");
  writeFileSync(completedStatus,
    `status=COMPLETE\nverified_files=${checksumEntries.length}\nverified_at_utc=${new Date().toISOString()}\n`, { mode: 0o600 });
  renameSync(completedStatus, join(backupDirectory, "backup-status.txt"));
  return {
    backupDirectory, counts, bytes, totalObjects: manifest.length,
    totalBytes: manifest.reduce((sum, object) => sum + object.bytes, 0), verifiedFiles: checksumEntries.length,
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !isAbsolute(args[0])) {
    throw new BackupError("Usage: node --env-file=.env.local scripts/backup-staging-storage.mjs /absolute/path/to/secure-backup-root");
  }
  let linkedProjectRef;
  try {
    linkedProjectRef = readFileSync(LINKED_REF_FILE, "utf8").trim();
  } catch {
    throw new BackupError("Supabase project is not linked; refusing to choose a target.");
  }
  if (linkedProjectRef !== EXPECTED_PROJECT_REF) throw new BackupError("Refusing backup: linked Supabase ref is not the approved staging target.");
  const supabaseUrl = requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
  let parsedSupabaseUrl;
  try {
    parsedSupabaseUrl = new URL(supabaseUrl);
  } catch {
    throw new BackupError("NEXT_PUBLIC_SUPABASE_URL is not a valid URL.");
  }
  if (parsedSupabaseUrl.protocol !== "https:" || parsedSupabaseUrl.hostname !== `${EXPECTED_PROJECT_REF}.supabase.co` ||
    parsedSupabaseUrl.port || parsedSupabaseUrl.username || parsedSupabaseUrl.password ||
    parsedSupabaseUrl.pathname !== "/" || parsedSupabaseUrl.search || parsedSupabaseUrl.hash) {
    throw new BackupError("Refusing backup: Supabase URL is not the approved staging target.");
  }
  const requestedBackupRoot = resolve(args[0]);
  const relativeToRepository = relative(REPOSITORY_ROOT, requestedBackupRoot);
  if (relativeToRepository === "" || (!relativeToRepository.startsWith(`..${sep}`) && relativeToRepository !== "..")) {
    throw new BackupError("Backup root must be outside the repository.");
  }
  const result = await runBackup({
    backupRoot: requestedBackupRoot, supabaseUrl,
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` }, fetchImpl: fetch,
  });
  console.log("Staging Storage backup completed.");
  console.log(`Objects: ${REQUIRED_BUCKETS.map((bucket) => `${bucket}=${result.counts[bucket]}`).join(" ")} total=${result.totalObjects}`);
  console.log(`Bytes: ${REQUIRED_BUCKETS.map((bucket) => `${bucket}=${result.bytes[bucket]}`).join(" ")} total=${result.totalBytes}`);
  console.log(`SHA-256 verified files: ${result.verifiedFiles}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof BackupError ? error.message : "Storage backup failed; private incomplete artifacts were retained.");
    process.exitCode = 1;
  }
}
