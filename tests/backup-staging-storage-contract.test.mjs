import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { captureInventory, compareInventories, request, REQUIRED_BUCKETS, runBackup } from "../scripts/backup-staging-storage.mjs";

const BUCKETS = [
  { id: "brand-media", name: "brand-media", public: true, allowed_mime_types: ["image/png"] },
  { id: "order-media", name: "order-media", public: false, allowed_mime_types: ["image/png"] },
  { id: "accounting-exports", name: "accounting-exports", public: false, allowed_mime_types: ["application/zip"] },
];
const LOCAL_URL = "https://mock.invalid";
const NO_DELAY = async () => {};
const GIT_INFO = () => "test";

function file(name, content = "contents", changes = {}) {
  return {
    name,
    id: `id-${name}`,
    updated_at: "2026-10-26T12:00:00Z",
    created_at: "2026-10-26T11:00:00Z",
    metadata: { size: Buffer.byteLength(content), eTag: `etag-${name}`, mimetype: "image/png" },
    ...changes,
  };
}

function fixtureFetch({ initial = {}, final = initial, initialBuckets = BUCKETS, finalBuckets = initialBuckets, payloads = {}, downloadResponse } = {}) {
  let phase = -1;
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const pathname = new URL(url).pathname;
    calls.push({ pathname, options });
    if (pathname === "/storage/v1/bucket") {
      phase += 1;
      return Response.json(phase === 0 ? initialBuckets : finalBuckets);
    }
    if (pathname.startsWith("/storage/v1/object/list/")) {
      const bucket = decodeURIComponent(pathname.split("/").at(-1));
      const { prefix, offset, limit } = JSON.parse(options.body);
      const source = phase === 0 ? initial : final;
      const entries = source[bucket]?.[prefix] ?? [];
      return Response.json(entries.slice(offset, offset + limit));
    }
    if (pathname.startsWith("/storage/v1/object/authenticated/")) {
      const segments = pathname.split("/").slice(5).map(decodeURIComponent);
      const [bucket, ...path] = segments;
      if (downloadResponse) return downloadResponse(bucket, path.join("/"));
      const content = payloads[`${bucket}/${path.join("/")}`] ?? "contents";
      return new Response(content, { headers: { etag: `etag-${path.at(-1)}`, "content-type": "image/png" } });
    }
    throw new Error("Unexpected mock request");
  };
  return { fetchImpl, calls };
}

function backupOptions(t, fetchImpl, pageSize = 2) {
  const backupRoot = mkdtempSync(join(tmpdir(), "phoenix-storage-contract-"));
  t.after(() => rmSync(backupRoot, { recursive: true, force: true }));
  return { backupRoot, supabaseUrl: LOCAL_URL, headers: {}, fetchImpl, gitInfo: GIT_INFO, pageSize, delay: NO_DELAY };
}

function backupDirectory(backupRoot) {
  const directories = readdirSync(backupRoot);
  assert.equal(directories.length, 1);
  return join(backupRoot, directories[0]);
}

function status(backupRoot) {
  return readFileSync(join(backupDirectory(backupRoot), "backup-status.txt"), "utf8");
}

test("exactly three required buckets and empty accounting bucket produce compatible complete artifacts", async (t) => {
  assert.deepEqual(REQUIRED_BUCKETS, ["brand-media", "order-media", "accounting-exports"]);
  const { fetchImpl, calls } = fixtureFetch({ initial: { "brand-media": { "": [file("logo.png")] } } });
  const options = backupOptions(t, fetchImpl);
  const result = await runBackup(options);
  assert.deepEqual(result.counts, { "brand-media": 1, "order-media": 0, "accounting-exports": 0 });
  assert.equal(calls.filter((call) => call.pathname === "/storage/v1/bucket").length, 2);
  for (const bucket of REQUIRED_BUCKETS) {
    assert.equal(calls.filter((call) => call.pathname.endsWith(`/list/${bucket}`)).length, 2);
  }
  assert.match(status(options.backupRoot), /^status=COMPLETE\n/);
  const directory = backupDirectory(options.backupRoot);
  const manifest = JSON.parse(readFileSync(join(directory, "objects-manifest.json"), "utf8"));
  assert.deepEqual(Object.keys(manifest[0]), ["bucket", "path", "bytes", "sha256", "contentType", "etag", "createdAt", "updatedAt"]);
  assert.equal(manifest[0].sha256, createHash("sha256").update("contents").digest("hex"));
  const metadata = readFileSync(join(directory, "backup-metadata.txt"), "utf8");
  assert.match(metadata, /buckets=brand-media,order-media,accounting-exports/);
  assert.match(metadata, /accounting-exports.objects=0\naccounting-exports.bytes=0\naccounting-exports.public=false/);
  assert.match(readFileSync(join(directory, "SHA256SUMS"), "utf8"), /objects-manifest\.json/);
  assert.equal(statSync(directory).mode & 0o777, 0o700);
  for (const name of ["backup-status.txt", "backup-metadata.txt", "objects-manifest.json", "SHA256SUMS", "objects/brand-media/logo.png"]) {
    assert.equal(statSync(join(directory, name)).mode & 0o777, 0o600);
  }
});

test("bucket privacy and accounting MIME mismatch leave checkpoint incomplete", async (t) => {
  for (const changes of [
    { id: "brand-media", public: false },
    { id: "order-media", public: true },
    { id: "accounting-exports", public: true },
    { id: "accounting-exports", allowed_mime_types: ["application/pdf"] },
  ]) {
    const definitions = BUCKETS.map((bucket) => bucket.id === changes.id ? { ...bucket, ...changes } : bucket);
    const { fetchImpl } = fixtureFetch({ initialBuckets: definitions });
    const options = backupOptions(t, fetchImpl);
    await assert.rejects(runBackup(options), /configuration differs/);
    assert.equal(status(options.backupRoot), "status=INCOMPLETE\n");
  }
});

test("paginated and reordered inventories compare equally; duplicate bucket/path is rejected", async () => {
  const initial = { "brand-media": { "": [file("b.png"), file("a.png"), file("c.png")] } };
  const reordered = { "brand-media": { "": [file("c.png"), file("b.png"), file("a.png")] } };
  const first = await captureInventory(fixtureFetch({ initial }).fetchImpl, LOCAL_URL, {}, 2, NO_DELAY);
  const second = await captureInventory(fixtureFetch({ initial: reordered }).fetchImpl, LOCAL_URL, {}, 2, NO_DELAY);
  assert.doesNotThrow(() => compareInventories(first, second));
  assert.deepEqual(first.objects.map((object) => object.path), ["a.png", "b.png", "c.png"]);
  const duplicate = { "brand-media": { "": [file("same.png"), file("same.png")] } };
  await assert.rejects(captureInventory(fixtureFetch({ initial: duplicate }).fetchImpl, LOCAL_URL, {}, 1, NO_DELAY), /duplicate bucket\/path/);
});

test("new, removed, overwritten, ID, timestamp, size, ETag and bucket changes fail final inventory", async (t) => {
  const before = { "brand-media": { "": [file("first.png"), file("second.png")] } };
  const variants = [
    { "brand-media": { "": [file("first.png"), file("second.png"), file("new.png")] } },
    { "brand-media": { "": [file("first.png")] } },
    { "brand-media": { "": [file("first.png", "contents", { id: "overwritten" }), file("second.png")] } },
    { "brand-media": { "": [file("first.png", "contents", { updated_at: "2026-10-26T13:00:00Z" }), file("second.png")] } },
    { "brand-media": { "": [file("first.png", "contents", { metadata: { size: 9, eTag: "etag-first.png" } }), file("second.png")] } },
    { "brand-media": { "": [file("first.png", "contents", { metadata: { size: 8, eTag: "changed" } }), file("second.png")] } },
    { "brand-media": { "": [file("first.png", "contents", { version: "new-version" }), file("second.png")] } },
  ];
  for (const final of variants) {
    const { fetchImpl } = fixtureFetch({ initial: before, final });
    const options = backupOptions(t, fetchImpl);
    await assert.rejects(runBackup(options), /inventory changed/);
    assert.equal(status(options.backupRoot), "status=INCOMPLETE\n");
  }
  const changedBuckets = BUCKETS.map((bucket) => bucket.id === "brand-media" ? { ...bucket, file_size_limit: 123 } : bucket);
  const { fetchImpl } = fixtureFetch({ initial: before, finalBuckets: changedBuckets });
  const options = backupOptions(t, fetchImpl);
  await assert.rejects(runBackup(options), /bucket definition changed/);
  assert.equal(status(options.backupRoot), "status=INCOMPLETE\n");
});

test("missing essential object metadata is NOT VERIFIED and never COMPLETE", async (t) => {
  for (const missing of [{ id: undefined }, { updated_at: undefined }, { metadata: {} }]) {
    const { fetchImpl } = fixtureFetch({ initial: { "brand-media": { "": [file("private-name.png", "contents", missing)] } } });
    const options = backupOptions(t, fetchImpl);
    await assert.rejects(runBackup(options), /NOT VERIFIED/);
    assert.equal(status(options.backupRoot), "status=INCOMPLETE\n");
  }
  const { fetchImpl } = fixtureFetch({
    initial: { "brand-media": { "": [file("private-name.png")] } },
    final: { "brand-media": { "": [file("private-name.png", "contents", { updated_at: undefined })] } },
  });
  const options = backupOptions(t, fetchImpl);
  await assert.rejects(runBackup(options), /NOT VERIFIED/);
  assert.equal(status(options.backupRoot), "status=INCOMPLETE\n");
});

test("network, 429 and 5xx retry; permanent 4xx do not retry or disclose response details", async () => {
  for (const transient of ["network", 429, 500, 503]) {
    let attempts = 0;
    const fetchImpl = async () => {
      attempts += 1;
      if (attempts === 1) {
        if (transient === "network") throw new Error("secret-token private/path signed-url");
        return new Response("secret-token private/path signed-url", { status: transient });
      }
      return new Response("ok");
    };
    assert.equal((await request(fetchImpl, LOCAL_URL, {}, "Object download", NO_DELAY)).status, 200);
    assert.equal(attempts, 2);
  }
  for (const permanent of [400, 401, 403, 404, 418]) {
    let attempts = 0;
    const fetchImpl = async () => {
      attempts += 1;
      return new Response("secret-token private/path signed-url", { status: permanent });
    };
    await assert.rejects(request(fetchImpl, LOCAL_URL, {}, "Object download", NO_DELAY), (error) => {
      assert.equal(error.message, `Object download: HTTP ${permanent}.`);
      return true;
    });
    assert.equal(attempts, 1);
  }
  await assert.rejects(request(async () => { throw new Error("secret-token private/path signed-url"); }, LOCAL_URL, {}, "Object download", NO_DELAY),
    (error) => error.message === "Object download: network failure.");
  await assert.rejects(request(async () => new Response("secret-token private/path", { status: 500 }), LOCAL_URL, {}, "Object download", NO_DELAY),
    (error) => error.message === "Object download: HTTP 500.");
});

test("download ETag mismatch leaves INCOMPLETE before final listing", async (t) => {
  const { fetchImpl, calls } = fixtureFetch({
    initial: { "brand-media": { "": [file("private-name.png")] } },
    downloadResponse: () => new Response("contents", { headers: { etag: "changed" } }),
  });
  const options = backupOptions(t, fetchImpl);
  await assert.rejects(runBackup(options), (error) => {
    assert.match(error.message, /Downloaded object differs/);
    assert.doesNotMatch(error.message, /private-name\.png/);
    return true;
  });
  assert.equal(status(options.backupRoot), "status=INCOMPLETE\n");
  assert.equal(calls.filter((call) => call.pathname === "/storage/v1/bucket").length, 1);
});

test("large object uses streamed SHA-256 and streamed local verification", async (t) => {
  const chunk = new Uint8Array(64 * 1024).fill(42);
  const chunkCount = 128;
  const expectedHash = createHash("sha256");
  for (let index = 0; index < chunkCount; index += 1) expectedHash.update(chunk);
  const largeFile = file("large.zip", "", { metadata: { size: chunk.length * chunkCount, eTag: "etag-large.zip", mimetype: "application/zip" } });
  const { fetchImpl } = fixtureFetch({
    initial: { "accounting-exports": { "": [largeFile] } },
    downloadResponse: () => {
      let emitted = 0;
      const stream = new ReadableStream({
        pull(controller) {
          if (emitted === chunkCount) controller.close();
          else {
            controller.enqueue(chunk);
            emitted += 1;
          }
        },
      });
      const response = new Response(stream, { headers: { etag: "etag-large.zip" } });
      response.arrayBuffer = () => { throw new Error("Whole-object buffer forbidden"); };
      return response;
    },
  });
  const options = backupOptions(t, fetchImpl);
  await runBackup(options);
  const directory = backupDirectory(options.backupRoot);
  const manifest = JSON.parse(readFileSync(join(directory, "objects-manifest.json"), "utf8"));
  assert.equal(manifest[0].bytes, chunk.length * chunkCount);
  assert.equal(manifest[0].sha256, expectedHash.digest("hex"));
  assert.match(status(options.backupRoot), /^status=COMPLETE/);
});

test("stream error preserves partial file and incomplete checkpoint", async (t) => {
  const { fetchImpl } = fixtureFetch({
    initial: { "brand-media": { "": [file("partial.png")] } },
    downloadResponse: () => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("part"));
        controller.error(new Error("secret-token private/path"));
      },
    })),
  });
  const options = backupOptions(t, fetchImpl);
  await assert.rejects(runBackup(options), (error) => {
    assert.equal(error.message, "Object stream or private file write failed; INCOMPLETE.");
    return true;
  });
  assert.equal(status(options.backupRoot), "status=INCOMPLETE\n");
  assert.equal(existsSync(join(backupDirectory(options.backupRoot), "objects/brand-media/partial.png")), true);
});
