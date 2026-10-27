import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("../scripts/backup-staging-database.sh", import.meta.url));
const PROJECT_REF = "exthnplfokcucaqydney";
const FIXTURES = {
  roles: "-- PostgreSQL database dump\nCREATE ROLE synthetic_role;\nALTER ROLE synthetic_role WITH LOGIN;\n",
  schema: "-- PostgreSQL database dump\nCREATE TABLE public.synthetic (id integer);\nGRANT SELECT ON TABLE public.synthetic TO authenticated;\n",
  data: "-- PostgreSQL database dump\nCOPY public.synthetic (id) FROM stdin;\n1\n\\.\nSET statement_timeout = 0;\n",
};

function runBackup(testContext, replacements = {}, failedExport = "", fromDifferentDirectory = false) {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "phoenix-database-validation-"));
  testContext.after(() => rmSync(fixtureRoot, { recursive: true, force: true }));
  const scriptDirectory = join(fixtureRoot, "scripts");
  const refDirectory = join(fixtureRoot, "supabase", ".temp");
  const fixtureDirectory = join(fixtureRoot, "fixtures");
  const commandDirectory = join(fixtureRoot, "bin");
  for (const directory of [scriptDirectory, refDirectory, fixtureDirectory, commandDirectory]) {
    mkdirSync(directory, { recursive: true });
  }
  const scriptCopy = join(scriptDirectory, "backup-staging-database.sh");
  copyFileSync(SCRIPT, scriptCopy);
  writeFileSync(join(refDirectory, "project-ref"), PROJECT_REF);
  for (const kind of Object.keys(FIXTURES)) {
    writeFileSync(join(fixtureDirectory, `${kind}.sql`), replacements[kind] ?? FIXTURES[kind]);
  }
  writeFileSync(join(commandDirectory, "docker"), "#!/bin/sh\nif [ \"$1\" = version ]; then echo 'client=test server=test'; fi\n", { mode: 0o700 });
  writeFileSync(join(commandDirectory, "git"), "#!/bin/sh\ncase \"$*\" in\n  *branch*) echo main ;;\n  *rev-parse*) echo synthetic-head ;;\nesac\n", { mode: 0o700 });
  writeFileSync(join(commandDirectory, "supabase"), `#!/bin/sh
if [ "$1" = --version ]; then echo test; exit 0; fi
pwd -P >> "$DUMP_CWD_LOG"
kind=schema
for argument do
  case "$argument" in
    --role-only) kind=roles ;;
    --data-only) kind=data ;;
  esac
done
while [ "$#" -gt 0 ]; do
  if [ "$1" = --file ]; then shift; output="$1"; break; fi
  shift
done
cp "$FIXTURE_DIRECTORY/$kind.sql" "$output"
if [ "$FAILED_EXPORT" = "$kind" ]; then exit 41; fi
`, { mode: 0o700 });
  const backupParent = mkdtempSync(join(tmpdir(), "phoenix-database-validation-output-"));
  testContext.after(() => rmSync(backupParent, { recursive: true, force: true }));
  const invocationDirectory = join(backupParent, "other-project");
  if (fromDifferentDirectory) {
    const otherRefDirectory = join(invocationDirectory, "supabase", ".temp");
    mkdirSync(otherRefDirectory, { recursive: true });
    writeFileSync(join(otherRefDirectory, "project-ref"), "different-project-ref");
  }
  const backupRoot = join(backupParent, "backup");
  const dumpCwdLog = join(fixtureRoot, "dump-cwds.txt");
  const result = spawnSync("bash", [scriptCopy, backupRoot], {
    encoding: "utf8",
    timeout: 10000,
    cwd: fromDifferentDirectory ? invocationDirectory : undefined,
    env: {
      ...process.env,
      PATH: `${commandDirectory}:${process.env.PATH}`,
      FIXTURE_DIRECTORY: fixtureDirectory,
      FAILED_EXPORT: failedExport,
      DUMP_CWD_LOG: dumpCwdLog,
    },
  });
  const backupEntries = existsSync(backupRoot) ? readdirSync(backupRoot) : [];
  const backupDirectory = backupEntries.length === 1 ? join(backupRoot, backupEntries[0]) : null;
  if (backupDirectory) {
    for (const kind of Object.keys(FIXTURES)) {
      const artifact = join(backupDirectory, `${kind}.sql`);
      if (existsSync(artifact)) {
        assert.deepEqual(readFileSync(artifact), Buffer.from(replacements[kind] ?? FIXTURES[kind]));
      }
    }
  }
  const dumpWorkdirs = existsSync(dumpCwdLog) ? readFileSync(dumpCwdLog, "utf8").trim().split("\n") : [];
  return { result, backupDirectory, repositoryRoot: realpathSync(fixtureRoot), invocationDirectory, dumpWorkdirs };
}

function assertIncomplete(run) {
  assert.notEqual(run.result.status, 0);
  if (run.backupDirectory) {
    assert.equal(existsSync(join(run.backupDirectory, "backup-metadata.txt")), false);
    assert.equal(existsSync(join(run.backupDirectory, "SHA256SUMS")), false);
  }
}

function assertComplete(run) {
  assert.equal(run.result.status, 0, run.result.error?.message ?? run.result.stderr);
  assert.ok(run.backupDirectory);
  const metadataFile = join(run.backupDirectory, "backup-metadata.txt");
  const checksumFile = join(run.backupDirectory, "SHA256SUMS");
  assert.equal(existsSync(metadataFile), true);
  assert.equal(existsSync(checksumFile), true);
  assert.match(readFileSync(metadataFile, "utf8"), /project_ref=exthnplfokcucaqydney/);
  assert.equal(readFileSync(checksumFile, "utf8").trim().split("\n").length, 4);
  for (const file of ["roles.sql", "schema.sql", "data.sql", "backup-metadata.txt", "SHA256SUMS"]) {
    assert.equal(statSync(join(run.backupDirectory, file)).mode & 0o777, 0o600);
  }
}

test("valid roles, schema and data without optional trailer produce metadata and checksums", (testContext) => {
  assertComplete(runBackup(testContext));
});

test("all three dumps use the verified repository root from another linked project directory", (testContext) => {
  const run = runBackup(testContext, {}, "", true);
  assertComplete(run);
  assert.notEqual(realpathSync(run.invocationDirectory), run.repositoryRoot);
  assert.deepEqual(run.dumpWorkdirs, Array(3).fill(run.repositoryRoot));
});

test("valid roles, schema and data with optional trailer produce metadata and checksums", (testContext) => {
  const replacements = Object.fromEntries(
    Object.entries(FIXTURES).map(([kind, fixture]) => [kind, `${fixture}\\unrestrict synthetic-marker\n`]),
  );
  assertComplete(runBackup(testContext, replacements));
});

test("a data COPY terminator is accepted as the last SQL marker", (testContext) => {
  assertComplete(runBackup(testContext, { data: FIXTURES.data.replace("SET statement_timeout = 0;\n", "") }));
});

test("multiple balanced COPY sections remain valid", (testContext) => {
  const data = `${FIXTURES.data}COPY public.synthetic (id) FROM stdin;\n2\n\\.\n`;
  assertComplete(runBackup(testContext, { data }));
});

for (const [name, kind, content] of [
  ["role statements", "roles", "SET statement_timeout = 0;\n"],
  ["schema tables", "schema", "GRANT SELECT ON TABLE public.synthetic TO authenticated;\n"],
  ["schema grants", "schema", "CREATE TABLE public.synthetic (id integer);\n"],
  ["data COPY sections", "data", "SET statement_timeout = 0;\n"],
]) {
  test(`${kind} rejects missing ${name}`, (testContext) => {
    assertIncomplete(runBackup(testContext, { [kind]: content }));
  });
}

for (const kind of Object.keys(FIXTURES)) {
  test(`${kind} rejects an empty file`, (testContext) => {
    assertIncomplete(runBackup(testContext, { [kind]: "" }));
  });

  test(`${kind} rejects invalid UTF-8`, (testContext) => {
    assertIncomplete(runBackup(testContext, { [kind]: Buffer.concat([Buffer.from(FIXTURES[kind]), Buffer.from([0xff])]) }));
  });

  test(`${kind} rejects a truncated final statement`, (testContext) => {
    assertIncomplete(runBackup(testContext, { [kind]: `${FIXTURES[kind]}SET statement_timeout =` }));
  });

  test(`${kind} rejects a duplicated trailer`, (testContext) => {
    assertIncomplete(runBackup(testContext, { [kind]: `${FIXTURES[kind]}\\unrestrict marker\n\\unrestrict marker\n` }));
  });

  test(`${kind} stops after a failed export without publishing completion artifacts`, (testContext) => {
    assertIncomplete(runBackup(testContext, {}, kind));
  });
}

for (const [name, data] of [
  ["missing COPY terminator", FIXTURES.data.replace("\\.\n", "")],
  ["orphan COPY terminator", `${FIXTURES.data}\\.\n`],
  ["extra COPY terminator", `${FIXTURES.data}\\.\n\\.\n`],
  ["second COPY without terminator", `${FIXTURES.data}COPY public.synthetic (id) FROM stdin;\n2\n`],
]) {
  test(`data rejects ${name}`, (testContext) => {
    assertIncomplete(runBackup(testContext, { data }));
  });
}
