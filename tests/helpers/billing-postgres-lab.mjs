import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";

// Fixed local daemon, container, database AND Unix socket. No PG*/Supabase
// configuration, Docker context, TCP endpoint, container lifecycle or cleanup.
const daemon = "unix:///Users/cristianomegale/.docker/run/docker.sock";
const container = "phoenix-billing-pg-test-20261118";
const database = "phoenix_billing_test_001";
const args = ["--host", daemon, "exec", "-i", container, "env", "-i", "PATH=/usr/local/bin:/usr/bin:/bin",
  "psql", "-X", "-w", "-q", "-h", "/var/run/postgresql", "-p", "5432", "-U", "postgres", "-d", database,
  "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose", "-At"];
const prefix = "set statement_timeout = '15s'; set lock_timeout = '10s';\n";

export function openBillingPostgresLab() {
  assert.ok(process.argv.includes("--authorized-billing-lab"), "Explicit --authorized-billing-lab opt-in required");
  const inspected = spawnSync("docker", ["--host", daemon, "inspect", "--format", "{{.Name}}|{{.State.Running}}", container],
    { encoding: "utf8", timeout: 10000 });
  assert.equal(inspected.error, undefined);
  assert.equal(inspected.status, 0, inspected.stderr);
  assert.equal(inspected.stdout.trim(), `/${container}|true`);
  function query(sql) {
    const result = spawnSync("docker", args, { input: prefix + sql, encoding: "utf8", timeout: 30000 });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  }
  function concurrentQuery(sql) {
    return new Promise((accept, reject) => {
      const child = spawn("docker", args); let output = "", error = "";
      const timer = setTimeout(() => { child.kill(); reject(new Error("Local PostgreSQL test timed out")); }, 30000);
      child.stdout.on("data", (data) => { output += data; });
      child.stderr.on("data", (data) => { error += data; });
      child.on("error", (failure) => { clearTimeout(timer); reject(failure); });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) accept(output.trim()); else reject(new Error(error));
      });
      child.stdin.end(prefix + sql);
    });
  }
  assert.equal(query("select current_database() || '|' || current_user || '|' || (inet_server_addr() is null)::text;"),
    `${database}|postgres|true`);
  const objects = query(`select count(*) from pg_class relation join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname not like 'pg_%' and namespace.nspname <> 'information_schema';`);
  const functions = query(`select count(*) from pg_proc routine join pg_namespace namespace on namespace.oid = routine.pronamespace
    where namespace.nspname not like 'pg_%' and namespace.nspname <> 'information_schema';`);
  assert.equal(objects, "0", "BLOCKED: dedicated database is not empty; no cleanup is authorized");
  assert.equal(functions, "0", "BLOCKED: dedicated database contains functions to preserve");
  console.log(`PASS preflight: ${container}/${database}, local Unix socket, empty database`);
  return { query, concurrentQuery };
}
