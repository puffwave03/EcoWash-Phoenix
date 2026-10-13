import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  assertExecutionAuthorization, checkAssignments, classification, destinationPath,
  fingerprintCategories, fingerprintCodeUuid, fingerprintServices,
  fingerprintSourceBytes, identifyImage, verifyFinalReadBack,
} from "../scripts/pilot-catalog-media-002f.mjs";

const manifest = JSON.parse(readFileSync(
  new URL("../scripts/pilot-catalog-media-002f.manifest.json", import.meta.url), "utf8",
));

test("frozen scope and reproducible canonical fingerprints", () => {
  assert.equal(manifest.services.length, 219);
  assert.equal(new Set(manifest.services.map((row) => row.code)).size, 219);
  assert.equal(manifest.services.filter((row) => classification(row.sourcePath) === "managed").length, 179);
  assert.equal(manifest.services.filter((row) => classification(row.sourcePath) === "static").length, 40);
  assert.equal(manifest.categories.length, 10);
  assert.equal(manifest.categories.filter((row) => row.sourcePath !== null).length, 9);
  assert.equal(manifest.categories.find((row) => row.key === "home_textiles").sourcePath, null);
  assert.ok(!manifest.categories.some((row) => row.key === "special_services"));
  assert.equal(fingerprintServices(manifest.services),
    "c33ab5e4d21eef209d2953f443ba677b811c9134f34f2f8c22a631fb8c607433");
  assert.equal(fingerprintCategories(manifest.categories),
    "02ad070204c514f3f7d288d32539bf0070d37c2363db5ead170c722adeb2e284");
  assert.equal(fingerprintServices([...manifest.services].reverse()), fingerprintServices(manifest.services));
  assert.equal(fingerprintCategories([...manifest.categories].reverse()), fingerprintCategories(manifest.categories));
  const changed = structuredClone(manifest.services);
  changed[0].portal_category_key = "wrong";
  changed[0].categoryKey = "wrong";
  assert.notEqual(fingerprintServices(changed), fingerprintServices(manifest.services));
});

test("destination paths are pilot-owned, deterministic, unique and reject foreign paths", () => {
  const managed = manifest.services.filter((row) => classification(row.sourcePath) === "managed");
  const paths = managed.map((row) => destinationPath("service", row.sourcePath));
  assert.equal(new Set(paths).size, 179);
  assert.ok(paths.every((path) => path.startsWith(manifest.destinationOrganizationId + "/service/")));
  assert.equal(paths[0], destinationPath("service", managed[0].sourcePath));
  assert.throws(() => destinationPath("service", "foreign/service/asset.webp"));
  assert.throws(() => classification("e09f1e0b-1c4d-4450-9a30-79999bee545a/category/../../x.webp"));
  assert.throws(() => classification("/images/../../secret.webp"));
});

test("image signatures and 2 MB limit are enforced", () => {
  assert.equal(identifyImage(Buffer.from("RIFF0000WEBP", "ascii"), "webp"), "image/webp");
  assert.equal(identifyImage(Buffer.from([0xff, 0xd8, 0xff, 0]), "jpg"), "image/jpeg");
  assert.equal(identifyImage(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), "png"), "image/png");
  assert.throws(() => identifyImage(Buffer.from("not an image"), "webp"));
  assert.throws(() => identifyImage(Buffer.from("RIFF0000WEBP", "ascii"), "png"));
  assert.throws(() => identifyImage(Buffer.alloc(2 * 1024 * 1024 + 1), "webp"));
});

test("association preflight accepts retries but rejects conflicting existing paths", () => {
  const services = manifest.services.slice(0, 2);
  const categories = manifest.categories.filter((row) => row.sourcePath !== null).slice(0, 1);
  const scoped = { services, categories };
  const planned = new Map([...services, ...categories]
    .filter((row) => row.sourcePath && classification(row.sourcePath) === "managed")
    .map((row) => [row.sourcePath, destinationPath("key" in row ? "category" : "service", row.sourcePath)]));
  const state = {
    pilot: services.map((row, i) => ({
      code: row.code, id: String(i), portal_image_path: null,
    })),
    pilotCategories: [{ category_key: categories[0].key, image_path: null }],
  };
  assert.doesNotThrow(() => checkAssignments(scoped, state, planned));
  state.pilot[0].portal_image_path = classification(services[0].sourcePath) === "static"
    ? services[0].sourcePath : planned.get(services[0].sourcePath);
  state.pilotCategories[0].image_path = planned.get(categories[0].sourcePath);
  assert.doesNotThrow(() => checkAssignments(scoped, state, planned));
  state.pilot[0].portal_image_path = "foreign/service/image.webp";
  assert.throws(() => checkAssignments(scoped, state, planned), /Conflicting service association/);
  state.pilot[0].portal_image_path = null;
  state.pilotCategories[0].image_path = "foreign/category/image.webp";
  assert.throws(() => checkAssignments(scoped, state, planned), /Conflicting category association/);
});

test("execution authorization fails closed for arbitrary and syntactically valid IDs", () => {
  assert.throws(() => assertExecutionAuthorization("ECOWASH-PILOT-CATALOG-MEDIA-002G"), /Execution disabled/);
  assert.throws(() => assertExecutionAuthorization("anything"), /Execution disabled/);
  assert.doesNotThrow(() => assertExecutionAuthorization("EXACT-FUTURE-ID", "EXACT-FUTURE-ID"));
  assert.throws(() => assertExecutionAuthorization("WRONG", "EXACT-FUTURE-ID"), /Execution disabled/);
  const command = spawnSync("node", [
    "scripts/pilot-catalog-media-002f.mjs", "--execute",
    "--authorization-id", "ECOWASH-PILOT-CATALOG-MEDIA-002G",
  ], { cwd: new URL("..", import.meta.url), encoding: "utf8" });
  assert.equal(command.status, 1);
  assert.match(command.stderr, /Execution disabled/);
  assert.doesNotMatch(command.stdout, /EXECUTION_VERIFIED_COMPLETE/);
});

test("snapshot fingerprints change on byte or code-to-UUID drift", () => {
  const mappings = [["A", "uuid-a"], ["B", "uuid-b"]];
  assert.equal(fingerprintCodeUuid(mappings), fingerprintCodeUuid([...mappings].reverse()));
  assert.notEqual(fingerprintCodeUuid(mappings), fingerprintCodeUuid([["A", "uuid-x"], ["B", "uuid-b"]]));
  const objects = [["path-a", { size: 3, mime: "image/png", sha256: "hash-a" }]];
  assert.notEqual(fingerprintSourceBytes(objects),
    fingerprintSourceBytes([["path-a", { size: 3, mime: "image/png", sha256: "hash-b" }]]));
});

function completeFixture() {
  const planned = new Map();
  for (const row of manifest.services) {
    if (classification(row.sourcePath) === "managed") {
      planned.set(row.sourcePath, destinationPath("service", row.sourcePath));
    }
  }
  for (const row of manifest.categories) {
    if (row.sourcePath) planned.set(row.sourcePath, destinationPath("category", row.sourcePath));
  }
  const state = {
    objects: [...planned.values()],
    pilot: manifest.services.map((row, i) => ({
      id: "synthetic-" + i,
      code: row.code,
      organization_id: manifest.destinationOrganizationId,
      portal_category_key: row.categoryKey,
      portal_image_path: classification(row.sourcePath) === "static"
        ? row.sourcePath : planned.get(row.sourcePath),
    })),
    pilotCategories: manifest.categories.map((row) => ({
      category_key: row.key,
      organization_id: manifest.destinationOrganizationId,
      image_path: row.sourcePath ? planned.get(row.sourcePath) : null,
    })),
  };
  const sourceHashes = new Map([...planned.keys()].map((path) => [
    path, { sha256: "approved-hash", mime: "image/webp", size: 4 },
  ]));
  const readImage = async () => ({
    sha256: "approved-hash", mime: "image/webp", bytes: Buffer.alloc(4),
  });
  const mappingHash = fingerprintCodeUuid(state.pilot.map((row) => [row.code, row.id]));
  return { planned, state, sourceHashes, readImage, mappingHash };
}

test("final read-back requires every object, association, owner and hash", async () => {
  const fixture = completeFixture();
  assert.deepEqual(await verifyFinalReadBack(manifest, fixture.state, fixture.planned,
    fixture.sourceHashes, fixture.readImage, fixture.mappingHash),
  { verifiedObjects: 188, verifiedServices: 219, verifiedCategories: 9 });
  await assert.rejects(verifyFinalReadBack(manifest, fixture.state, fixture.planned,
    fixture.sourceHashes, fixture.readImage), /snapshot changed/);
  const missingObject = structuredClone(fixture.state);
  missingObject.objects.pop();
  await assert.rejects(verifyFinalReadBack(manifest, missingObject, fixture.planned,
    fixture.sourceHashes, fixture.readImage, fixture.mappingHash), /object count differs/);
  const unexpectedObject = structuredClone(fixture.state);
  unexpectedObject.objects[0] = "foreign/service/other.webp";
  await assert.rejects(verifyFinalReadBack(manifest, unexpectedObject, fixture.planned,
    fixture.sourceHashes, fixture.readImage, fixture.mappingHash), /unexpected destination object/);
  const wrongService = structuredClone(fixture.state);
  wrongService.pilot[0].portal_image_path = null;
  await assert.rejects(verifyFinalReadBack(manifest, wrongService, fixture.planned,
    fixture.sourceHashes, fixture.readImage, fixture.mappingHash), /Service image missing/);
  const wrongOwner = structuredClone(fixture.state);
  wrongOwner.pilot[0].organization_id = "foreign";
  await assert.rejects(verifyFinalReadBack(manifest, wrongOwner, fixture.planned,
    fixture.sourceHashes, fixture.readImage, fixture.mappingHash), /Foreign or missing pilot service/);
  const wrongCategory = structuredClone(fixture.state);
  wrongCategory.pilotCategories.find((row) => row.category_key === "home_textiles").image_path = "unexpected";
  await assert.rejects(verifyFinalReadBack(manifest, wrongCategory, fixture.planned,
    fixture.sourceHashes, fixture.readImage, fixture.mappingHash), /Category image missing/);
  await assert.rejects(verifyFinalReadBack(manifest, fixture.state, fixture.planned,
    fixture.sourceHashes, async () => ({
      sha256: "changed", mime: "image/webp", bytes: Buffer.alloc(4),
    }), fixture.mappingHash), /SHA-256 mismatch/);
  await assert.rejects(verifyFinalReadBack(manifest, fixture.state, fixture.planned,
    fixture.sourceHashes, async () => ({
      sha256: "approved-hash", mime: "image/png", bytes: Buffer.alloc(4),
    }), fixture.mappingHash), /MIME mismatch/);
});

test("raw TTY password prompt never echoes dummy input and restores echo", () => {
  const javascript = [
    "import { readSecretFromTTY } from './scripts/pilot-catalog-media-002f.mjs';",
    "try { const value = await readSecretFromTTY('Secret: ');",
    "process.stdout.write('LENGTH:' + value.length + '\\n'); }",
    "catch { process.stdout.write('INTERRUPTED\\n'); process.exitCode = 3; }",
  ].join(" ");
  const python = [
    "import os,pty,select,subprocess,sys,termios,time",
    "for payload,expected in [(b'DUMMY_NOT_REAL_PASSWORD_002F\\r',0),(b'\\x03',3)]:",
    " master,slave=pty.openpty()",
    " proc=subprocess.Popen(['node','--input-type=module','-e',sys.argv[1]],stdin=slave,stdout=slave,stderr=slave)",
    " output=b''",
    " deadline=time.time()+8",
    " while b'Secret: ' not in output and time.time()<deadline:",
    "  ready,_,_=select.select([master],[],[],0.1)",
    "  if ready: output+=os.read(master,4096)",
    " assert b'Secret: ' in output,'prompt missing'",
    " os.write(master,payload)",
    " while proc.poll() is None and time.time()<deadline:",
    "  ready,_,_=select.select([master],[],[],0.1)",
    "  if ready: output+=os.read(master,4096)",
    " assert proc.wait(timeout=2)==expected,'unexpected child exit'",
    " assert b'DUMMY_NOT_REAL_PASSWORD_002F' not in output,'password echoed'",
    " assert termios.tcgetattr(slave)[3]&termios.ECHO,'terminal echo not restored'",
    " os.close(master);os.close(slave)",
  ].join("\n");
  const result = spawnSync("python3", ["-c", python, javascript], {
    cwd: new URL("..", import.meta.url), encoding: "utf8", timeout: 20000,
  });
  assert.equal(result.status, 0, result.stderr || "Pseudo-terminal security test failed");
});
