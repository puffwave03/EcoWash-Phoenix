import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { isAbsolute } from 'node:path';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const migration=read('supabase/migrations/20261106195446_restore_operational_documents_001.sql');
function recoveryConfiguration(env) {
  return {
    lab: env.PHOENIX_MANAGEMENT_RECOVERY_LAB || '/Volumes/DEV/Phoenix-FINANCIAL-GUARD-2A-LOCAL',
    container: env.PHOENIX_MANAGEMENT_RECOVERY_CONTAINER || 'supabase_db_phoenix-financial-guard-2a-local-001',
    enabled: Boolean(env.PHOENIX_MANAGEMENT_RECOVERY_LAB),
  };
}
function validateLocalTarget(lab, container) {
  assert.ok(isAbsolute(lab) && !lab.startsWith('//'), 'An absolute local laboratory path is required');
  assert.match(container, /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/, 'A Docker container name, not an endpoint, is required');
}
function localDockerArgs(endpoint) {
  assert.match(endpoint, /^unix:\/\/\/[^\s]+$/, 'Remote Docker endpoints are forbidden');
  return ['--host', endpoint];
}
const { lab, container, enabled } = recoveryConfiguration(process.env);

test('laboratory path and container are configurable without implicit runtime opt-in',()=>{
  const defaults=recoveryConfiguration({});
  assert.equal(defaults.enabled,false);
  const configured=recoveryConfiguration({PHOENIX_MANAGEMENT_RECOVERY_LAB:'/tmp/isolated-lab',PHOENIX_MANAGEMENT_RECOVERY_CONTAINER:'local-test-db'});
  assert.deepEqual(configured,{lab:'/tmp/isolated-lab',container:'local-test-db',enabled:true});
  assert.equal(recoveryConfiguration({PHOENIX_MANAGEMENT_RECOVERY_CONTAINER:'local-test-db'}).enabled,false);
  validateLocalTarget(configured.lab,configured.container);
  for(const path of ['https://remote.example/lab','relative-lab','//remote/lab']) assert.throws(()=>validateLocalTarget(path,configured.container));
  for(const name of ['tcp://remote:2375','--host','host/db']) assert.throws(()=>validateLocalTarget(configured.lab,name));
  assert.deepEqual(localDockerArgs('unix:///var/run/docker.sock'),['--host','unix:///var/run/docker.sock']);
  for(const endpoint of ['tcp://127.0.0.1:2375','ssh://remote','https://remote','']) assert.throws(()=>localDockerArgs(endpoint));
});

// Historical migrations remain intact. Only this forward-only proposal is
// exercised, transactionally, on the explicitly selected existing local lab.
test('recovery SQL uses restrictive retirement and preserves historical economic models',()=>{
 assert.doesNotMatch(migration,/cascade|delete from|truncate|update public\.(payments|orders|invoices)/i);
 assert.match(migration,/operational_recovery_s06_evidence_not_empty/);
 for(const name of ['record_pos_postservice_payment','declare_billing_advance_event','issue_billing_advance_invoice','issue_billing_final_after_advances','reserve_billing_simplified_series'])assert.ok(migration.includes('drop function public.'+name));
 for(const table of ['billing_invoice_payment_links','billing_advance_event_declarations','invoice_orders','invoices','payments','operational_receipts'])assert.ok(!migration.includes('drop table public.'+table));
});

test('operational application never invokes retired fiscal writers or asks for S06 statements',()=>{
 const pos=read('src/features/pos/server/actions.ts');
 assert.match(pos,/rpc\("record_pos_payment"/);
 assert.doesNotMatch(pos,/record_pos_postservice_payment|postServiceConfirmed/);
 assert.doesNotMatch(read('src/components/pos/PosWorkspace.tsx'),/postServiceConfirmed/);
 const billing=read('src/features/billing/server/actions.ts');
 assert.doesNotMatch(billing,/issueSimplifiedBillingInvoiceAction|issueBillingAdvanceAction|issueBillingFinalAfterAdvancesAction|declareBillingAdvanceAction|reserveBillingSimplifiedSeriesAction/);
 for(const locale of ['it','es','en','fr','de']){
  const text=JSON.parse(read(`src/i18n/${locale}/common.json`));
  assert.equal(text.pos.orders.postServiceConfirm,undefined);
  assert.equal(text.billing.document.recipientHelp,undefined);
  assert.ok(text.billing.document.retiredWorkflow.length>20);
  assert.ok(text.billing.document.anonymousRecipient.length>0);
  assert.ok(text.print.actions.receipt.includes('REC'));
 }
});

test('canonical Supabase lab: ordinary management, historical integrity and rollback',{
 skip:enabled?false:'RUNTIME_NOT_VERIFIED: select the canonical lab explicitly',timeout:180000,
},async t=>{
  validateLocalTarget(lab,container);
  let endpoint=process.env.DOCKER_HOST;
  if(!endpoint){
    const context=spawnSync('docker',['context','inspect','--format','{{json .Endpoints.docker.Host}}'],{encoding:'utf8',timeout:10000});
    assert.ifError(context.error);assert.equal(context.status,0,context.stderr);
    endpoint=JSON.parse(context.stdout);
  }
  const docker=localDockerArgs(endpoint);
  const inspected=spawnSync('docker',[...docker,'inspect','--format','{{json .NetworkSettings.Ports}}',container],{encoding:'utf8'});
  assert.equal(inspected.status,0,inspected.stderr);
  const ports=JSON.parse(inspected.stdout)['5432/tcp'];
  assert.ok(ports.length && ports.every(p=>['127.0.0.1','::1'].includes(p.HostIp)&&p.HostPort==='56322'));
  const f=JSON.parse(readFileSync(`${lab}/runtime-evidence/fixture-manifest.json`,'utf8'));
  for(const id of Object.values(f))assert.match(id,/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
  const args=[...docker,'exec','-i','--user','postgres',container,'env','-u','PGHOST','-u','PGHOSTADDR','-u','PGPORT','-u','PGPASSWORD','-u','PGSERVICE','-u','PGSERVICEFILE','-u','PGOPTIONS','-u','PGPASSFILE','psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'];
  const sql=query=>{const r=spawnSync('docker',args,{input:query,encoding:'utf8',timeout:30000});assert.ifError(r.error);assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
  assert.equal(sql("select current_database()||'/'||current_setting('server_version')||'/'||(select count(*) from supabase_migrations.schema_migrations)"),'postgres/17.6/112');
  assert.equal(sql(`select slug from organizations where id='${f.org}'`),'fg2a-canonical-runtime');
  const tables=sql("select schemaname||'.'||tablename from pg_tables where schemaname in ('public','supabase_migrations') or (schemaname='auth' and tablename in ('users','identities')) order by 1").split('\n');
  for(const table of tables)assert.match(table,/^[a-z_]+\.[a-z_0-9]+$/);
  const fingerprints=tables.map(table=>`select '${table}:'||count(*)||':'||md5(coalesce(string_agg(to_jsonb(r)::text,E'\\n' order by to_jsonb(r)::text),'')) as f from ${table} r`).join(' union all ')+' order by 1';
  const definitions="select md5(string_agg(oid::text||':'||prosrc||':'||coalesce(proacl::text,'')||':'||coalesce(proconfig::text,''),E'\\n' order by oid)) from pg_proc where pronamespace='public'::regnamespace";
  const before=sql(fingerprints), beforeDefs=sql(definitions);
  const schemaBefore=sql("select md5(string_agg(pg_get_constraintdef(oid),E'\\n' order by oid)) from pg_constraint where connamespace='public'::regnamespace");
  const deltaPaths=[
    '20261029224950_terminal_counter_order_received_001.sql',
    '20261030135502_pos_advance_ux_001.sql',
    '20261106115208_billing_simplified_postservice_001.sql',
  ];
  const applied=sql('select version from supabase_migrations.schema_migrations order by version').split('\n');
  const tracked=spawnSync('git',['ls-tree','-r','--name-only','HEAD','supabase/migrations'],{encoding:'utf8'});
  assert.equal(tracked.status,0);
  const missing=tracked.stdout.trim().split('\n').filter(p=>!applied.includes(p.split('/').at(-1).split('_')[0]));
  assert.deepEqual(missing,deltaPaths.map(p=>'supabase/migrations/'+p));
  const unwrapped=s=>s.replace(/^begin;\s*$/mi,'').replace(/^commit;\s*$/mi,'');
  const schemaDelta=deltaPaths.map(p=>unwrapped(read('supabase/migrations/'+p))).join('\n');
  const correction=unwrapped(migration);
  const actor=id=>`reset role;set request.jwt.claim.sub='${id}';set role authenticated;`;
  const check=(condition,label)=>`do $c$ begin if (${condition}) is distinct from true then raise exception '${label}';end if;end $c$;`;
  const denied=(statement,state,message)=>`do $d$ begin begin ${statement};raise exception 'expected failure missing';exception when others then if sqlstate<>'${state}' or position('${message}' in sqlerrm)=0 then raise;end if;end;end $d$;`;
  const order='(select id from test_order)';
  const create=`insert into public.organization_entitlements(organization_id,feature_key,enabled,source) values('${f.org}','printing',true,'recovery_test') on conflict(organization_id,feature_key) do update set enabled=true;create temp table test_position as with p as (insert into warehouse_positions(organization_id,location_id,code,position_type) values('${f.org}','${f.location}','postservice-'||extensions.gen_random_uuid()::text,'shelf') returning id) select id from p;grant select on test_position to authenticated;${actor(f.owner)} create temp table test_order as select * from public.create_order(
    target_customer_id=>'${f.customer}',target_property_id=>null,target_location_id=>'${f.location}',target_priority=>'normal',
    target_due_at=>now()+interval '1 day',target_customer_notes=>null,target_internal_notes=>null);
    select public.save_order_item(null,${order},'${f.service}','Synthetic post-service','piece',1,35,null);
    select public.transition_order_status(${order},'received',null);`;
  const complete=`select public.transition_order_status(${order},'quality_check',null);
    select public.transition_order_status(${order},'packing',null);
    select public.transition_order_ready_with_storage(${order},(select id from test_position),1,'hanging');`;

  const ordinaryDraft=`create temp table ordinary_draft as select public.create_billing_draft(array[${order}],null,null,null) as id;`;
  const invoice='(select id from ordinary_draft)';
  const pay=(amount=35,key=randomUUID())=>`public.record_pos_payment(${order},${amount},'cash','${f.till}',null,null,'${key}')`;
  const receipt=`public.issue_operational_receipt(${order})`;
  const ledger=`select md5(coalesce(string_agg(to_jsonb(p)::text,E'\\n' order by p.id),'')) from payments p where order_id=${order}`;
  const run=(name,statements,legacy='')=>t.test(name,()=>sql(`begin;set local lock_timeout='2s';set local statement_timeout='20s';${schemaDelta}${create}${legacy}reset role;${correction}${actor(f.owner)}${statements}reset role;rollback;`));
  try{
    await t.test('corrective migration preserves canonical POS/refund/ordinary/REC function bodies and ACLs',()=>{
      const names="'record_pos_payment','record_pos_refund','issue_operational_receipt','cancel_operational_receipt','create_billing_draft','update_billing_draft','issue_billing_invoice','protect_billing_invoice_payment_link'";
      const query=`select proname||':'||oid::text||':'||md5(prosrc)||':'||coalesce(proacl::text,'') from pg_proc where pronamespace='public'::regnamespace and proname in (${names}) and not (proname='issue_billing_invoice' and pronargs=5) and not (proname='create_billing_draft' and pronargs=6) and not (proname='update_billing_draft' and pronargs=7) order by oid`;
      const pre=sql(`begin;${schemaDelta}${query};rollback;`);
      const post=sql(`begin;${schemaDelta}${correction}${query};rollback;`);
      assert.equal(post,pre);
      const retired="'record_pos_postservice_payment','declare_billing_advance_event','issue_billing_advance_invoice','issue_billing_final_after_advances','reserve_billing_simplified_series'";
      assert.equal(sql(`begin;${schemaDelta}${correction}select count(*) from pg_proc where pronamespace='public'::regnamespace and proname in (${retired});rollback;`),'0');
      assert.equal(sql(`begin;${schemaDelta}${correction}select to_regclass('public.billing_postservice_payment_evidence') is null;rollback;`),'t');
    });
    await run('ordinary invoice: canonical gross, one number, no payment creation and no duplicate order',`${complete}${ordinaryDraft}
      create temp table ledger_before as ${ledger};
      create temp table issued as select * from public.issue_billing_invoice(${invoice});
      ${check(`(select document_status='issued' and total=35 and fiscal_document_type='ordinary' from invoices where id=${invoice})`,'ordinary issued')}
      ${check(`not exists(select 1 from payments where order_id=${order})`,'invoice creates no payment')}
      ${denied(`perform public.create_billing_draft(array[${order}],null,null,null)`,'55000','billing_order_already_invoiced')}
      ${denied(`perform * from public.issue_billing_invoice(${invoice})`,'22023','billing_invalid_draft')}
      ${check(`(select count(*)=1 from invoices where id=${invoice})`,'one invoice')}`);
    await run('ordinary draft edit/delete and issued cancellation retain their canonical guards',`${ordinaryDraft}
      select public.update_billing_draft(${invoice},current_date,null,(select series from invoices where id=${invoice}),7,'Synthetic edit');
      select public.delete_billing_draft(${invoice});
      ${check(`not exists(select 1 from invoices where id=${invoice})`,'ordinary draft deleted')}
      create temp table second_draft as select public.create_billing_draft(array[${order}],null,null,null) as id;
      select * from public.issue_billing_invoice((select id from second_draft));
      select public.cancel_billing_invoice((select id from second_draft),'Synthetic cancel');
      ${check("(select document_status='cancelled' and invoice_number is not null from invoices where id=(select id from second_draft))",'cancelled number preserved')}
      ${check(`not exists(select 1 from payments where order_id=${order})`,'ordinary mutations create no payment')}`);
    await run('staff REC requires the existing POS capability as well as printing',`${actor(f.staff)}
      ${denied(`perform * from ${receipt}`,'42501','operational_receipt_not_authorized')}
      reset role;update public.organization_memberships set operational_capabilities=array['pos']::public.operational_capability[] where organization_id='${f.org}' and profile_id='${f.staff}';
      ${actor(f.staff)}select * from ${receipt};
      ${check(`(select count(*)=1 from operational_receipts where order_id=${order})`,'staff REC uses print capability')}`);
    const key=randomUUID();
    await run('canonical POS payment: idempotency, refund and REC snapshot independent of money',`
      create temp table p as select ${pay(35,key)} as id;
      ${check(`(select id from p)=${pay(35,key)}`,'same payment replay')}
      ${denied(`perform ${pay(34,key)}`,'23505','pos_idempotency_conflict')}
      create temp table ledger_before as ${ledger};
      create temp table rec as select * from ${receipt};
      create temp table replay as select * from ${receipt};
      ${check('(select receipt_id from rec)=(select receipt_id from replay)','same REC replay')}
      ${check(`(select md5 from ledger_before)=(${ledger})`,'REC never creates money')}
      reset role; create temp table snapshot_before as select snapshot from operational_receipts where id=(select receipt_id from rec);
      ${actor(f.owner)}select public.record_pos_refund((select id from p),5,'Synthetic management recovery','${f.till}','${randomUUID()}');
      ${check(`(select sum(case when status='confirmed' then amount when status='refunded' then -amount else 0 end)=30 from payments where order_id=${order})`,'canonical refund net')}
      reset role;${check('(select snapshot from operational_receipts where id=(select receipt_id from rec))=(select snapshot from snapshot_before)','historical REC snapshot')}
      ${actor(f.owner)}select public.cancel_operational_receipt((select receipt_id from rec),'Synthetic cancellation');
      create temp table next_rec as select * from ${receipt};
      ${check('(select receipt_number from next_rec)<>(select receipt_number from rec)','cancelled number not reused')}
      ${check(`(select count(*)=2 from payments where order_id=${order})`,'REC cancel/reissue never changes ledger')}`);
    await run('empty order blocks REC without consuming a number',`
      create temp table empty_order as select * from public.create_order('${f.customer}',null,'${f.location}','normal',null,null,null);
      ${denied("perform * from public.issue_operational_receipt((select id from empty_order))",'22023','operational_receipt_items_required')}
      ${check('not exists(select 1 from operational_receipts where order_id=(select id from empty_order))','empty has no REC')}`);
    await run('unauthorized and foreign-tenant identifiers fail closed',`
      ${actor(f.staff)}${denied(`perform public.create_billing_draft(array[${order}],null,null,null)`,'42501','billing_not_authorized')}
      ${actor(f.owner)}${denied(`perform * from public.issue_operational_receipt('${randomUUID()}')`,'22023','operational_receipt_order_invalid')}
      ${actor(f.portal)}${denied(`perform ${pay()}`,'P0001','single active organization membership required')}`);
    const legacyDraft=`create temp table legacy_draft as select public.create_billing_draft(array[${order}],null,null,null,'simplified','{"recipient_snapshot_mode":"anonymous","customer_id":null,"customer_name":null,"customer_tax_id":null,"customer_address_line1":null,"customer_address_line2":null,"customer_city":null,"customer_postal_code":null,"customer_country_code":null,"customer_email":null}'::jsonb) as id;`;
    const legacyInvoice='(select id from legacy_draft)';
    const legacyIssued=`create temp table legacy_payment as select ${pay(10)} as id;
      select public.declare_billing_advance_event(${order},(select id from legacy_payment),true);${legacyDraft}
      create temp table legacy_issued as select * from public.issue_billing_advance_invoice(${legacyInvoice},(select id from legacy_payment),'local_laundry_dry_cleaning','consumer',true);
      reset role;create temp table legacy_snapshot as select to_jsonb(i) as doc from invoices i where id=(select invoice_id from legacy_issued);${actor(f.owner)}`;
    await run('historical advance, draft, allocation and refund guards survive retirement',`
      reset role;${check('(select to_jsonb(i) from invoices i where id=(select invoice_id from legacy_issued))=(select doc from legacy_snapshot)','legacy invoice intact')}
      ${check(`(select count(*)=1 from billing_invoice_payment_links where payment_id=(select id from legacy_payment))`,'allocation intact')}
      ${actor(f.owner)}${denied(`perform public.update_billing_draft(${legacyInvoice},current_date,null,(select series from invoices where id=${legacyInvoice}),(select tax_rate from invoice_items where invoice_id=${legacyInvoice} limit 1),'changed')`,'55000','billing_document_workflow_retired')}
      select public.record_pos_refund((select id from legacy_payment),1,'Historical refund preserved','${f.till}','${randomUUID()}');
      ${check('(select count(*)=1 from billing_invoice_payment_links where payment_id=(select id from legacy_payment))','refund preserves immutable attribution')}
      reset role;${denied('update public.billing_invoice_payment_links set attributed_amount=1 where payment_id=(select id from legacy_payment)','55000','billing_payment_link_immutable')}${actor(f.owner)}
      reset role;${denied(`delete from public.invoices where id=${legacyInvoice}`,'55000','billing_final_draft_has_issued_advances')}`,legacyIssued);
    await run('private builder cannot create retired documents; direct privileged mutation is blocked',`
      reset role;${denied(`perform public.create_billing_draft_internal(array[${order}],null,null,null,'simplified','{"recipient_snapshot_mode":"anonymous","customer_id":null,"customer_name":null,"customer_tax_id":null,"customer_address_line1":null,"customer_address_line2":null,"customer_city":null,"customer_postal_code":null,"customer_country_code":null,"customer_email":null}'::jsonb)`,'55000','billing_document_workflow_retired')}`);
    await t.test('nonempty S06 evidence aborts migration and preserves all facts',()=>{
      const r=spawnSync('docker',args,{input:`begin;${schemaDelta}${create}${complete}select public.record_pos_postservice_payment(${order},35,'cash','${f.till}',null,null,'${randomUUID()}',true);reset role;${correction}rollback;`,encoding:'utf8',timeout:30000});
      assert.equal(r.status,3,r.stderr);assert.match(r.stderr,/55000: operational_recovery_s06_evidence_not_empty/);
    });
  }finally{
    assert.equal(sql(fingerprints),before,'all rows including Auth and migration ledger unchanged');
    assert.equal(sql(definitions),beforeDefs,'function definitions/ACL unchanged after rollback');
    assert.equal(sql("select md5(string_agg(pg_get_constraintdef(oid),E'\\n' order by oid)) from pg_constraint where connamespace='public'::regnamespace"),schemaBefore,'schema restored');
  }
});
