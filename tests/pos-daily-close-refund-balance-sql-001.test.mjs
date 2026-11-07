import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { isAbsolute } from "node:path";
import test from "node:test";
import { buildAccountingSummary } from "../src/features/accounting/summary.ts";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migrationPath = "supabase/migrations/20261107113342_pos_daily_close_refund_balance_001.sql";
const migration = read(migrationPath);
const historical = read("supabase/migrations/20260920000200_portal_after_close_intake_001.sql");
const definition = sql => sql.match(/create or replace function public\.calculate_daily_close_snapshot\([\s\S]*?\$\$;/)[0];
const original = definition(historical);
const replacement = definition(migration);
const signature = "public.calculate_daily_close_snapshot(uuid,date,uuid,text,timestamptz,timestamptz,text)";
const closeDefinition = sql => sql.match(/create(?: or replace)? function public\.close_daily_close\([\s\S]*?\$\$;/)[0];
const originalClose = closeDefinition(read("supabase/migrations/20260919000200_pos_daily_close_001_p2a.sql"));
const replacementClose = closeDefinition(migration);
const closeSignature = "public.close_daily_close(date,uuid,text,uuid)";
const correction = `${replacement}\n${replacementClose}`;
const body = sql => sql.split("as $$\n")[1].split("$$;")[0].trim();

test("incremental migration changes only lifetime receivables and calculation provenance", () => {
  const balances = original.split("sales_balances as (")[1].split("period_payments as (")[0];
  const corrected = balances
    .replace("select sum(payment.amount)", "select sum(case when payment.status = 'refunded' then -payment.amount else payment.amount end)")
    .replace("and payment.status = 'confirmed'", "and payment.status in ('confirmed', 'refunded')");
  assert.equal(replacement, original.replace(balances, corrected).replace("'calculationVersion', 'pos-daily-close-p2a-v1'", "'calculationVersion', 'pos-daily-close-p2a-v2'"));
  assert.doesNotMatch(corrected, /paid_at|target_day_start|target_day_end_exclusive/);
  assert.match(corrected, /payment.organization_id = target_organization_id/);
  assert.match(corrected, /payment.order_id = sales.id/);
  assert.match(migration, /^begin;$/m); assert.match(migration, /^commit;$/m);
  const remainder = migration.replace(replacement, "").replace(replacementClose, "").replace(/--[^\n]*/g, "").replace(/\b(begin|commit);/gi, "");
  assert.equal(remainder.trim(), "", "no other SQL, DML, grants, tables or functions");
  assert.match(replacement, /language sql\nstable\nsecurity definer\nset search_path = public/);
});

test("close RPC preserves its original body except new version and stored-version replay hashing", () => {
  const compatibility = "    -- A replay retains the calculation version used by the original close.\n    -- All client-request semantics remain in the fingerprint; new closes use v2.\n    request_hash := encode(extensions.digest(\n      jsonb_set(semantic_request, '{calculationVersion}', to_jsonb(existing_close.calculation_version))::text,\n      'sha256'\n    ), 'hex');\n";
  const expected = originalClose.replace("create function", "create or replace function")
    .replaceAll("pos-daily-close-p2a-v1", "pos-daily-close-p2a-v2")
    .replace("  if existing_close.id is not null then\n", `  if existing_close.id is not null then\n${compatibility}`);
  assert.equal(replacementClose, expected, "authorization, locks, blockers, insert and conflict checks unchanged");
});

function validateTarget(lab, container, endpoint) {
  assert.ok(isAbsolute(lab) && !lab.startsWith("//"), "Explicit absolute local lab path required");
  assert.match(container, /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/);
  assert.match(endpoint, /^unix:\/\/\/[^\s]+$/, "Remote Docker endpoints are forbidden");
}

test("SQL runtime requires explicit local opt-in and rejects remote targets", () => {
  validateTarget("/Volumes/DEV/local-lab", "local-db", "unix:///var/run/docker.sock");
  for (const endpoint of ["tcp://127.0.0.1:2375", "ssh://remote", "https://remote", ""]) {
    assert.throws(() => validateTarget("/tmp/lab", "local-db", endpoint));
  }
  assert.throws(() => validateTarget("//remote/lab", "local-db", "unix:///tmp/docker.sock"));
  assert.throws(() => validateTarget("/tmp/lab", "--host", "unix:///tmp/docker.sock"));
});

// Opt in only to the existing, identified Supabase laboratory. No Docker
// lifecycle command, migration-ledger write or remote connection is used.
test("canonical local Supabase: actual snapshot / TypeScript parity and complete rollback", {
  skip: process.env.PHOENIX_DAILY_CLOSE_SQL_LAB ? false : "SQL_NOT_EXECUTED: select the authorized local lab explicitly",
  timeout: 180000,
}, async t => {
  const lab = process.env.PHOENIX_DAILY_CLOSE_SQL_LAB;
  const container = process.env.PHOENIX_DAILY_CLOSE_SQL_CONTAINER || "supabase_db_phoenix-financial-guard-2a-local-001";
  let endpoint = process.env.DOCKER_HOST;
  if (!endpoint) {
    const context = spawnSync("docker", ["context", "inspect", "--format", "{{json .Endpoints.docker.Host}}"], { encoding: "utf8", timeout: 10000 });
    assert.ifError(context.error); assert.equal(context.status, 0, context.stderr);
    endpoint = JSON.parse(context.stdout);
  }
  validateTarget(lab, container, endpoint);
  const docker = ["--host", endpoint];
  const inspected = spawnSync("docker", [...docker, "inspect", "--format", "{{json .NetworkSettings.Ports}}", container], { encoding: "utf8", timeout: 10000 });
  assert.ifError(inspected.error); assert.equal(inspected.status, 0, inspected.stderr);
  const ports = JSON.parse(inspected.stdout)["5432/tcp"];
  assert.ok(ports?.length && ports.every(p => ["127.0.0.1", "::1"].includes(p.HostIp) && p.HostPort === "56322"));
  const fixture = JSON.parse(readFileSync(`${lab}/runtime-evidence/fixture-manifest.json`, "utf8"));
  for (const id of Object.values(fixture)) assert.match(id, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
  const args = [...docker, "exec", "-i", "--user", "postgres", container, "env",
    ...["PGHOST", "PGHOSTADDR", "PGPORT", "PGPASSWORD", "PGSERVICE", "PGSERVICEFILE", "PGOPTIONS", "PGPASSFILE"].flatMap(key => ["-u", key]),
    "psql", "-X", "-qAt", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"];
  const sql = input => {
    const result = spawnSync("docker", args, { input, encoding: "utf8", timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
    assert.ifError(result.error); assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  assert.equal(sql("select current_database()||'/'||current_setting('server_version')||'/'||(select count(*) from supabase_migrations.schema_migrations);"), "postgres/17.6/112");
  assert.equal(sql(`select slug from public.organizations where id='${fixture.org}';`), "fg2a-canonical-runtime");
  assert.equal(sql(`select prosrc from pg_proc where oid='${signature}'::regprocedure;`), body(original));
  assert.equal(sql(`select prosrc from pg_proc where oid='${closeSignature}'::regprocedure;`), body(originalClose));

  // Known schema lag is deliberately NOT applied. These four later migrations
  // change Terminal/Billing writers, not this read model or its table columns.
  const applied = sql("select version from supabase_migrations.schema_migrations order by version;").split("\n");
  const tracked = spawnSync("git", ["ls-tree", "-r", "--name-only", "HEAD", "supabase/migrations"], { encoding: "utf8" });
  assert.equal(tracked.status, 0, tracked.stderr);
  const missing = tracked.stdout.trim().split("\n").filter(path => path !== migrationPath && !applied.includes(path.split("/").at(-1).split("_")[0]));
  assert.deepEqual(missing.map(path => path.split("/").at(-1)), [
    "20261029224950_terminal_counter_order_received_001.sql", "20261030135502_pos_advance_ux_001.sql",
    "20261106115208_billing_simplified_postservice_001.sql", "20261106195446_restore_operational_documents_001.sql",
  ]);
  for (const path of missing) {
    assert.doesNotMatch(read(path), /(?:alter table|(?:create|drop)(?: or replace)? (?:function|trigger|index)) public\.(?:calculate_daily_close_snapshot|close_daily_close|orders|payments|pos_sessions|daily_closes)\b/i);
  }
  const tables = sql("select schemaname||'.'||tablename from pg_tables where schemaname in ('public','supabase_migrations') or (schemaname='auth' and tablename in ('users','identities')) order by 1;").split("\n");
  for (const table of tables) assert.match(table, /^[a-z_]+\.[a-z_0-9]+$/);
  const rowsHash = tables.map(table => `select '${table}:'||count(*)||':'||md5(coalesce(string_agg(to_jsonb(r)::text,E'\\n' order by to_jsonb(r)::text),'')) from ${table} r`).join(" union all ") + " order by 1;";
  const schemaHash = "select md5(string_agg(oid::text||':'||prosrc||':'||coalesce(proacl::text,'')||':'||coalesce(proconfig::text,''),E'\\n' order by oid)) from pg_proc where pronamespace='public'::regnamespace;";
  const constraintsHash = "select md5(string_agg(pg_get_constraintdef(oid),E'\\n' order by oid)) from pg_constraint where connamespace='public'::regnamespace;";
  const beforeRows = sql(rowsHash), beforeSchema = sql(schemaHash), beforeConstraints = sql(constraintsHash);
  const transaction = statements => sql(`begin;set local lock_timeout='2s';set local statement_timeout='20s';${statements}\nrollback;`);
  const metadata = `select jsonb_build_object('oid',oid,'owner',proowner,'acl',proacl,'securityDefiner',prosecdef,'config',proconfig,'volatility',provolatile,'parallel',proparallel,'arguments',pg_get_function_arguments(oid),'result',pg_get_function_result(oid)) from pg_proc where oid in ('${signature}'::regprocedure,'${closeSignature}'::regprocedure) order by oid`;
  const deny = (statement, state) => `do $deny$ begin begin ${statement};raise exception 'expected denial missing';exception when sqlstate '${state}' then null;end;end $deny$;`;
  try {
    await t.test("function OID, signature, owner, ACL, security and API denial preserved", () => {
      assert.equal(transaction(`${metadata};`), transaction(`${correction}${metadata};`));
      for (const role of ["anon", "authenticated"]) assert.equal(transaction(`${correction}select has_function_privilege('${role}','${signature}','execute');`), "f");
      assert.equal(transaction(`${correction}select has_function_privilege('authenticated','${closeSignature}','execute');`), "t");
      assert.equal(transaction(`${correction}select has_function_privilege('anon','${closeSignature}','execute');`), "f");
      transaction(`${correction}set local role authenticated;${deny("perform public.calculate_daily_close_snapshot(null,current_date,null,'UTC',now(),now()+interval '1 day','EUR')", "42501")}`);
    });

    const actor = id => `reset role;set local request.jwt.claim.sub='${id}';set local role authenticated;`;
    const literal = value => value === null ? "null" : `'${String(value).replaceAll("'", "''")}'`;
    const closeFixture = () => {
      const [location, first, second, payment, key] = Array.from({ length: 5 }, () => randomUUID());
      const note = "Synthetic versioned close";
      const call = (options = {}) => `public.close_daily_close(${literal(options.date ?? "2010-01-15")},${literal(options.location === undefined ? location : options.location)},${literal(options.note ?? note)},${literal(options.key ?? key)})`;
      const fingerprint = version => `encode(extensions.digest(jsonb_build_object('organizationId','${fixture.org}'::uuid,'businessDate','2010-01-15'::date,'locationId','${location}'::uuid,'note','${note}','snapshotSchemaVersion',1,'calculationVersion','${version}')::text,'sha256'),'hex')`;
      // Use a fresh synthetic location inside the fixture owner's tenant so the
      // real RPC derives authorization normally. No existing row is edited.
      const setup = `
        insert into public.locations(id,organization_id,name) values ('${location}','${fixture.org}','Synthetic version test');
        insert into public.orders(id,organization_id,location_id,customer_id,order_number,currency,subtotal,total,production_status,created_at) values
          ('${first}','${fixture.org}','${location}','${fixture.customer}','SQL-V-${first}','EUR',8.5,8.5,'received','2010-01-15T10:00Z'),
          ('${second}','${fixture.org}','${location}','${fixture.customer}','SQL-V-${second}','EUR',9.5,9.5,'received','2010-01-15T10:00Z');
        set local app.app_007_mutation='on';
        insert into public.payments(id,organization_id,order_id,amount,method,status,channel,paid_at,recorded_by) values
          ('${payment}','${fixture.org}','${first}',4,'bank_transfer','confirmed','manual_external','2010-01-15T11:00Z','${fixture.owner}'),
          (extensions.gen_random_uuid(),'${fixture.org}','${second}',4,'bank_transfer','confirmed','manual_external','2010-01-15T11:00Z','${fixture.owner}');
        insert into public.payments(organization_id,order_id,amount,method,status,channel,paid_at,recorded_by,refunded_from_payment_id,refunded_at,refund_reason) values
          ('${fixture.org}','${first}',4,'bank_transfer','refunded','manual_external','2010-01-15T12:00Z','${fixture.owner}','${payment}','2010-01-15T12:00Z','Synthetic version refund');
      `;
      return { location, key, call, fingerprint, setup };
    };
    for (const version of ["v1", "v2"]) await t.test(`real close RPC: ${version} persistence, exact replay and semantic conflicts`, () => {
      const f = closeFixture();
      const savedRow = `select to_jsonb(d) from public.daily_closes d where d.organization_id='${fixture.org}' and d.location_id='${f.location}'`;
      const result = JSON.parse(transaction(`${f.setup}${version === "v2" ? correction : ""}
        ${actor(fixture.owner)}create temp table first_result as select ${f.call()} as value;
        reset role;create temp table original_row as ${savedRow};
        ${version === "v1" ? correction : ""}
        ${actor(fixture.owner)}create temp table retry_results as select jsonb_build_object(
          'exact',${f.call()},'normalizedNote',${f.call({ note: "  Synthetic versioned close  " })},
          'changedNote',${f.call({ note: "Actually different" })},'changedDate',${f.call({ date: "2010-01-16" })},
          'changedLocation',${f.call({ location: fixture.location })},'changedToWholeTenant',${f.call({ location: null })},
          'differentKeySameScope',${f.call({ key: randomUUID() })}) as value;
        ${actor(fixture.manager)}create temp table manager_retry as select ${f.call()} as value;
        reset role;
        select jsonb_build_object('first',(select value from first_result),'retries',(select value from retry_results),
          'managerRetry',(select value from manager_retry),'before',(select to_jsonb from original_row),'after',(${savedRow}),
          'count',(select count(*) from public.daily_closes where organization_id='${fixture.org}' and location_id='${f.location}'),
          'fingerprintV1',${f.fingerprint("pos-daily-close-p2a-v1")},'fingerprintV2',${f.fingerprint("pos-daily-close-p2a-v2")},
          'fresh',public.calculate_daily_close_snapshot('${fixture.org}','2010-01-15','${f.location}','UTC','2010-01-15T00:00Z','2010-01-16T00:00Z','EUR'),
          'hashValid',(select snapshot_hash=encode(extensions.digest(snapshot::text,'sha256'),'hex') from public.daily_closes where organization_id='${fixture.org}' and location_id='${f.location}'));`));
      assert.equal(result.first.status, "created");
      assert.equal(result.count, 1); assert.equal(result.hashValid, true);
      assert.deepEqual(result.after, result.before, "all saved fields, hashes and versions immutable across replays");
      assert.equal(result.after.calculation_version, `pos-daily-close-p2a-${version}`);
      assert.equal(result.after.snapshot.calculationVersion, `pos-daily-close-p2a-${version}`);
      assert.equal(result.after.request_fingerprint, version === "v1" ? result.fingerprintV1 : result.fingerprintV2);
      assert.notEqual(result.fingerprintV1, result.fingerprintV2);
      assert.equal(result.after.snapshot.payments[0].outstanding, version === "v1" ? 10 : 14);
      assert.equal(result.fresh.calculationVersion, "pos-daily-close-p2a-v2");
      assert.equal(result.fresh.payments[0].outstanding, 14);
      for (const replay of [result.retries.exact, result.retries.normalizedNote, result.managerRetry]) {
        assert.equal(replay.status, "existing"); assert.equal(replay.closeId, result.first.closeId);
        assert.equal(replay.snapshotHash, result.first.snapshotHash);
      }
      for (const key of ["changedNote", "changedDate", "changedLocation", "changedToWholeTenant"]) assert.deepEqual(result.retries[key], { status: "validation", code: "idempotency_conflict" });
      assert.equal(result.retries.differentKeySameScope.code, "already_closed");
    });

    await t.test("versioned close retains open-cash-session blocker and creates no record", () => {
      const f = closeFixture();
      // The canonical lab already has its one open till. Reuse it read-only;
      // never create a second till or edit/close a pre-existing session.
      assert.equal(sql(`select organization_id::text||'/'||status::text from public.pos_sessions where id='${fixture.till}';`), `${fixture.org}/open`);
      const today = sql(`select (now() at time zone timezone)::date from public.organizations where id='${fixture.org}';`);
      const result = JSON.parse(transaction(`${correction}
        ${actor(fixture.owner)}create temp table blocked_result as select ${f.call({ date: today, location: null })} as value;
        reset role;select jsonb_build_object('result',(select value from blocked_result),'count',(select count(*) from public.daily_closes where organization_id='${fixture.org}' and idempotency_key='${f.key}'));`));
      assert.equal(result.result.status, "blocked"); assert.equal(result.result.code, "close_blocked");
      assert.ok(result.result.blockers.some(b => b.code === "open_pos_session" && b.count === 1));
      assert.equal(result.count, 0);
    });

    await t.test("versioned close retains staff/anonymous denial and foreign-site validation", () => {
      const f = closeFixture(), foreignOrg = randomUUID(), foreignSite = randomUUID();
      const result = JSON.parse(transaction(`${f.setup}${correction}
        insert into public.organizations(id,name,slug,default_currency,timezone) values ('${foreignOrg}','Synthetic foreign','version-${foreignOrg}','EUR','UTC');
        insert into public.locations(id,organization_id,name) values ('${foreignSite}','${foreignOrg}','Foreign site');
        set local role anon;${deny(`perform ${f.call()}`, "42501")}
        ${actor(fixture.staff)}${deny(`perform ${f.call()}`, "42501")}
        ${actor(fixture.owner)}create temp table foreign_result as select ${f.call({ location: foreignSite })} as value;
        reset role;select jsonb_build_object('result',(select value from foreign_result),'count',(select count(*) from public.daily_closes where organization_id='${fixture.org}' and location_id='${f.location}'));`));
      assert.deepEqual(result.result, { status: "validation", code: "invalid_location" }); assert.equal(result.count, 0);
    });

    const cases = [
      { name: "partial payment", refund: 0, due: 10 },
      { name: "UAT full refund of advance", refund: 4, due: 14 },
      { name: "partial refund", refund: 1.25, due: 11.25 },
      { name: "cancelled sale preserves financial facts", refund: 4, cancelled: true, due: 5.5 },
      { name: "later refund restores receivable but stays outside original day cash", refund: 4, refundDay: "2010-01-16", due: 14 },
      { name: "all collections after order date still settle receivables", refund: 4, paymentDay: "2010-01-16", refundDay: "2010-01-17", due: 14 },
      { name: "different site", refund: 4, site: "other", due: 19 },
      { name: "organization-wide scope", refund: 4, site: "all", due: 33 },
      { name: "different tenant", refund: 4, tenant: "other", due: 700 },
      { name: "cent precision", refund: 0.01, totalA: 0.30, totalB: 0.29, paidA: 0.10, paidB: 0.20, due: 0.30 },
      { name: "fully settled sale floors residual at zero", refund: 0, totalA: 4, totalB: 4, due: 0 },
    ];
    for (const c of cases) await t.test(c.name, () => {
      const [org, foreignOrg, site, otherSite, foreignSite, customer, foreignCustomer, first, second, third, fourth, paid, paid2, paid3, paid4] = Array.from({ length: 15 }, () => randomUUID());
      const paymentDay = c.paymentDay || "2010-01-15", refundDay = c.refundDay || "2010-01-15";
      const targetOrg = c.tenant === "other" ? foreignOrg : org;
      const targetSite = c.tenant === "other" ? foreignSite : c.site === "other" ? otherSite : c.site === "all" ? null : site;
      const targetSiteSql = targetSite ? `'${targetSite}'` : "null";
      const snapshot = `public.calculate_daily_close_snapshot('${targetOrg}','2010-01-15',${targetSiteSql},'UTC','2010-01-15T00:00:00Z','2010-01-16T00:00:00Z','EUR')`;
      // Synthetic canonical fact rows only, in real tables with all constraints
      // and triggers enabled. Privileged fixture setup is not a POS/RLS E2E test.
      const seed = `
        insert into public.organizations(id,name,slug,default_currency,timezone) values
          ('${org}','Synthetic A','refund-sql-${org}','EUR','UTC'),('${foreignOrg}','Synthetic B','refund-sql-${foreignOrg}','EUR','UTC');
        insert into public.locations(id,organization_id,name) values ('${site}','${org}','A'),('${otherSite}','${org}','B'),('${foreignSite}','${foreignOrg}','Foreign');
        insert into public.customers(id,organization_id,customer_type,display_name) values ('${customer}','${org}','individual','Synthetic A'),('${foreignCustomer}','${foreignOrg}','individual','Synthetic B');
        insert into public.orders(id,organization_id,location_id,customer_id,order_number,currency,subtotal,total,production_status,created_at,cancelled_at,cancellation_reason) values
          ('${first}','${org}','${site}','${customer}','SQL-A','EUR',${c.totalA ?? 8.5},${c.totalA ?? 8.5},'${c.cancelled ? "cancelled" : "received"}','2010-01-15T10:00Z',${c.cancelled ? "'2010-01-15T13:00Z'" : "null"},${c.cancelled ? "'Synthetic cancellation'" : "null"}),
          ('${second}','${org}','${site}','${customer}','SQL-B','EUR',${c.totalB ?? 9.5},${c.totalB ?? 9.5},'received','2010-01-15T10:00Z',null,null),
          ('${third}','${org}','${otherSite}','${customer}','SQL-C','EUR',20,20,'received','2010-01-15T10:00Z',null,null),
          ('${fourth}','${foreignOrg}','${foreignSite}','${foreignCustomer}','SQL-D','EUR',1000,1000,'received','2010-01-15T10:00Z',null,null);
        set local app.app_007_mutation='on';
        insert into public.payments(id,organization_id,order_id,amount,method,status,channel,paid_at,recorded_by) values
          ('${paid}','${org}','${first}',${c.paidA ?? 4},'bank_transfer','confirmed','manual_external','${paymentDay}T11:00Z','${fixture.owner}'),
          ('${paid2}','${org}','${second}',${c.paidB ?? 4},'bank_transfer','confirmed','manual_external','${paymentDay}T11:00Z','${fixture.owner}'),
          ('${paid3}','${org}','${third}',1,'bank_transfer','confirmed','manual_external','2010-01-15T11:00Z','${fixture.owner}'),
          ('${paid4}','${foreignOrg}','${fourth}',500,'bank_transfer','confirmed','manual_external','2010-01-15T11:00Z','${fixture.owner}');
        ${c.refund ? `insert into public.payments(organization_id,order_id,amount,method,status,channel,paid_at,recorded_by,refunded_from_payment_id,refunded_at,refund_reason) values ('${org}','${first}',${c.refund},'bank_transfer','refunded','manual_external','${refundDay}T12:00Z','${fixture.owner}','${paid}','${refundDay}T12:00Z','Synthetic refund');` : ""}
        insert into public.payments(organization_id,order_id,amount,method,status,channel,paid_at,recorded_by,refunded_from_payment_id,refunded_at,refund_reason) values ('${foreignOrg}','${fourth}',200,'bank_transfer','refunded','manual_external','2010-01-15T12:00Z','${fixture.owner}','${paid4}','2010-01-15T12:00Z','Synthetic foreign refund');
        create temp table old_snapshot as select ${snapshot} as value;
        set local app.daily_close_mutation='on';
        insert into public.daily_closes(organization_id,business_date,location_id,tenant_timezone,business_day_start,business_day_end_exclusive,closed_by,snapshot_schema_version,calculation_version,idempotency_key,request_fingerprint,snapshot,snapshot_hash)
          select '${targetOrg}','2010-01-15',${targetSiteSql},'UTC','2010-01-15T00:00Z','2010-01-16T00:00Z','${fixture.owner}',1,'pos-daily-close-p2a-v1',extensions.gen_random_uuid(),repeat('a',64),value,encode(extensions.digest(value::text,'sha256'),'hex') from old_snapshot;
        create temp table saved_history as select to_jsonb(d) as value from public.daily_closes d where organization_id='${targetOrg}';
      `;
      const result = JSON.parse(transaction(`${seed}${correction}
        ${deny(`update public.daily_closes set close_note='changed' where organization_id='${targetOrg}'`, "55000")}
        ${deny(`delete from public.daily_closes where organization_id='${targetOrg}'`, "55000")}
        select jsonb_build_object('before',(select value from old_snapshot),'after',${snapshot},
          'savedUnchanged',(select to_jsonb(d) from public.daily_closes d where organization_id='${targetOrg}')=(select value from saved_history),
          'orders',(select jsonb_agg(to_jsonb(o)) from public.orders o where o.organization_id in ('${org}','${foreignOrg}')),
          'payments',(select jsonb_agg(to_jsonb(p)) from public.payments p where p.organization_id in ('${org}','${foreignOrg}')));`));
      assert.equal(result.savedUnchanged, true, "saved close row including hash remains byte-equivalent");
      assert.equal(result.before.calculationVersion, "pos-daily-close-p2a-v1");
      assert.equal(result.after.calculationVersion, "pos-daily-close-p2a-v2");
      const orders = result.orders.filter(o => o.organization_id === targetOrg && (!targetSite || o.location_id === targetSite) && o.is_active && o.production_status !== "cancelled");
      const validOrders = result.orders.filter(o => o.organization_id === targetOrg && (!targetSite || o.location_id === targetSite) && o.is_active);
      const payments = result.payments.filter(p => validOrders.some(o => o.id === p.order_id)).map(p => ({ ...p,
        orderId: p.order_id, locationId: validOrders.find(o => o.id === p.order_id).location_id,
        currency: "EUR", paidAt: p.paid_at, posSessionId: p.pos_session_id,
      }));
      const period = { startDate: "2010-01-15", endDateExclusive: "2010-01-16" };
      const value = buildAccountingSummary({ locationId: targetSite, paymentPeriod: period, salesPeriod: period, timezone: "UTC",
        salesOrders: orders.map(o => ({ ...o, activeItemCount: 1, isQuickDrop: false, createdAt: o.created_at, locationId: o.location_id })),
        receivableConfirmedPayments: payments, periodPayments: payments.filter(p => p.paidAt.slice(0, 10) === "2010-01-15"), posSessions: [], posSessionPayments: [],
      }).currencies[0];
      const actual = result.after.payments[0];
      assert.equal(actual.outstanding, c.due); assert.equal(actual.outstanding, value.outstanding);
      for (const key of ["salesGross", "salesNet", "discountTotal", "orderCount", "outstandingOrderCount", "collectedGross", "refunds", "collectedNet", "refundCount", "cashCollected", "cardCollected", "bankTransferCollected", "otherCollected", "onlineCollected"]) assert.equal(actual[key], value[key], key);
      assert.equal(actual.confirmedPaymentCount, value.paymentCount);
      assert.deepEqual(actual.outstandingOrderIds, value.outstandingOrderIds.sort());
      const stripResidual = snapshot => ({ ...snapshot, calculationVersion: "expected version transition", warnings: snapshot.warnings.filter(w => w.code !== "unpaid_or_partially_paid_orders"), payments: snapshot.payments.map(payment => Object.fromEntries(Object.entries(payment).filter(([key]) => !["outstanding", "outstandingOrderCount", "outstandingOrderIds"].includes(key)))) });
      assert.deepEqual(stripResidual(result.after), stripResidual(result.before), "all unrelated fields and cash totals unchanged");
      if (c.name === "UAT full refund of advance") assert.deepEqual([result.before.payments[0].outstanding, actual.outstanding, actual.collectedGross, actual.refunds, actual.collectedNet], [10, 14, 8, 4, 4]);
    });
  } finally {
    assert.equal(sql(rowsHash), beforeRows, "all persistent public, Auth and migration-ledger rows unchanged");
    assert.equal(sql(schemaHash), beforeSchema, "all function bodies and ACL restored by rollback");
    assert.equal(sql(constraintsHash), beforeConstraints, "all constraints unchanged");
  }
});
