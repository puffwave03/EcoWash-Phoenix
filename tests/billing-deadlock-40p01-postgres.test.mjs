import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {randomUUID as uuid} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import test from 'node:test';
const container='supabase_db_phoenix-financial-guard-2a-local-001';
const args=['exec','-i','--user','postgres',container,'env','-u','PGHOST','-u','PGHOSTADDR','-u','PGPORT','-u','PGPASSWORD','-u','PGSERVICE','-u','PGSERVICEFILE','-u','PGOPTIONS','psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'];
const raw=input=>spawnSync('docker',args,{input,encoding:'utf8',timeout:20000});
const sql=input=>{const r=raw(input);assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
const failure=(input,pattern)=>{const r=raw(input);assert.notEqual(r.status,0);assert.match(r.stderr,pattern);return r;};
const claim=(actor,q)=>`set request.jwt.claim.sub='${actor}';set role authenticated;${q}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let org,location,customer,service,till;
let admin,owner,manager,staff,portal;
const user=q=>sql(claim(owner,q));
class Session {
 constructor(name,actor=owner){
  this.out='';this.err='';this.code=undefined;
  this.child=spawn('docker',args,{stdio:['pipe','pipe','pipe']});
  this.child.stdout.on('data',b=>{this.out+=b;});this.child.stderr.on('data',b=>{this.err+=b;});
  this.done=new Promise((resolve,reject)=>{this.child.on('error',reject);this.child.on('close',c=>{this.code=c;resolve(c);});});
  this.send(`begin;set local statement_timeout='15s';set local lock_timeout='8s';set local application_name='fg2a_${name}';${claim(actor,"select 'PID:'||pg_backend_pid();")}\n\\echo SESSION_READY\n`);
 }
 send(q){this.child.stdin.write(q+'\n');}
 async wait(marker){const deadline=Date.now()+18000;while(!this.out.includes(marker)){if(this.code!==undefined)throw Error(this.err||`closed ${this.code}`);if(Date.now()>deadline)throw Error(`session timeout ${marker}`);await sleep(40);}return this.out;}
 async ready(){await this.wait('SESSION_READY');this.pid=Number(this.out.match(/PID:(\d+)/)[1]);return this;}
 run(q,marker){this.send(q+`\n\\echo ${marker}\n`);}
 async commit(){if(this.code!==undefined)return;this.send('commit;\n\\q');await this.done;assert.equal(this.code,0,this.err);}
 async rollback(){if(this.code!==undefined)return;this.send('rollback;\n\\q');await this.done;}
}
const blocked=async(b,a)=>{for(let i=0;i<35;i++){if(sql(`select ${a.pid}=any(pg_blocking_pids(${b.pid}));`)==='t')return;if(b.code!==undefined)throw Error(b.err);await sleep(80);}throw Error('expected actual blocking relationship not observed');};
const save=(o,n=2)=>`select save_order_item('${o.item}','${o.id}','${service}','Synthetic canonical laundry','piece',${n},35,null);`;
const pay=(o,amount,key)=>`select record_pos_payment('${o.id}',${amount},'card','${till}',null,'Synthetic local test','${key}');`;
const anon=JSON.stringify({recipient_snapshot_mode:'anonymous',customer_id:null,customer_name:null,customer_tax_id:null,customer_address_line1:null,customer_address_line2:null,customer_city:null,customer_postal_code:null,customer_country_code:null,customer_email:null});
const draft=(o,simple=false)=>simple?`select create_billing_draft(array['${o.id}']::uuid[],null,null,null,'simplified','${anon}'::jsonb);`:`select create_billing_draft(array['${o.id}']::uuid[]);`;
const issue=(did,simple=false)=>simple?`select * from issue_billing_invoice('${did}',(now() at time zone 'Atlantic/Canary')::date,'local_laundry_dry_cleaning','consumer',true);`:`select * from issue_billing_invoice('${did}');`;
const advance=(did,pid)=>`select * from issue_billing_advance_invoice('${did}','${pid}','local_laundry_dry_cleaning','consumer',true);`;
function order(){const id=user(`select id from create_order('${customer}',null,'${location}','normal',null,'Synthetic runtime',null);`);const item=user(`select save_order_item(null,'${id}','${service}','Synthetic canonical laundry','piece',1,35,null);`);user(`select transition_order_status('${id}','received','Synthetic local handover');`);return {id,item};}
function snapshot(o){return sql(`select total||'/'||(select coalesce(sum(amount) filter(where status='confirmed'),0) from payments where order_id=o.id)||'/'||(select count(*) from payments where order_id=o.id) from orders o where id='${o.id}';`);}


const expectedLab='/Volumes/DEV/Phoenix-FINANCIAL-GUARD-2A-LOCAL';
const lab=process.env.PHOENIX_BILLING_LOCK_ORDER_LAB;
const migration=readFileSync(new URL('../supabase/migrations/20261029192215_billing_simplified_issue_lock_order_001.sql',import.meta.url),'utf8');

test('correction changes only simplified issuance lock orchestration, preserving fiscal writes',()=>{
 const original=readFileSync(new URL('../supabase/migrations/20261018000100_billing_simplified_invoice_001f_service_issuance.sql',import.meta.url),'utf8');
 const start=original.indexOf('create function public.issue_billing_invoice(\n  target_invoice_id uuid, target_service_performed_on date,');
 const body=original.slice(start,original.indexOf('\n$$;',start)+4);
 const suffix='  select * into source_customer from public.customers';
 assert.equal(migration.slice(migration.indexOf(suffix),migration.indexOf('\n$$;')+4),body.slice(body.indexOf(suffix)));
 assert.equal((migration.match(/create or replace function /g)||[]).length,1);
 assert.doesNotMatch(migration,/\b(?:drop|truncate|alter table|grant|revoke)\b/i);
});

test('canonical simplified issuance lock order: isolated PostgreSQL runtime',{
 skip:lab ? false : 'EVIDENCE GAP: explicit isolated laboratory opt-in required',timeout:180000,
},async t=>{
 assert.equal(lab,expectedLab,'only the authorized independent cluster is allowed');
 const f=JSON.parse(readFileSync(`${lab}/runtime-evidence/fixture-manifest.json`,'utf8'));
 ({org,location,customer,service,till,admin,owner,manager,staff,portal}=f);
 const old=JSON.parse(readFileSync(`${lab}/runtime-evidence/inversion-evidence.json`,'utf8'));
 assert.equal(sql("select current_database()||'/'||current_setting('server_version')"),'postgres/17.6');
 assert.equal(sql("select count(*) from supabase_migrations.schema_migrations where version='20261029192215'"),'1');
 assert.equal(sql("select pg_get_userbyid(proowner)||'/'||prosecdef||'/'||proconfig::text||'/'||proacl::text from pg_proc where oid='public.issue_billing_invoice(uuid,date,text,text,boolean)'::regprocedure"),
  'postgres/true/{search_path=public}/{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}');
 const counter=()=>Number(sql(`select next_value from billing_invoice_number_counters where organization_id='${org}' and series='TEST-S'`));
 const invoice=did=>sql(`select document_status||'/'||billing_event_kind||'/'||total from invoices where id='${did}'`);
 const frozen=()=>sql(`select md5(coalesce(jsonb_agg(to_jsonb(i) order by i.id)::text,'')) from invoices i where organization_id='${org}'`);
 const issued=did=>user(`select invoice_number from issue_billing_invoice('${did}',null,'ignored','ignored',false);`);
 const resume=process.env.PHOENIX_BILLING_LOCK_ORDER_RESUME;
 assert.ok(!resume || resume==='after_original','unsupported resume stage');
 const progressPath=`${lab}/runtime-evidence/billing-lock-order-progress.json`;
 const progress=resume?JSON.parse(readFileSync(progressPath,'utf8')):{};
 let partial=progress.partial,full,negative,failed=false;
 const run=async(name,body)=>{if(failed || resume && name.startsWith('original interleaving:'))return;await t.test(name,async()=>{try{await body();}catch(e){failed=true;throw e;}});};
 await run('original interleaving: POS/declaration first, direct issuer waits without holding invoice',async()=>{
  const o={id:old.order,item:sql(`select id from order_items where order_id='${old.order}'`)},did=old.draft;
  assert.equal(invoice(did),'draft/service/35.00');assert.equal(sql(`select count(*) from payments where order_id='${o.id}'`),'0');
  const before=counter(),a=await new Session('partial_advance').ready(),b=await new Session('direct_service').ready();
  try {
   a.run(pay(o,10,uuid()),'PAID');await a.wait('PAID');const pid=a.out.match(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/)[0];
   a.run(`select declare_billing_advance_event('${o.id}','${pid}',true);`,'DECLARED');await a.wait('DECLARED');
   b.run(issue(did,true),'SERVICE');await blocked(b,a);
   a.run(advance(did,pid),'ADVANCE');await a.wait('ADVANCE');await a.commit();
   await b.done;assert.match(b.err,/55000.*billing_simplified_fiscal_history_review_required/s);
   assert.doesNotMatch(a.err+b.err,/40P01|55P03/);
   const aid=sql(`select invoice_id from billing_invoice_payment_links where payment_id='${pid}'`);
   assert.equal(invoice(aid),'issued/advance/10.00');assert.equal(counter(),before+1);
   assert.equal(sql(`select attributed_amount from billing_invoice_payment_links where payment_id='${pid}'`),'10.00');
   const number=user(advance(did,pid));assert.equal(user(advance(did,pid)),number);assert.equal(counter(),before+1);
   partial={o,did,pid,aid};writeFileSync(progressPath,JSON.stringify({partial},null,2));
  }finally{await a.rollback();await b.rollback();}
 });
 await run('inverse interleaving: Manager service issue first, POS/declaration rolls back atomically',async()=>{
  const o=progress.inverse?.o||order(),did=progress.inverse?.did||user(draft(o,true)),before=counter();
  const a=await new Session('service_first',manager).ready(),b=await new Session('pos_second').ready();
  try {
   a.run(issue(did,true),'ISSUED');await a.wait('ISSUED');
   b.run(`select record_pos_payment('${o.id}',10,'card','${till}',null,'Synthetic inverse','${uuid()}') as pid \\gset
select declare_billing_advance_event('${o.id}',:'pid',true);`,'DECLARED');
   await blocked(b,a);await a.commit();await b.done;
   assert.match(b.err,/55000.*billing_advance_event_fiscal_history_review_required/s);assert.doesNotMatch(b.err,/40P01|55P03/);
   assert.equal(invoice(did),'issued/service/35.00');assert.equal(snapshot(o),'35.00/0/0');assert.equal(counter(),before+1);
  }finally{await a.rollback();await b.rollback();}
 });
 await run('full prepayment wins: concurrent service replay keeps original UUID and one fiscal number',async()=>{
  const o=order(),did=user(draft(o,true)),before=counter(),key=uuid();
  const a=await new Session('full_advance').ready(),b=await new Session('full_replay',manager).ready();
  try{
   a.run(pay(o,35,key),'PAID');await a.wait('PAID');const pid=a.out.match(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/)[0];
   a.run(`select declare_billing_advance_event('${o.id}','${pid}',true);`,'DECLARED');await a.wait('DECLARED');
   b.run(issue(did,true),'REPLAY');await blocked(b,a);
   a.run(advance(did,pid),'ISSUED');await a.wait('ISSUED');await a.commit();await b.wait('REPLAY');await b.commit();
   assert.doesNotMatch(a.err+b.err,/40P01|55P03/);assert.equal(invoice(did),'issued/advance/35.00');assert.equal(counter(),before+1);
   assert.equal(sql(`select count(*)||'/'||sum(total)||'/'||sum(taxable_base)||'/'||sum(tax_total) from invoices i join invoice_orders l on l.invoice_id=i.id where l.order_id='${o.id}'`),'1/35.00/32.71/2.29');
   assert.equal(sql(`select invoice_id||'/'||billing_link_role||'/'||attributed_amount from billing_invoice_payment_links where payment_id='${pid}'`),`${did}/final/35.00`);
   assert.equal(sql(`select count(*) from invoices where id='${did}' and service_performed_on is null`),'1');
   assert.equal(user(pay(o,35,key)),pid);user(advance(did,pid));issued(did);assert.equal(counter(),before+1);
   full={o,did,pid};
  }finally{await a.rollback();await b.rollback();}
 });
 await run('final after partial advance: concurrent direct replay keeps exact reconciliation and numbering',async()=>{
  const {o,did}=partial,pid=user(pay(o,25,uuid())),before=counter();
  const finalCall=`select * from issue_billing_final_after_advances('${did}','${pid}',(now() at time zone 'Atlantic/Canary')::date,'local_laundry_dry_cleaning','consumer',true);`;
  const a=await new Session('final_balance').ready(),b=await new Session('final_replay').ready();
  try{
   a.run(finalCall,'FINAL');await a.wait('FINAL');b.run(issue(did,true),'REPLAY');await blocked(b,a);await a.commit();await b.wait('REPLAY');await b.commit();
   assert.doesNotMatch(a.err+b.err,/40P01|55P03/);assert.equal(invoice(did),'issued/service/25.00');
   assert.equal(sql(`select count(*)||'/'||sum(total)||'/'||sum(taxable_base)||'/'||sum(tax_total) from invoices i join invoice_orders l on l.invoice_id=i.id where l.order_id='${o.id}'`),'2/35.00/32.71/2.29');
   assert.equal(sql(`select count(*)||'/'||count(distinct payment_id)||'/'||sum(attributed_amount) from billing_invoice_payment_links where order_id='${o.id}'`),'2/2/35.00');
   const replay=user(finalCall);assert.equal(user(finalCall),replay);issued(did);assert.equal(counter(),before+1);assert.equal(snapshot(o),'35.00/35.00/2');
  }finally{await a.rollback();await b.rollback();}
 });
 await run('issued replay survives settings disable, invalid declaration and REPEATABLE READ without writes',()=>{
  const before=counter(),snapshot=frozen();
  const result=sql(`begin isolation level repeatable read;${claim(admin,`select platform_set_simplified_invoicing_enabled('${org}',false);`)}reset role;
   ${claim(owner,`select invoice_number from issue_billing_invoice('${full.did}',null,'invalid','invalid',false);`)}rollback;`);
  assert.ok(result.includes(issued(full.did)));assert.equal(frozen(),snapshot);assert.equal(counter(),before);
 });
 await run('new issuance still requires READ COMMITTED and preserves rows/counters on denial',()=>{
  const o=order(),did=user(draft(o,true)),before=counter(),snapshot=frozen();negative={o,did};
  failure(`begin isolation level repeatable read;${claim(owner,issue(did,true))}`,/25000.*billing_simplified_read_committed_required/s);
  assert.equal(invoice(did),'draft/service/35.00');assert.equal(counter(),before);assert.equal(frozen(),snapshot);
 });
 await run('Staff, Portal and foreign tenant remain denied; helper EXECUTE stays revoked',()=>{
  const {did}=negative,before=counter(),snapshot=frozen();
  failure(claim(staff,issue(did,true)),/42501.*billing_not_authorized/s);
  failure(claim(portal,issue(did,true)),/single active organization membership required/);
  // One additional synthetic Auth identity/tenant is necessary for a true
  // foreign-tenant RPC check, not a caller-supplied organization spoof.
  const foreign=uuid();
  sql(`insert into auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
    values('${foreign}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lock-${foreign}@example.invalid',now(),'{"provider":"email"}','{}',now(),now());
    insert into auth.identities(provider_id,user_id,identity_data,provider) values('${foreign}','${foreign}',jsonb_build_object('sub','${foreign}'),'email');`);
  const foreignOrg=sql(claim(admin,`select organization_id from platform_bootstrap_tenant('${uuid()}','Synthetic foreign lock test','lock-${foreign}','EUR','Atlantic/Canary','en','ES','${foreign}','Synthetic location','FX');`));
  sql(claim(admin,`select platform_set_organization_entitlement('${foreignOrg}','billing.invoicing',true,null,null,null,'local_synthetic_test');`));
  failure(claim(foreign,issue(did,true)),/22023.*billing_invalid_draft/s);
  assert.equal(sql("select has_function_privilege('authenticated','public.assert_order_financially_mutable(uuid)','EXECUTE')||'/'||has_function_privilege('authenticated','public.recalculate_order_totals(uuid)','EXECUTE')"),'false/false');
  assert.equal(counter(),before);assert.equal(frozen(),snapshot);
 });
 await run('changed association while waiting is rejected after locks without allocating a number',async()=>{
  const {o,did}=negative,before=counter();
  const a=await new Session('association_fixture').ready(),b=await new Session('association_issuer').ready();
  try{
   a.run(save(o,1),'HELD');await a.wait('HELD');b.run(issue(did,true),'ISSUED');await blocked(b,a);
   // Privileged synthetic fixture mutation only. No grants or SQL functions
   // are changed; this negative case specifically exercises revalidation.
   a.run(`reset role;set app.billing_mutation='on';update invoice_orders set is_active=false where organization_id='${org}' and invoice_id='${did}';set role authenticated;`,'CHANGED');await a.wait('CHANGED');await a.commit();await b.done;
   assert.match(b.err,/22023.*billing_invalid_orders/s);assert.doesNotMatch(b.err,/40P01|55P03/);
   assert.equal(invoice(did),'draft/service/35.00');assert.equal(counter(),before);assert.equal(snapshot(o),'35.00/0/0');
  }finally{await a.rollback();await b.rollback();}
 });
 if(failed)console.log('STOP: no further cases run after first failure');
});
