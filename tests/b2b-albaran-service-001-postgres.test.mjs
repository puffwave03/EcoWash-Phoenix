import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Explicit opt-in only. Always NEW container, no ports, no network, no mounted
// host files/volumes. Never accepts a DB URL or an existing container/database.
const enabled = process.env.PHOENIX_ALBARAN_SQL === '1';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const migration = 'supabase/migrations/20261110102208_b2b_albaran_service_001.sql';
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const quote = value => `'${value}'`;
const issue = (order, request, previous) => `select public.issue_service_albaran('${id(order)}','${id(request)}',${previous ? quote(previous) : 'null'});`;

test('disposable PostgreSQL: service albaran security, history and concurrency', { skip: !enabled, timeout: 120000 }, async t => {
  const context = spawnSync('docker', ['context','inspect','--format','{{.Endpoints.docker.Host}}'], { encoding:'utf8' });
  assert.equal(context.status,0,context.stderr);
  const endpoint = context.stdout.trim();
  assert.match(endpoint,/^unix:\/\/\//,'Only a local Unix Docker socket is allowed');
  const docker = ['--host',endpoint];
  const name = `phoenix-albaran-test-${randomUUID()}`;
  const call = (args, input) => spawnSync('docker',[...docker,...args],{encoding:'utf8',input,timeout:30000});
  const psql = ['exec','-i',name,'psql','-XqAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'];
  const actor = n => `set role authenticated; set request.jwt.claim.sub='${id(n)}';\n`;
  const sql = (statement, who) => {
    const result = call(psql, (who == null ? '' : actor(who)) + statement);
    if (result.status !== 0) throw Error(result.stderr);
    return result.stdout.trim();
  };
  const forbidden = (statement, who, state, message) => assert.throws(() => sql(statement,who), error => error.message.includes(state) && (!message || error.message.includes(message)));
  const baselineTables = ['orders','order_items','order_status_history','payments','invoices','operational_receipts'];
  const facts = () => sql(`select jsonb_build_array(${baselineTables.map(table=>`(select jsonb_agg(to_jsonb(x) order by id) from public.${table} x)`).join(',')});`);
  let created = false;
  try {
    const image = call(['image','inspect','postgres:17','--format','{{.Id}}']);
    assert.equal(image.status,0,'postgres:17 must already exist locally; no image pull is allowed');
    created=true;
    const run = call(['run','--detach','--pull=never','--name',name,'--label','phoenix.mission=B2B-ALBARAN-SERVICE-001',
      '--network','none','--tmpfs','/var/lib/postgresql/data:rw','--env','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17']);
    assert.equal(run.status,0,run.stderr);
    for (let attempt=0; attempt<30; attempt++) {
      if (call(['exec',name,'pg_isready','-U','postgres']).status===0) break;
      await new Promise(resolve=>setTimeout(resolve,200));
    }
    assert.equal(call(['exec',name,'pg_isready','-U','postgres']).status,0,'Temporary PostgreSQL did not become ready');
    const isolation = JSON.parse(call(['inspect',name,'--format','{{json .HostConfig}}']).stdout);
    assert.equal(isolation.NetworkMode,'none');
    assert.deepEqual(isolation.PortBindings,{});
    assert.ok(!isolation.Binds?.length);
    assert.ok(isolation.Tmpfs['/var/lib/postgresql/data']);
    sql(read('tests/sql/b2b-albaran-service-001-setup.sql'));
    const before = facts();
    sql(read(migration));
    t.diagnostic(`PostgreSQL ${sql('show server_version;')}; existing image ${image.stdout.trim()}; temporary network=none`);
    await t.test('canonical ACL: authenticated uses wrapper and cannot execute internal entitlement helper',()=>{
      assert.equal(sql("select has_function_privilege('authenticated','public.organization_entitlement_is_enabled(uuid,text,timestamptz)','execute');"),'f');
      assert.equal(sql("select has_function_privilege('authenticated','public.has_organization_entitlement(uuid,text)','execute');"),'t');
      forbidden(`select public.organization_entitlement_is_enabled('${id(101)}','printing',now());`,1,'42501');
      assert.equal(sql(`select public.has_organization_entitlement('${id(101)}','printing');`,1),'t');
    });
    let first;
    await t.test('issue snapshots completed business service without money or confidential fields',()=>{
      first=sql(issue(501,10001),1);
      // Read as the real Data API role immediately after the definer RPC returns.
      const snapshot=JSON.parse(sql(`select snapshot from public.service_albarans where id='${first}';`,1));
      assert.equal(snapshot.order.number,'EW-501');
      assert.equal(snapshot.customer.name,'Hotel A');
      assert.equal(snapshot.property.name,'Apartment A');
      assert.equal(snapshot.location.name,'Site A');
      assert.match(snapshot.document.number,/^ALB-\d{4}-000001$/);
      assert.deepEqual(Object.keys(snapshot.items[0]).sort(),['description','id','quantity','unitType']);
      assert.deepEqual([...new Set(snapshot.items.map(item=>item.unitType))].sort(),['area','cycle','day','piece','service','weight']);
      assert.doesNotMatch(JSON.stringify(snapshot),/PRIVATE|price|total|payment|notes|tax|actualPerformed/i);
    });
    await t.test('same request and double click return the existing number without consuming a sequence',()=>{
      assert.equal(sql(issue(501,10001),1),first);
      assert.equal(sql(issue(501,10002),3),first);
      assert.equal(sql('select count(*) from public.service_albarans;'),'1');
      assert.equal(sql('select last_value from public.service_albaran_number_counters;'),'1');
      forbidden(issue(502,10001),1,'22023','request_conflict');
    });
    await t.test('incomplete, cancelled, individual, no history, no site and no items remain ineligible',()=>{
      for(const [order,reason] of [[503,'invalid_order'],[504,'invalid_order'],[505,'business_customer'],[506,'completion_evidence'],[507,'invalid_order'],[508,'items_required']]) {
        forbidden(issue(order,11000+order),1,'22023',reason);
      }
      assert.equal(sql('select last_value from public.service_albaran_number_counters;'),'1');
    });
    await t.test('contradictory or future completion registration does not attest a service',()=>{
      for(const order of [515,516])forbidden(issue(order,11500+order),1,'22023','completion_evidence');
    });
    await t.test('Owner/Manager/Staff with POS allowed; Staff without POS, nonmember, anonymous denied',()=>{
      assert.equal(sql(`select count(*) from public.service_albarans where id='${first}';`,2),'1');
      assert.equal(sql(`select count(*) from public.service_albarans where id='${first}';`,3),'1');
      assert.equal(sql('select count(*) from public.service_albarans;',4),'0');
      for(const who of [4,6]) forbidden(issue(502,12000+who),who,'42501');
      forbidden(`set role anon; ${issue(502,12009)}`,null,'42501');
      forbidden(`select public.cancel_service_albaran('${id(501)}','${first}','reason');`,3,'42501');
    });
    await t.test('tenant read/write isolation and per-tenant number series',()=>{
      assert.equal(sql('select count(*) from public.service_albarans;',5),'0');
      forbidden(issue(501,13001),5,'22023');
      const other=sql(issue(601,13002),5);
      assert.match(sql(`select document_number from public.service_albarans where id='${other}';`),/000001$/);
      assert.equal(sql(`select count(*) from public.service_albarans where id='${other}';`,1),'0');
      forbidden(`select public.cancel_service_albaran('${id(501)}','${first}','foreign');`,5,'22023');
    });
    await t.test('RLS, direct DML denial, snapshot immutability and identifier protection',()=>{
      assert.equal(sql("select count(*) from pg_class where relname in ('service_albarans','service_albaran_number_counters') and relrowsecurity;"),'2');
      for(const statement of [`update public.service_albarans set snapshot='{}';`,`delete from public.service_albarans;`,`insert into public.service_albaran_number_counters values('${id(101)}',2099,1);`]) forbidden(statement,1,'42501');
      forbidden(`set request.jwt.claim.sub='${id(1)}'; update public.service_albarans set snapshot='{}' where id='${first}';`,null,'55000','immutable');
      forbidden(`set request.jwt.claim.sub='${id(1)}'; delete from public.service_albarans where id='${first}';`,null,'55000','immutable');
      forbidden(`select public.cancel_service_albaran('${id(502)}','${first}','wrong order');`,1,'22023');
      assert.equal(sql("select has_function_privilege('anon','public.issue_service_albaran(uuid,uuid,uuid)','execute');"),'f');
    });
    await t.test('print entitlement disabled blocks issuance and reads',()=>{
      sql(`update public.organizations set printing=false where id='${id(101)}';`);
      try { forbidden(issue(502,14001),1,'42501'); assert.equal(sql('select count(*) from public.service_albarans;',1),'0'); }
      finally { sql(`update public.organizations set printing=true where id='${id(101)}';`); }
    });
    await t.test('snapshot is independent of later order/item changes',()=>{
      const original=sql(`select snapshot from public.service_albarans where id='${first}';`);
      sql(`update public.order_items set description='changed' where order_id='${id(501)}';`);
      assert.equal(sql(`select snapshot from public.service_albarans where id='${first}';`),original);
      sql(`update public.order_items set description='Laundry service' where order_id='${id(501)}';`);
    });
    await t.test('reasoned cancellation is historical, idempotent and never reuses a number',()=>{
      forbidden(`select public.cancel_service_albaran('${id(501)}','${first}',' ');`,1,'22023');
      const cancel=`select public.cancel_service_albaran('${id(501)}','${first}','Synthetic cancellation');`;
      sql(cancel,2);sql(cancel,2);
      assert.equal(sql(issue(501,10001),1),first,'Old original request stays bound to cancelled history');
      forbidden(issue(501,10002),1,'55000','history_changed');
      const replacement=sql(issue(501,15001,first),1);
      assert.notEqual(replacement,first);
      assert.equal(sql(`select document_status from public.service_albarans where id='${first}';`),'cancelled');
      assert.equal(sql(`select count(*) from public.service_albarans where order_id='${id(501)}';`),'2');
      assert.match(sql(`select document_number from public.service_albarans where id='${replacement}';`),/000002$/);
    });

    // First connection holds a confirmed SQL lock; second must wait before COMMIT.
    async function interleave(firstStatement,secondStatement, check) {
      const client=spawn('docker',[...docker,...psql],{stdio:['pipe','pipe','pipe']});
      let output='',errors='';
      client.stdout.setEncoding('utf8');client.stderr.setEncoding('utf8');
      client.stdout.on('data',chunk=>{output+=chunk;});client.stderr.on('data',chunk=>{errors+=chunk;});
      const finished=new Promise((resolve,reject)=>{client.on('error',reject);client.on('close',code=>code===0?resolve():reject(Error(errors)));});
      client.stdin.write(`begin; ${actor(1)} ${firstStatement} select 'LOCK_HELD';\n`);
      let second;
      try {
        for(let n=0;n<100 && !output.includes('LOCK_HELD');n++) await new Promise(resolve=>setTimeout(resolve,30));
        assert.ok(output.includes('LOCK_HELD'),errors||'first transaction failed to acquire lock');
        const follower=spawn('docker',[...docker,...psql],{stdio:['pipe','pipe','pipe']});
        let nextOutput='',nextError='';
        follower.stdout.on('data',chunk=>{nextOutput+=chunk;});follower.stderr.on('data',chunk=>{nextError+=chunk;});
        second=new Promise((resolve,reject)=>{follower.on('error',reject);follower.on('close',code=>code===0?resolve(nextOutput.trim()):reject(Error(nextError)));});
        follower.stdin.end(`${actor(1)}set application_name='albaran_follower';set lock_timeout='8s';${secondStatement}`);
        let waiting=false;
        for(let n=0;n<40;n++) {
          waiting=sql("select exists(select 1 from pg_stat_activity where application_name='albaran_follower' and wait_event_type='Lock');")==='t';
          if(waiting)break;
          await new Promise(resolve=>setTimeout(resolve,30));
        }
        assert.ok(waiting,'second independent PostgreSQL transaction must wait on the actual lock');
        client.stdin.end('commit;\n');
        await finished;
        check(output.split('\n').find(line=>/^[a-f0-9-]{36}$/.test(line)),await second);
      } finally {
        if(!client.stdin.destroyed)client.stdin.end('rollback;\n');
        await finished;
        if(second)await second;
      }
    }
    await t.test('two independent concurrent issues on the same order return one document',async()=>{
      await interleave(issue(509,16001),issue(509,16002),(a,b)=>assert.equal(a,b));
      assert.equal(sql(`select count(*) from public.service_albarans where order_id='${id(509)}';`),'1');
    });
    await t.test('concurrent issues for different orders serialize the tenant/year counter',async()=>{
      await interleave(issue(510,17001),issue(511,17002),(a,b)=>assert.notEqual(a,b));
      assert.equal(sql(`select count(distinct document_number) from public.service_albarans where order_id in ('${id(510)}','${id(511)}');`),'2');
    });
    await t.test('site comes from the canonical order, not the client',()=>{
      const document=sql(issue(512,18001),1);
      assert.equal(sql(`select location_id from public.service_albarans where id='${document}';`),id(203));
    });
    await t.test('failed transaction rolls back number and document together',()=>{
      const count=sql('select count(*) from public.service_albarans;');
      const counters=sql('select jsonb_agg(to_jsonb(c) order by organization_id,sequence_year) from public.service_albaran_number_counters c;');
      forbidden(`begin; ${issue(502,19001)} select 1/0; commit;`,1,'22012');
      assert.equal(sql('select count(*) from public.service_albarans;'),count);
      assert.equal(sql('select jsonb_agg(to_jsonb(c) order by organization_id,sequence_year) from public.service_albaran_number_counters c;'),counters);
    });
    await t.test('Manager and POS-enabled Staff issue a new document under the same access boundary',()=>{
      assert.match(sql(issue(513,20001),2),/^[a-f0-9-]{36}$/);
      assert.match(sql(issue(514,20002),3),/^[a-f0-9-]{36}$/);
    });
    await t.test('existing order/history and financial facts remain identical',()=>assert.equal(facts(),before));
  } finally {
    if(created) {
      const owned=call(['inspect',name,'--format','{{index .Config.Labels "phoenix.mission"}}']);
      if(owned.status===0) {
        assert.equal(owned.stdout.trim(),'B2B-ALBARAN-SERVICE-001');
        const removed=call(['rm','--force','--volumes',name]);
        assert.equal(removed.status,0,removed.stderr);
      }
    }
  }
});
