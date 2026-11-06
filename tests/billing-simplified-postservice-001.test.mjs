import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { parsePostServiceConfirmation } from '../src/features/billing/postservice-declaration.ts';

const migrationPath = 'supabase/migrations/20261106115208_billing_simplified_postservice_001.sql';
const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const migration = read(migrationPath);
const lab = '/Volumes/DEV/Phoenix-FINANCIAL-GUARD-2A-LOCAL';
const container = 'supabase_db_phoenix-financial-guard-2a-local-001';
const enabled = process.env.PHOENIX_POSTSERVICE_LAB;

test('explicit checkbox: no inferred statement, malformed/duplicate fields rejected', () => {
  const form = new FormData();
  assert.equal(parsePostServiceConfirmation(form), false);
  form.append('postServiceConfirmed', 'confirmed');
  assert.equal(parsePostServiceConfirmation(form), true);
  form.append('postServiceConfirmed', 'confirmed');
  assert.equal(parsePostServiceConfirmation(form), null);
  form.delete('postServiceConfirmed'); form.set('postServiceConfirmed', 'on');
  assert.equal(parsePostServiceConfirmation(form), null);
});

test('migration changes only additive evidence, opt-in POS wrapper and simplified overload', () => {
  const functions = [...migration.matchAll(/create (?:or replace )?function public\.(\w+)\(/g)].map(m => m[1]);
  assert.deepEqual(functions, ['protect_billing_postservice_evidence','record_pos_postservice_payment','issue_billing_invoice']);
  assert.match(migration, /billing_advance_workflow_required/);
  assert.match(migration, /declaration_timing='contemporaneous'/);
  const issuer=migration.slice(migration.indexOf('create or replace function public.issue_billing_invoice('));
  assert.ok(issuer.indexOf('order by p.id for share of p')<issuer.indexOf('for update of o'));
  assert.match(issuer,/p.id=any\(postservice_locked_payment_ids\)/);

  assert.doesNotMatch(migration, /(?:update|delete from|insert into) public\.(?:payments|orders|order_status_history)\b/);
  const action = read('src/features/pos/server/actions.ts');
  assert.match(action, /postServiceConfirmed \? "record_pos_postservice_payment" : "record_pos_payment"/);
  assert.match(read('src/components/pos/PosWorkspace.tsx'), /name="postServiceConfirmed" type="checkbox" value="confirmed"/);
  for (const locale of ['it','es','en','fr','de']) {
    const d=JSON.parse(read(`src/i18n/${locale}/common.json`));
    assert.ok(d.pos.orders.postServiceConfirm.length>30);
    assert.ok(d.pos.errors.postservice.length>30);
    assert.ok(d.billing.serviceIssue.postServiceEvidence.length>30);
  }
});

test('canonical local SQL: service evidence, issuer, negative cases and rollback preservation', {
  skip: enabled ? false : 'RUNTIME_NOT_VERIFIED: explicit canonical laboratory opt-in required',
  timeout: 180000,
}, async t => {
  assert.equal(enabled,lab);
  const inspected=spawnSync('docker',['inspect','--format','{{json .NetworkSettings.Ports}}',container],{encoding:'utf8'});
  assert.equal(inspected.status,0,inspected.stderr);
  const ports=JSON.parse(inspected.stdout)['5432/tcp'];
  assert.ok(ports.length && ports.every(p=>['127.0.0.1','::1'].includes(p.HostIp)&&p.HostPort==='56322'));
  const f=JSON.parse(readFileSync(`${lab}/runtime-evidence/fixture-manifest.json`,'utf8'));
  for(const id of Object.values(f))assert.match(id,/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
  const args=['exec','-i','--user','postgres',container,'env','-u','PGHOST','-u','PGHOSTADDR','-u','PGPORT','-u','PGPASSWORD','-u','PGSERVICE','-u','PGSERVICEFILE','-u','PGOPTIONS','-u','PGPASSFILE','psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'];
  const sql=query=>{const r=spawnSync('docker',args,{input:query,encoding:'utf8',timeout:30000});assert.ifError(r.error);assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
  assert.equal(sql("select current_database()||'/'||current_setting('server_version')||'/'||(select count(*) from supabase_migrations.schema_migrations)"),'postgres/17.6/112');
  assert.equal(sql(`select slug from organizations where id='${f.org}'`),'fg2a-canonical-runtime');
  const tables=sql("select schemaname||'.'||tablename from pg_tables where schemaname in ('public','supabase_migrations') or (schemaname='auth' and tablename in ('users','identities')) order by 1").split('\n');
  for(const table of tables)assert.match(table,/^[a-z_]+\.[a-z_0-9]+$/);
  const fingerprints=tables.map(table=>`select '${table}:'||count(*)||':'||md5(coalesce(string_agg(to_jsonb(r)::text,E'\\n' order by to_jsonb(r)::text),'')) as f from ${table} r`).join(' union all ')+' order by 1';
  const definitions="select md5(string_agg(oid::text||':'||prosrc||':'||coalesce(proacl::text,'')||':'||coalesce(proconfig::text,''),E'\\n' order by oid)) from pg_proc where pronamespace='public'::regnamespace";
  const before=sql(fingerprints), beforeDefs=sql(definitions);
  const schemaBefore=sql("select md5(string_agg(pg_get_constraintdef(oid),E'\\n' order by oid)) from pg_constraint where connamespace='public'::regnamespace");
  const baselinePaths=spawnSync('git',['ls-tree','-r','--name-only','HEAD','supabase/migrations'],{encoding:'utf8'});
  assert.equal(baselinePaths.status,0);
  const trackedMigrations=baselinePaths.stdout.trim().split('\n').filter(p=>p.endsWith('.sql'));
  assert.equal(trackedMigrations.length,114);
  const applied=sql('select version from supabase_migrations.schema_migrations order by version').split('\n');
  const missing=trackedMigrations.filter(p=>!applied.includes(p.split('/').at(-1).split('_')[0]));
  assert.deepEqual(missing,[
    'supabase/migrations/20261029224950_terminal_counter_order_received_001.sql',
    'supabase/migrations/20261030135502_pos_advance_ux_001.sql',
  ]);
  assert.ok(applied.every(v=>trackedMigrations.some(p=>p.split('/').at(-1).startsWith(v+'_'))));
  const schemaDelta=missing.map(read).join('\n');
  const coreBody=migration.replace(/^begin;\n/m,'').replace(/\ncommit;\s*$/,'');
  const body=schemaDelta+'\n'+coreBody;
  const actor=id=>`reset role;set request.jwt.claim.sub='${id}';set role authenticated;`;
  const check=(condition,label)=>`do $c$ begin if (${condition}) is distinct from true then raise exception '${label}';end if;end $c$;`;
  const denied=(statement,state,message)=>`do $d$ begin begin ${statement};raise exception 'expected failure missing';exception when others then if sqlstate<>'${state}' or position('${message}' in sqlerrm)=0 then raise;end if;end;end $d$;`;
  const order='(select id from test_order)';
  const create=`create temp table test_position as with p as (insert into warehouse_positions(organization_id,location_id,code,position_type) values('${f.org}','${f.location}','postservice-'||extensions.gen_random_uuid()::text,'shelf') returning id) select id from p;grant select on test_position to authenticated;${actor(f.owner)} create temp table test_order as select * from public.create_order(
    target_customer_id=>'${f.customer}',target_property_id=>null,target_location_id=>'${f.location}',target_priority=>'normal',
    target_due_at=>now()+interval '1 day',target_customer_notes=>null,target_internal_notes=>null);
    select public.save_order_item(null,${order},'${f.service}','Synthetic post-service','piece',1,35,null);
    select public.transition_order_status(${order},'received',null);`;
  const complete=`select public.transition_order_status(${order},'quality_check',null);
    select public.transition_order_status(${order},'packing',null);
    select public.transition_order_ready_with_storage(${order},(select id from test_position),1,'hanging');`;
  const capture=(key,amount=35,session=f.till,orderExpr=order)=>`public.record_pos_postservice_payment(${orderExpr},${amount},'cash','${session}',null,null,'${key}',true)`;
  const pay=key=>`public.record_pos_payment(${order},35,'cash','${f.till}',null,null,'${key}')`;
  const draft=`create temp table test_invoice as select public.create_billing_draft(array[${order}],null,null,null,'simplified','{"recipient_snapshot_mode":"anonymous","customer_id":null,"customer_name":null,"customer_tax_id":null,"customer_address_line1":null,"customer_address_line2":null,"customer_city":null,"customer_postal_code":null,"customer_country_code":null,"customer_email":null}'::jsonb) as id;`;
  const invoice='(select id from test_invoice)';
  const today=`(select (now() at time zone timezone)::date from organizations where id='${f.org}')`;
  const issue=`public.issue_billing_invoice(${invoice},${today},'local_laundry_dry_cleaning','consumer',true)`;
  const run=async(name,statements)=>t.test(name,()=>sql(`begin;set local lock_timeout='2s';set local statement_timeout='20s';${body}${create}${statements}reset role;rollback;`));
  try {
    await t.test('CR-02 exact 112/114 delta applies transactionally without changing Billing/POS/refund functions',()=>{
      const names="'record_pos_payment','record_pos_refund','issue_billing_invoice','protect_billing_invoice_payment_link'";
      const hashes=`select proname||':'||oid::text||':'||md5(prosrc)||':'||coalesce(proacl::text,'') from pg_proc where pronamespace='public'::regnamespace and proname in (${names}) order by oid`;
      const prior=sql(hashes);
      assert.equal(sql(`begin;${schemaDelta}${hashes};rollback;`),prior);
      const latest=read(missing.at(-1)).match(/as \$\$([\s\S]*?)\$\$;/i)[1].trim();
      assert.equal(sql(`begin;${schemaDelta}select prosrc from pg_proc where pronamespace='public'::regnamespace and proname='submit_shop_terminal_order';rollback;`),latest);
    });
    for (const amount of [35,17.5]) await run(`valid S06 ${amount}: one original payment, same gross/tax, immutable evidence and replay`,`${complete}
      create temp table first_payment as select ${capture(randomUUID(),amount)} as id;
      ${draft} create temp table issued as select * from ${issue};
      ${check(`(select count(*)=1 and sum(amount)=${amount} from payments where order_id=${order})`,'single payment')}
      ${check(`(select total=35 and taxable_base=32.71 and tax_total=2.29 from invoices where id=${invoice})`,'same gross and IGIC')}
      ${check(`(select count(*)=1 and sum(attributed_amount)=${amount} from billing_invoice_payment_links where invoice_id=${invoice})`,'single allocation')}
      ${check(`(select count(*)=1 from billing_postservice_payment_evidence where payment_id=(select id from first_payment) and declaration_timing='contemporaneous' and declared_by='${f.owner}')`,'audited evidence')}
      create temp table replay as select * from ${issue};
      ${check('(select invoice_number from issued)=(select invoice_number from replay)','same fiscal number')}
      ${denied(`update public.billing_postservice_payment_evidence set declaration_timing='retrospective'`,'42501','permission denied')}
      reset role;${denied(`delete from public.billing_postservice_payment_evidence`,'55000','billing_postservice_evidence_immutable')}`);
    await run('existing true partial advance and reconciled final remain usable',`
      create temp table advance_payment as select public.record_pos_payment(${order},10,'cash','${f.till}',null,null,'${randomUUID()}') as id;
      select public.declare_billing_advance_event(${order},(select id from advance_payment),true);
      ${draft}
      create temp table advance_document as select * from public.issue_billing_advance_invoice(${invoice},(select id from advance_payment),'local_laundry_dry_cleaning','consumer',true);
      ${complete}
      create temp table balance_payment as select public.record_pos_payment(${order},25,'cash','${f.till}',null,null,'${randomUUID()}') as id;
      select * from public.issue_billing_final_after_advances(${invoice},(select id from balance_payment),${today},'local_laundry_dry_cleaning','consumer',true);
      ${check(`(select total=25 and operation_total=35 and documented_advance_total=10 from invoices where id=${invoice})`,'preserved advance final reconciliation')}
      ${check(`(select count(*)=2 and sum(amount)=35 from payments where order_id=${order})`,'only original advance and balance')}`);
    await run('existing true full-prepayment branch remains usable',`
      create temp table advance_payment as select ${pay(randomUUID())} as id;
      select public.declare_billing_advance_event(${order},(select id from advance_payment),true);${draft}
      select * from public.issue_billing_advance_invoice(${invoice},(select id from advance_payment),'local_laundry_dry_cleaning','consumer',true);
      ${check(`(select document_status='issued' and billing_event_kind='advance' and total=35 from invoices where id=${invoice})`,'preserved full prepayment')}`);
    await run('missing confirmation fails without a payment',`${complete}
      ${denied(`perform public.record_pos_postservice_payment(${order},35,'cash','${f.till}',null,null,'${randomUUID()}',false)`,'22023','confirmation_required')}
      ${check(`not exists(select 1 from payments where order_id=${order})`,'no payment')}`);
    await run('real pre-service payment cannot be retrofitted into S06',`create temp table old_payment as select ${pay(randomUUID())} as id;${complete}${draft}
      ${denied(`perform * from ${issue}`,'55000','billing_advance_workflow_required')}
      ${denied(`perform public.record_pos_postservice_payment(${order},35,'cash','${f.till}',null,null,(select idempotency_key from payments where id=(select id from old_payment)),true)`,'55000','historical_payment_review_required')}`);
    await run('completion missing rejects capture atomically',`${denied(`perform ${capture(randomUUID())}`,'55000','history_review_required')}
      ${check(`not exists(select 1 from payments where order_id=${order})`,'no payment on rejected capture')}`);
    const key=randomUUID();
    await run('capture idempotent; conflicting replay cannot alter original statement',`${complete}
      create temp table p as select ${capture(key)} as id;select ${capture(key)};
      ${denied(`perform ${capture(key,34)}`,'23505','pos_idempotency_conflict')}
      ${check(`(select count(*)=1 from payments where order_id=${order})`,'one replayed payment')}`);
    await run('retrospective statement cannot unlock issuance',`${complete}select ${capture(randomUUID())};${draft}
      reset role;alter table billing_postservice_payment_evidence disable trigger billing_postservice_evidence_guard;
      update billing_postservice_payment_evidence set declaration_timing='retrospective' where order_id=${order};
      alter table billing_postservice_payment_evidence enable trigger billing_postservice_evidence_guard;
      ${actor(f.owner)}${denied(`perform * from ${issue}`,'55000','billing_advance_workflow_required')}`);
    await run('refund after capture blocks fiscal issue',`${complete}create temp table p as select ${capture(randomUUID())} as id;${draft}
      select public.record_pos_refund((select id from p),1,'Synthetic refund','${f.till}','${randomUUID()}');
      reset role;create temp table refund_counter_before as select next_value from billing_invoice_number_counters where organization_id='${f.org}' and series=(select series from invoices where id=${invoice});grant select on refund_counter_before to authenticated;${actor(f.owner)}
      ${denied(`perform * from ${issue}`,'55000','billing_advance_workflow_required')}
      ${check(`(select document_status='draft' and invoice_number is null from invoices where id=${invoice})`,'refund leaves draft unissued')}
      ${check(`not exists(select 1 from billing_invoice_payment_links where invoice_id=${invoice})`,'refund creates no allocation')}
      reset role;${check(`(select next_value from billing_invoice_number_counters where organization_id='${f.org}' and series=(select series from invoices where id=${invoice}))=(select next_value from refund_counter_before)`,'refund consumes no number')}
      ${check(`(select count(*)=2 from payments where order_id=${order})`,'only original payment and refund')}`);
    await run('contradictory prior pre-service declaration blocks issue',`${complete}select ${capture(randomUUID())};${draft}
      reset role;set request.jwt.claim.sub='${f.owner}';set local app.billing_advance_event_mutation='on';
      insert into billing_advance_event_declarations(organization_id,order_id,payment_id,payment_amount,payment_paid_at,service_not_performed_confirmed,declared_by,declared_at)
        select organization_id,order_id,id,amount,paid_at,true,'${f.owner}',clock_timestamp() from payments where order_id=${order};
      ${actor(f.owner)}${denied(`perform * from ${issue}`,'55000','billing_advance_workflow_required')}`);
    await run('portal identity denied; missing POS session denied',`${complete}${actor(f.portal)}
      ${denied(`perform ${capture(randomUUID())}`,'P0001','single active organization membership required')}
      ${actor(f.owner)}${denied(`perform public.record_pos_postservice_payment(${order},35,'cash',null,null,null,'${randomUUID()}',true)`,'55000','pos_session_not_open')}`);
    await run('staff cannot read Billing evidence, issue invoices or write evidence directly',`${complete}select ${capture(randomUUID())};${draft}
      ${actor(f.staff)}
      ${check('not exists(select 1 from billing_postservice_payment_evidence)','staff evidence hidden')}
      ${denied(`perform * from ${issue}`,'42501','billing_not_authorized')}
      ${denied(`insert into billing_postservice_payment_evidence select * from billing_postservice_payment_evidence`,'42501','permission denied')}`);
    await run('ambiguous completion history blocks capture',`${complete}reset role;
      set local app.workflow_transition='on';
      insert into order_status_history(organization_id,order_id,from_status,to_status,changed_by)
        values('${f.org}',${order},'ready','completed','${f.owner}');
      ${actor(f.owner)}${denied(`perform ${capture(randomUUID())}`,'55000','history_review_required')}
      ${check(`not exists(select 1 from payments where order_id=${order})`,'no ambiguous payment')}`);
    await run('non-today service date remains blocked',`${complete}select ${capture(randomUUID())};${draft}
      ${denied(`perform * from public.issue_billing_invoice(${invoice},${today}-1,'local_laundry_dry_cleaning','consumer',true)`,'22023','billing_service_date_review_required')}`);
    await t.test('concurrent POS session lock blocks opt-in capture without a partial payment',async()=>{
      const holder=spawn('docker',args,{stdio:['pipe','pipe','pipe']});
      let output='',errors='';holder.stdout.on('data',chunk=>{output+=chunk;});holder.stderr.on('data',chunk=>{errors+=chunk;});
      const exit=new Promise((resolve,reject)=>{holder.on('error',reject);holder.on('close',code=>resolve(code));});
      try {
        holder.stdin.write(`begin;set local idle_in_transaction_session_timeout='15s';select id from pos_sessions where id='${f.till}' for update;select 'S06_LOCK_READY';\n`);
        const deadline=Date.now()+5000;
        while(!output.includes('S06_LOCK_READY')){assert.ok(Date.now()<deadline,errors||'lock holder not ready');await new Promise(resolve=>setTimeout(resolve,20));}
        sql(`begin;set local lock_timeout='200ms';set local statement_timeout='5s';${body}set local lock_timeout='200ms';${create}${complete}
          ${denied(`perform ${capture(randomUUID())}`,'55P03','lock timeout')}
          ${check(`not exists(select 1 from payments where order_id=${order})`,'no concurrent partial payment')}
          reset role;rollback;`);
      } finally {
        holder.stdin.end('rollback;\n');
        assert.equal(await exit,0,errors);
      }
    });
    await run('cross-tenant order denied without revealing or modifying it',`${complete}reset role;
      create temp table foreign_customer as with c as (insert into customers(organization_id,customer_type,display_name) select id,'individual','Synthetic S06 foreign customer' from organizations where id<>'${f.org}' and status='active' and deleted_at is null limit 1 returning id,organization_id) select * from c;
      create temp table foreign_order as with o as (insert into orders(organization_id,customer_id,location_id,order_number) select organization_id,id,(select l.id from locations l where l.organization_id=foreign_customer.organization_id and l.is_active and l.deleted_at is null limit 1),'S06-TEST-'||extensions.gen_random_uuid()::text from foreign_customer returning id) select * from o;grant select on foreign_order to authenticated;
      ${check('(select count(*)=1 from foreign_order)','foreign fixture required')}${actor(f.owner)}
      ${denied(`perform ${capture(randomUUID(),35,f.till,'(select id from foreign_order)')}`,'22023','order_invalid')}`);
    // Two real PostgreSQL backends, no committed test writes. The canonical
    // laboratory has no committed completed+attested fixture, so the issuer
    // transaction creates a synthetic draft/evidence and stages completion with
    // a non-key UPDATE. This fixture does not manufacture payment history.
    // A test-only rendezvous pauses AFTER the real eligibility guard; it changes
    // no predicates, locks or financial writes of either RPC.
    const peerSession = label => {
      const child=spawn('docker',args,{stdio:['pipe','pipe','pipe']});
      let out='',err='';
      child.stdout.on('data',c=>{out+=c;});child.stderr.on('data',c=>{err+=c;});
      const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>resolve(code));});
      const wait=async marker=>{const deadline=Date.now()+10000;while(!out.includes(marker)&&!err.includes(marker)){
        assert.ok(Date.now()<deadline&&!err.includes('ERROR:'),`${label} waiting ${marker}: ${out}\n${err}`);
        await new Promise(resolve=>setTimeout(resolve,10));
      }};
      return {child,done,wait,send:q=>child.stdin.write(q+'\n'),out:()=>out,err:()=>err};
    };
    const sourcePayment=sql(`select p.id||'/'||p.order_id from payments p
      where p.organization_id='${f.org}' and p.channel='pos' and p.status='confirmed'
        and p.amount=35 and p.pos_session_id='${f.till}'
        and not exists(select 1 from invoice_orders l where l.order_id=p.order_id)
        and not exists(select 1 from payments r where r.refunded_from_payment_id=p.id)
      order by p.id limit 1`).split('/');
    assert.equal(sourcePayment.length,2,'committed synthetic POS source required');
    const [sharedPayment,sharedOrder]=sourcePayment;
    const concurrentSetup=`set request.jwt.claim.sub='${f.owner}';
      set local app.workflow_transition='on';
      update orders set production_status='completed',completed_at=transaction_timestamp()
        where id='${sharedOrder}';
      create temp table cr_completion as with h as (
        insert into order_status_history(organization_id,order_id,from_status,to_status,changed_by,changed_at)
        values('${f.org}','${sharedOrder}','ready','completed','${f.owner}',transaction_timestamp()) returning id
      ) select id from h;
      set local app.billing_postservice_capture='on';
      insert into cr_evidence
        (organization_id,order_id,payment_id,completion_history_id,service_performed_on,declaration_timing,declared_by,declared_at)
        values('${f.org}','${sharedOrder}','${sharedPayment}',(select id from cr_completion),${today},'contemporaneous','${f.owner}',clock_timestamp());
      set local app.billing_postservice_capture='off';
      set local app.billing_mutation='on';
      create temp table cr_invoice as select extensions.gen_random_uuid() as id;grant select on cr_invoice to authenticated;
      insert into invoices select (jsonb_populate_record(null::invoices,to_jsonb(i)||jsonb_build_object('id',(select id from cr_invoice)))).*
        from invoices i where i.id=(select id from invoices where organization_id='${f.org}' and fiscal_document_type='simplified' and document_status='draft' and total=35 limit 1);
      insert into invoice_items select (jsonb_populate_record(null::invoice_items,to_jsonb(it)||jsonb_build_object('id',extensions.gen_random_uuid(),'invoice_id',(select id from cr_invoice),'source_order_id','${sharedOrder}','source_order_item_id',(select id from order_items where order_id='${sharedOrder}' and is_active limit 1)))).*
        from invoice_items it where it.invoice_id=(select id from invoices where organization_id='${f.org}' and fiscal_document_type='simplified' and document_status='draft' and total=35 and id<>(select id from cr_invoice) limit 1);
      insert into invoice_orders(organization_id,invoice_id,order_id,billing_link_role,is_active)
        values('${f.org}',(select id from cr_invoice),'${sharedOrder}','final',true);
      set local app.billing_mutation='off';`;
    const concurrentIssue=`select * from public.issue_billing_invoice((select id from cr_invoice),${today},'local_laundry_dry_cleaning','consumer',true);`;
    const rendezvous=`raise notice 'CR_GUARD_PASSED';
      for cr_wait in 1..600 loop
        exit when pg_backend_pid()=any(pg_blocking_pids(current_setting('test.s06.peer_pid')::int));
        perform pg_sleep(0.01);
      end loop;
      if not(pg_backend_pid()=any(pg_blocking_pids(current_setting('test.s06.peer_pid')::int))) then
        raise exception 'CR peer never waited on issuer';
      end if;`;
    await t.test('CR-01 original issuer/refund interleaving reproduces 40P01',async()=>{
      const a=peerSession('issuer'),b=peerSession('refund');
      try {
        b.send(`select 'PEER_PID:'||pg_backend_pid();`);await b.wait('PEER_PID:');
        const pid=b.out().match(/PEER_PID:(\d+)/)[1];
        const originalCore=coreBody.replace(/  -- CR-01: match[\s\S]*?  -- CR-01 end.\n/,'')
          .replace('  postservice_locked_payment_ids uuid[] := array[]::uuid[];\n  payment_lock record;\n','')
          .replace('      and p.id=any(postservice_locked_payment_ids)\n','');
        const concurrentBody=originalCore.slice(originalCore.indexOf('create or replace function public.issue_billing_invoice(')).replaceAll('public.billing_postservice_payment_evidence','pg_temp.cr_evidence');
        const instrumented=concurrentBody.replace('  postservice_payment_id uuid;','  postservice_payment_id uuid;\n  cr_wait integer;')
          .replace('  if postservice_payment_id is not null then',`  ${rendezvous}\n  if postservice_payment_id is not null then`);
        a.send(`begin;set local statement_timeout='12s';${schemaDelta}create temp table cr_evidence(organization_id uuid,order_id uuid,payment_id uuid,completion_history_id uuid,service_performed_on date,declaration_timing text,declared_by uuid,declared_at timestamptz);${instrumented}${concurrentSetup}${actor(f.owner)}set test.s06.peer_pid='${pid}';${concurrentIssue}`);
        await a.wait('CR_GUARD_PASSED');
        b.send(`begin;set local statement_timeout='12s';${actor(f.owner)}select public.record_pos_refund('${sharedPayment}',1,'Synthetic CR-01','${f.till}','${randomUUID()}');rollback;select 'REFUND_DONE';`);
        // Either backend may be the deadlock victim. ON_ERROR_STOP closes it and
        // PostgreSQL rolls its entire transaction back, releasing its locks.
        const deadline=Date.now()+10000;
        while(!(a.err()+b.err()).includes('40P01')){assert.ok(Date.now()<deadline,a.err()+b.err());await new Promise(resolve=>setTimeout(resolve,10));}
        assert.match(a.err()+b.err(),/40P01/);
      } finally {
        a.child.stdin.end('rollback;\n');b.child.stdin.end('rollback;\n');
        await Promise.all([a.done,b.done]);
      }
    });
    const tempEvidence='create temp table cr_evidence(organization_id uuid,order_id uuid,payment_id uuid,completion_history_id uuid,service_performed_on date,declaration_timing text,declared_by uuid,declared_at timestamptz);';
    const fixedIssuer=coreBody.slice(coreBody.indexOf('create or replace function public.issue_billing_invoice('))
      .replaceAll('public.billing_postservice_payment_evidence','pg_temp.cr_evidence');
    // Shared-table DDL is deliberately excluded from these two-backend probes:
    // CREATE TABLE ... REFERENCES payments holds a ShareRowExclusiveLock until
    // rollback and masks the real runtime ordering. Full DDL/RLS/constraints are
    // exercised separately by every ordinary SQL case above.
    for(const peerKind of ['refund','POS replay']) await t.test(`CR-01 issuer first serializes ${peerKind}, no deadlock or duplicates`,async()=>{
      const a=peerSession('issuer first'),b=peerSession(peerKind);
      try {
        b.send("select 'PEER_PID:'||pg_backend_pid();");await b.wait('PEER_PID:');
        const pid=b.out().match(/PEER_PID:(\d+)/)[1];
        const instrumented=fixedIssuer.replace('  postservice_payment_id uuid;','  postservice_payment_id uuid;\n  cr_wait integer;')
          .replace('  if postservice_payment_id is not null then',`  ${rendezvous}\n  if postservice_payment_id is not null then`);
        a.send(`begin;set local statement_timeout='12s';${schemaDelta}${tempEvidence}${instrumented}${concurrentSetup}${actor(f.owner)}
          set test.s06.peer_pid='${pid}';${concurrentIssue}
          ${check(`(select count(*)=1 from billing_invoice_payment_links where invoice_id=(select id from cr_invoice))`,'one attribution')}
          create temp table cr_first_number as select invoice_number from invoices where id=(select id from cr_invoice);
          ${concurrentIssue}
          ${check('(select invoice_number from cr_first_number)=(select invoice_number from invoices where id=(select id from cr_invoice))','replay preserves number')}
          select 'ISSUED_ONCE';`);
        await a.wait('CR_GUARD_PASSED');
        const operation=peerKind==='refund'
          ? `select public.record_pos_refund('${sharedPayment}',1,'Synthetic CR-01','${f.till}','${randomUUID()}');
             ${check(`(select count(*)=1 from payments where refunded_from_payment_id='${sharedPayment}' and status='refunded')`,'single staged refund')}`
          : `select public.record_pos_payment('${sharedOrder}',35,(select method from payments where id='${sharedPayment}'),'${f.till}',null,null,
              (select idempotency_key from payments where id='${sharedPayment}'));
             ${check(`(select count(*)=1 from payments where order_id='${sharedOrder}')`,'single replayed payment')}`;
        b.send(`begin;set local statement_timeout='12s';${actor(f.owner)}${operation}select 'PEER_FINISHED';rollback;`);
        await a.wait('ISSUED_ONCE');
        assert.ok(!b.out().includes('PEER_FINISHED'),'peer must wait until issuer transaction ends');
        assert.equal(sql(`select ${pid} in (select pid from pg_stat_activity where wait_event_type='Lock')`),'t');
        a.child.stdin.end('rollback;\n');assert.equal(await a.done,0,a.err());
        await b.wait('PEER_FINISHED');b.child.stdin.end();assert.equal(await b.done,0,b.err());
        assert.doesNotMatch(a.err()+b.err(),/40P01|55P03|ERROR:/);
      } finally {
        if(!a.child.stdin.writableEnded)a.child.stdin.end('rollback;\n');
        if(!b.child.stdin.writableEnded)b.child.stdin.end('rollback;\n');
        await Promise.all([a.done,b.done]);
      }
    });
    await t.test('CR-01 refund first: issuer cannot pass guard until refund transaction ends; rollback permits issue',async()=>{
      const a=peerSession('issuer second'),b=peerSession('refund first');
      try {
        b.send(`begin;set local statement_timeout='12s';${actor(f.owner)}select public.record_pos_refund('${sharedPayment}',1,'Synthetic refund first','${f.till}','${randomUUID()}');select 'REFUND_STAGED:'||pg_backend_pid();`);
        await b.wait('REFUND_STAGED:');const bPid=b.out().match(/REFUND_STAGED:(\d+)/)[1];
        a.send(`begin;set local statement_timeout='12s';${schemaDelta}${tempEvidence}${fixedIssuer}${concurrentSetup}${actor(f.owner)}
          select 'ISSUER_PID:'||pg_backend_pid();${concurrentIssue}select 'ISSUED_AFTER_ROLLBACK';`);
        await a.wait('ISSUER_PID:');const aPid=a.out().match(/ISSUER_PID:(\d+)/)[1];
        const deadline=Date.now()+6000;
        while(sql(`select ${bPid}=any(pg_blocking_pids(${aPid}))`)!=='t'){
          assert.ok(Date.now()<deadline,a.err());await new Promise(resolve=>setTimeout(resolve,10));
        }
        assert.ok(!a.out().includes('ISSUED_AFTER_ROLLBACK'));
        b.child.stdin.end('rollback;\n');assert.equal(await b.done,0,b.err());
        await a.wait('ISSUED_AFTER_ROLLBACK');a.child.stdin.end('rollback;\n');assert.equal(await a.done,0,a.err());
        assert.doesNotMatch(a.err()+b.err(),/40P01|55P03|ERROR:/);
      } finally {
        if(!a.child.stdin.writableEnded)a.child.stdin.end('rollback;\n');
        if(!b.child.stdin.writableEnded)b.child.stdin.end('rollback;\n');
        await Promise.all([a.done,b.done]);
      }
    });
  } finally {
    assert.equal(sql(fingerprints),before,'pre-existing rows/counters/migration history changed');
    assert.equal(sql(definitions),beforeDefs,'pre-existing functions/ACLs changed');
    assert.equal(sql("select md5(string_agg(pg_get_constraintdef(oid),E'\\n' order by oid)) from pg_constraint where connamespace='public'::regnamespace"),schemaBefore);
    assert.equal(sql("select to_regclass('public.billing_postservice_payment_evidence') is null"),'t');
  }
});

// Execute real TSX/server action branches with transport doubles. SQL above is
// the separate authorization/data-integrity proof; this is not browser UAT.
import ts from 'typescript';
import { runInNewContext } from 'node:vm';
const treeNodes = node => Array.isArray(node) ? node.flatMap(treeNodes)
  : node?.props ? [node,...treeNodes(node.props.children)] : [];
function loadModule(path, resolve, append='') {
  const exports={};
  runInNewContext(ts.transpileModule(read(path)+append,{compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,
  }}).outputText,{exports,require:resolve,FormData,crypto:globalThis.crypto,console:{error(){}}});
  return exports;
}
const jsx=(type,props)=>({type,props});
test('Billing rendering chooses service only for the matching single confirmed payment evidence',async()=>{
  const actions={issueSimplifiedBillingInvoiceAction(){},issueBillingAdvanceAction(){},declareBillingAdvanceAction(){},
    issueBillingFinalAfterAdvancesAction(){},deleteBillingDraftAction(){},updateBillingDraftAction(){},issueBillingInvoiceAction(){}};
  const loaded=loadModule('src/components/billing/BillingInvoiceView.tsx',name=>{
    if(name==='react/jsx-runtime')return {jsx,jsxs:jsx,Fragment:'fragment'};
    if(name==='next-intl/server')return {getTranslations:async()=>key=>key};
    if(name==='@/features/billing/server/actions')return actions;
    if(name==='@/i18n/navigation')return {Link:'a'};
    if(name==='@/lib/number-format')return {formatCurrency:String,formatQuantity:String};
    if(name==='@/features/billing/tax-rate')return {formatTaxRate:String,taxRateInputValue:String};
    if(name.startsWith('@/components/'))return new Proxy({},{get:(_,key)=>String(key)});
    throw Error(`unexpected import ${name}`);
  });
  const payment={id:'payment',orderId:'order',paidAt:'2026-11-06T12:00:00Z',amount:35,status:'confirmed',method:'cash'};
  const base={invoice:{id:'invoice',orderIds:['order'],orderNumbers:['EW-TEST'],documentStatus:'draft',fiscalDocumentType:'simplified',paymentStatus:'paid',currency:'EUR',total:35,subtotal:35,discountTotal:0,taxableBase:32.71,taxTotal:2.29},items:[],payments:[payment],simplifiedIssuanceReady:true};
  for(const [evidence,expected] of [[undefined,false],[{paymentId:'other'},false],[{paymentId:'payment',servicePerformedOn:'2026-11-06'},true]]) {
    const tree=await loaded.BillingInvoiceView({detail:{...base,postServiceEvidence:evidence},locale:'it'});
    const forms=treeNodes(tree).filter(n=>n.type==='form');
    assert.equal(forms.some(n=>n.props.action?.name==='bound issueSimplifiedBillingInvoiceAction'),expected);
    assert.equal(forms.some(n=>n.props.action?.name==='bound declareBillingAdvanceAction'),!expected);
  }
});

test('POS checkbox is explicit, optional and not preselected; incomplete orders keep the previous form',()=>{
  const loaded=loadModule('src/components/pos/PosWorkspace.tsx',name=>{
    if(name==='react/jsx-runtime')return {jsx,jsxs:jsx,Fragment:'fragment'};
    if(name==='react')return {useState:initial=>[typeof initial==='function'?initial():initial,()=>{}],useActionState:(_,initial)=>[initial,()=>{},false]};
    if(name==='@/i18n/navigation')return {Link:'a'};
    if(name==='@/lib/number-format')return {formatCurrency:String};
    if(name.startsWith('@/components/'))return new Proxy({},{get:(_,key)=>String(key)});
    throw Error(`unexpected import ${name}`);
  },'\nexport { PaymentForm };');
  const text={common:{amount:'Amount',reference:'Reference'},orders:{method:'Method',postServiceConfirm:'Explicit service confirmation'},methods:{},actions:{pay:'Pay'}};
  for(const status of ['completed','received']) {
    const tree=loaded.PaymentForm({action:async()=>{},order:{id:'order',outstanding:35,productionStatus:status},session:{id:'session'},text});
    const checkbox=treeNodes(tree).find(n=>n.props.name==='postServiceConfirmed');
    assert.equal(Boolean(checkbox),status==='completed');
    if(checkbox){assert.equal(checkbox.props.defaultChecked,undefined);assert.equal(checkbox.props.checked,undefined);assert.equal(checkbox.props.required,undefined);}
  }
});

test('POS server action selects only the requested RPC, preserves amounts and gates before writing',async()=>{
  for(const flag of [false,true,'malformed','duplicate','unauthorized']) {
    const calls=[];
    const input={amount:35,method:'cash',orderId:'order',sessionId:'session',reference:'',notes:'',idempotencyKey:'key'};
    const loaded=loadModule('src/features/pos/server/actions.ts',name=>{
      if(name==='next/cache')return {revalidatePath(){}};
      if(name==='@/features/billing/postservice-declaration')return {parsePostServiceConfirmation};
      if(name==='@/features/pos/validation')return {parsePosPayment:()=>({valid:true,fieldErrors:{},input})};
      if(name==='@/features/pos/server/access')return {requirePosAccess:async()=>{if(flag==='unauthorized')throw Error('DENIED');}};
      if(name==='@/lib/supabase/server')return {createSupabaseServerClient:async()=>({rpc:async(name,args)=>{calls.push({name,args});return {error:null};}})};
      if(name==='@/features/pos/providers/types')return {MANUAL_CARD_PROVIDER:'manual'};
      if(name==='@/lib/daily-close-error')return {isBusinessDayClosedError:()=>false};
      throw Error(`unexpected import ${name}`);
    });
    const form=new FormData();
    if(flag)form.append('postServiceConfirmed',flag==='malformed'?'yes':'confirmed');
    if(flag==='duplicate')form.append('postServiceConfirmed','confirmed');
    if(flag==='unauthorized'){await assert.rejects(loaded.recordPosPaymentAction('it',undefined,form),/DENIED/);assert.equal(calls.length,0);continue;}
    const state=await loaded.recordPosPaymentAction('it',undefined,form);
    if(flag==='malformed'||flag==='duplicate'){assert.equal(state.formError,'validation');assert.equal(calls.length,0);continue;}
    assert.equal(calls.length,1);assert.equal(calls[0].name,flag?'record_pos_postservice_payment':'record_pos_payment');
    assert.equal(calls[0].args.target_amount,35);assert.equal(calls[0].args.target_idempotency_key,'key');
    assert.equal(calls[0].args.target_confirmed,flag?true:undefined);
  }
});
