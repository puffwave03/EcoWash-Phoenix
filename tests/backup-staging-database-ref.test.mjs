import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("../scripts/backup-staging-database.sh", import.meta.url));
const EXPECTED_REF = "exthnplfokcucaqydney";

function runWithRef(testContext, refContent) {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "phoenix-database-ref-"));
  testContext.after(() => rmSync(fixtureRoot, { recursive: true, force: true }));
  const scriptDirectory = join(fixtureRoot, "scripts");
  const refDirectory = join(fixtureRoot, "supabase", ".temp");
  const commandDirectory = join(fixtureRoot, "bin");
  mkdirSync(scriptDirectory);
  mkdirSync(refDirectory, { recursive: true });
  mkdirSync(commandDirectory);
  const scriptCopy = join(scriptDirectory, "backup-staging-database.sh");
  copyFileSync(SCRIPT, scriptCopy);
  if (refContent !== null) writeFileSync(join(refDirectory, "project-ref"), refContent);
  for (const command of ["docker", "git", "iconv", "shasum", "supabase"]) {
    writeFileSync(join(commandDirectory, command), `#!/bin/sh\nexit ${command === "docker" ? 77 : 78}\n`, { mode: 0o700 });
  }
  const backupRoot = join(fixtureRoot, "backup");
  const result = spawnSync("bash", [scriptCopy, backupRoot], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${commandDirectory}:${process.env.PATH}` },
  });
  assert.equal(existsSync(backupRoot), false);
  return result;
}

test("staging ref without a trailing newline reaches only the Docker stub", (testContext) => {
  const result = runWithRef(testContext, EXPECTED_REF);
  assert.equal(result.status, 77);
});

test("staging ref with one trailing newline reaches only the Docker stub", (testContext) => {
  const result = runWithRef(testContext, `${EXPECTED_REF}\n`);
  assert.equal(result.status, 77);
});

for (const [name, refContent] of [
  ["empty ref", ""],
  ["different ref", "different-project-ref"],
  ["additional data", `${EXPECTED_REF}\nother-project`],
  ["multiple trailing newlines", `${EXPECTED_REF}\n\n`],
  ["missing ref file", null],
]) {
  test(`${name} is rejected before Docker`, (testContext) => {
    const result = runWithRef(testContext, refContent);
    assert.equal(result.status, 1);
  });
}
