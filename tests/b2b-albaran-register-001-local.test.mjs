import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';

// Explicit opt-in, fixed canonical local container only. All fixture writes roll back.
test('canonical Supabase: register RLS, historical search and pagination on the 120-migration schema', {
  skip: process.env.PHOENIX_ALBARAN_REGISTER_LOCAL !== '1', timeout: 60000,
}, () => {
  const container = 'supabase_db_phoenix-canonical-local-001';
  const inspect = spawnSync('docker', ['inspect', container], { encoding: 'utf8', timeout: 15000 });
  assert.equal(inspect.status, 0, inspect.stderr);
  const target = JSON.parse(inspect.stdout)[0];
  assert.equal(target.Config.Labels['com.supabase.cli.project'], 'phoenix-canonical-local-001');
  assert.equal(target.State.Running, true);
  assert.ok(target.Mounts.some(m => m.Type === 'volume' && m.Name === container));
  const prefix = randomUUID().slice(0, 24);
  const id = n => `${prefix}${String(n).padStart(12, '0')}`;
  const actor = n => `set local role authenticated; set local request.jwt.claim.sub='${id(n)}';`;
  const verify = (condition, label) => `do $$ begin if not (${condition}) then raise exception '${label}'; end if; end $$; select 'PASS ${label}';`;
  const sql = `begin;
    ${verify('(select count(*)=120 from supabase_migrations.schema_migrations)', 'baseline_120')}
    insert into auth.users(id,email,raw_user_meta_data) values ${[1,2,3,4,5].map(n => `('${id(n)}','register-${id(n)}@example.invalid','{"display_name":"Register fixture"}')`).join(',')};
    insert into public.profiles(id,display_name) values ${[1,2,3,4,5].map(n => `('${id(n)}','Register fixture')`).join(',')} on conflict(id) do nothing;
    insert into public.organizations(id,name,slug,timezone,default_currency) values ('${id(101)}','Register A','register-${id(101)}','Atlantic/Canary','EUR'),('${id(102)}','Register B','register-${id(102)}','UTC','EUR');
    insert into public.organization_memberships(organization_id,profile_id,role,operational_capabilities) values
      ('${id(101)}','${id(1)}','owner','{}'),('${id(101)}','${id(2)}','manager','{}'),
      ('${id(101)}','${id(3)}','staff','{pos}'),('${id(101)}','${id(4)}','staff','{}'),('${id(102)}','${id(5)}','owner','{}');
    insert into public.organization_entitlements(organization_id,feature_key,enabled) values ('${id(101)}','printing',true),('${id(102)}','printing',true);
    insert into public.locations(id,organization_id,name) values ('${id(201)}','${id(101)}','Fixture site A'),('${id(202)}','${id(102)}','Fixture site B');
    insert into public.customers(id,organization_id,customer_type,display_name) values ('${id(301)}','${id(101)}','business','Live renamed customer A'),('${id(302)}','${id(102)}','business','Live renamed customer B');
    set local request.jwt.claim.sub='${id(1)}';
    insert into public.orders(id,organization_id,customer_id,location_id,order_number,currency) values ('${id(501)}','${id(101)}','${id(301)}','${id(201)}','LIVE-ORDER-A','EUR');
    set local request.jwt.claim.sub='${id(5)}';
    insert into public.orders(id,organization_id,customer_id,location_id,order_number,currency) values ('${id(502)}','${id(102)}','${id(302)}','${id(202)}','LIVE-ORDER-B','EUR');
    set local request.jwt.claim.sub='${id(1)}';
    insert into public.order_status_history(id,organization_id,order_id,to_status,changed_by) values ('${id(601)}','${id(101)}','${id(501)}','completed','${id(1)}');
    set local request.jwt.claim.sub='${id(5)}';
    insert into public.order_status_history(id,organization_id,order_id,to_status,changed_by) values ('${id(602)}','${id(102)}','${id(502)}','completed','${id(5)}');
    set local app.service_albaran_mutation='on';
    set local request.jwt.claim.sub='${id(1)}';
    insert into public.service_albarans(organization_id,order_id,customer_id,location_id,completion_event_id,request_id,document_number,sequence_year,sequence_number,document_status,issued_at,created_by,cancelled_at,cancelled_by,cancellation_reason,snapshot)
      select '${id(101)}','${id(501)}','${id(301)}','${id(201)}','${id(601)}',gen_random_uuid(),'ALB-2026-'||lpad(n::text,6,'0'),2026,n,
        case when n=1 then 'issued' else 'cancelled' end,'2026-11-10 12:00:00+00','${id(1)}',
        case when n=1 then null else '2026-11-11 12:00:00+00'::timestamptz end,
        case when n=1 then null else '${id(1)}'::uuid end,case when n=1 then null else 'Synthetic cancellation' end,
        jsonb_build_object('version',1,'customer',jsonb_build_object('name','Historical Hotel '||n),'order',jsonb_build_object('number','EW-SNAPSHOT-'||n),'location',jsonb_build_object('name','Historical site'))
      from generate_series(1,137) n;
    set local request.jwt.claim.sub='${id(5)}';
    insert into public.service_albarans(organization_id,order_id,customer_id,location_id,completion_event_id,request_id,document_number,sequence_year,sequence_number,issued_at,created_by,snapshot)
      values ('${id(102)}','${id(502)}','${id(302)}','${id(202)}','${id(602)}',gen_random_uuid(),'ALB-2026-000001',2026,1,now(),'${id(5)}','{"version":1}');
    ${actor(1)}
    ${verify('(select count(*)=137 from public.service_albarans)', 'owner_tenant_isolation')}
    ${verify("(select count(*)=1 from public.service_albarans where snapshot->'customer'->>'name' ilike '%Historical Hotel 137%' and snapshot->'order'->>'number' ilike '%EW-SNAPSHOT-137%')", 'historical_search')}
    ${verify("(select count(*)=136 from public.service_albarans where document_status='cancelled' and issued_at>='2026-11-10T00:00:00Z' and issued_at<'2026-11-11T00:00:00Z')", 'status_and_date_filters')}
    ${verify('(select count(*)=12 from (select id from public.service_albarans order by issued_at desc,id desc offset 125 limit 25) page)', 'pagination_beyond_100')}
    reset role; ${actor(2)} ${verify('(select count(*)=137 from public.service_albarans)', 'manager_read')}
    reset role; ${actor(3)} ${verify('(select count(*)=137 from public.service_albarans)', 'staff_pos_read')}
    reset role; ${actor(4)} ${verify('(select count(*)=0 from public.service_albarans)', 'staff_without_pos_denied')}
    reset role; ${actor(5)} ${verify('(select count(*)=1 from public.service_albarans)', 'other_tenant_isolation')}
    reset role; update public.organization_entitlements set enabled=false where organization_id='${id(101)}' and feature_key='printing';
    ${actor(1)} ${verify('(select count(*)=0 from public.service_albarans)', 'printing_disabled_denied')}
    reset role; rollback;
  `;
  const result = spawnSync('docker', ['exec', '-i', container, 'psql', '-XqAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8', timeout: 45000 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.split('\n').filter(line => line.startsWith('PASS ')).length, 10, result.stdout);
  const cleanup = spawnSync('docker', ['exec', container, 'psql', '-XqAt', '-U', 'postgres', '-d', 'postgres', '-c', `select count(*) from auth.users where id in (${[1,2,3,4,5].map(n => `'${id(n)}'`).join(',')});`], { encoding: 'utf8', timeout: 15000 });
  assert.equal(cleanup.status, 0, cleanup.stderr);
  assert.equal(cleanup.stdout.trim(), '0', 'Fixture must be rolled back');
});

test('canonical PostgREST: actual register query accepts JSON projection, escaped search and date/page filters', {
  skip: process.env.PHOENIX_ALBARAN_REGISTER_LOCAL !== '1', timeout: 30000,
}, async () => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => ['PATH', 'HOME', 'USER', 'LOGNAME', 'TMPDIR', 'LANG'].includes(key)));
  const result = spawnSync('supabase', ['status', '--workdir', '/Volumes/DEV/Phoenix-Canonical-Lab/runtime', '-o', 'json'], { env, encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 0, 'Canonical local status unavailable');
  const status = JSON.parse(result.stdout);
  assert.equal(status.API_URL, 'http://127.0.0.1:57321');
  // Signed local-only synthetic claims, deliberately without a user/membership.
  // This tests actual HTTP query syntax and deny-by-default RLS, not a real Auth login.
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const content = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role: 'authenticated', sub: randomUUID(), aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 60 })}`;
  const token = `${content}.${createHmac('sha256', status.JWT_SECRET).update(content).digest('base64url')}`;
  const client = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  function load(path, imports = {}) {
    const compiledModule = { exports: {} };
    const compiled = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    runInNewContext(compiled, { module: compiledModule, exports: compiledModule.exports, URLSearchParams, console, require(name) {
      if (name === 'server-only') return {};
      if (Object.hasOwn(imports, name)) return imports[name];
      throw Error(`Unexpected import ${name}`);
    } });
    return compiledModule.exports;
  }
  const timezone = load('src/lib/organization-timezone.ts');
  const register = load('src/features/service-albarans/register.ts', { '@/lib/organization-timezone': timezone });
  const queries = load('src/features/service-albarans/server/register-queries.ts', {
    '@/features/printing/server/access': { requirePrintAccess: async () => ({ membership: { organization: { id: randomUUID(), timezone: 'Atlantic/Canary' } } }) },
    '@/features/service-albarans/register': register,
    '@/lib/supabase/server': { createSupabaseServerClient: async () => client },
  });
  for (const q of ['ALB-2026', 'Hotel "A", (test)._%\\', 'EW-137']) {
    const history = await queries.listServiceAlbaranRegister('en', { q, status: 'cancelled', from: '2026-11-01', to: '2026-11-11', page: '2' });
    assert.equal(history.state, 'ready');
    assert.equal(history.count, 0);
    assert.equal(history.items.length, 0);
  }
});
