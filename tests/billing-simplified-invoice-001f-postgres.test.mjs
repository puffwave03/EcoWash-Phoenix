import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
// OPT-IN: only an EMPTY disposable local DB; real Billing migrations/RPCs,
// synthetic source tables and auth context. Never Supabase/staging credentials.
const url = process.env.PHOENIX_BILLING_TEST_DATABASE_URL;
const read = n => readFileSync(new URL(`../supabase/migrations/${n}`,import.meta.url),"utf8");
const fn = (s,n) => s.match(new RegExp(`create (?:or replace )?function public\\.${n}\\([\\s\\S]*?\\$\\$;`))[0];
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const org=id(1),other=id(2),actor=id(3),registered=id(4),walkin=id(5),foreign=id(6);
const fixture=`
create schema auth; create schema extensions; grant usage on schema auth to authenticated;
create function extensions.gen_random_uuid() returns uuid language sql as 'select gen_random_uuid()';
create type public.app_role as enum ('owner','manager','staff');
create type public.payment_method as enum ('cash','card','bank_transfer','other');
create type public.service_unit_type as enum ('piece','weight','service','area','cycle','day');
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
create function public.app_current_organization_id() returns uuid language sql as $$select nullif(current_setting('test.org',true),'')::uuid$$;
create function public.has_organization_role(uuid,public.app_role[]) returns boolean language sql as $$select coalesce($1=public.app_current_organization_id() and auth.uid() is not null and current_setting('test.role',true)=any($2::text[]),false)$$;
create function public.organization_entitlement_is_enabled(uuid,text,timestamptz) returns boolean language sql as $$select coalesce(current_setting('test.entitled',true),'true')='true'$$;
create function public.has_organization_entitlement(uuid,text) returns boolean language sql as $$select public.organization_entitlement_is_enabled($1,$2,now())$$;
create function public.set_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;
create table public.organizations(id uuid primary key,name text,timezone text not null default 'Atlantic/Canary');
create table public.profiles(id uuid primary key);
create table public.customers(id uuid primary key,organization_id uuid not null references public.organizations,customer_code text,customer_type text,display_name text,company_name text,tax_id text,billing_address_line1 text,billing_address_line2 text,billing_city text,billing_postal_code text,billing_country_code char(2),email text,unique(organization_id,id));
create table public.orders(id uuid primary key,organization_id uuid references public.organizations,customer_id uuid not null,order_number text,currency text,production_status text,is_active boolean,discount_amount numeric(14,2),subtotal numeric(14,2),total numeric(14,2),created_at timestamptz default now(),unique(organization_id,id),foreign key(organization_id,customer_id) references public.customers(organization_id,id));
create table public.order_items(id uuid primary key,organization_id uuid not null,order_id uuid not null,description text,unit_type public.service_unit_type,quantity numeric(12,3),unit_price numeric(14,2),line_total numeric(14,2),is_active boolean,sort_order integer,created_at timestamptz default now(),foreign key(organization_id,order_id) references public.orders(organization_id,id));
create table public.organization_branding(organization_id uuid primary key,commercial_name text,business_address text,support_email text,support_phone text,logo_path text);
create table public.payments(id uuid primary key default gen_random_uuid(),organization_id uuid,order_id uuid,status text,amount numeric(14,2),paid_at timestamptz default now());
-- Minimal source dependencies for the UNMODIFIED canonical POS RPC bodies.
-- Auth/membership and operational tables remain synthetic, not HTTP/POS E2E.
alter table public.orders add column location_id uuid;
create table public.organization_memberships(organization_id uuid,profile_id uuid,is_active boolean,role public.app_role,operational_capabilities text[]);
create table public.pos_sessions(id uuid primary key,organization_id uuid,location_id uuid,status text,opened_by uuid);
alter table public.payments
  add column method public.payment_method, add column reference text, add column notes text,
  add column recorded_by uuid, add column confirmed_by uuid, add column pos_session_id uuid,
  add column channel text, add column provider text, add column provider_reference text,
  add column external_status text, add column idempotency_key uuid,
  add column refunded_from_payment_id uuid, add column refund_reason text, add column refunded_at timestamptz,
  add unique(organization_id,idempotency_key);
grant select on public.payments to authenticated;
insert into public.organizations(id,name) values('${org}','Synthetic tenant'),('${other}','Other synthetic tenant');
insert into public.profiles values('${actor}');
insert into public.organization_memberships values('${org}','${actor}',true,'owner','{}');
insert into public.pos_sessions values('${id(7)}','${org}',null,'open','${actor}');
insert into public.customers(id,organization_id,customer_code,customer_type,display_name,tax_id,billing_address_line1,billing_city,billing_postal_code,billing_country_code) values
('${registered}','${org}','REG','individual','Registered test','TEST','Test','Test','00000','ES'),
('${walkin}','${org}','WALKIN-SHARED','individual','Technical only',null,null,null,null,null),
('${foreign}','${other}','REG','individual','Other test','OTHER','Other','Other','00000','ES');
`;
const anon={recipient_snapshot_mode:"anonymous",customer_id:null,customer_name:null,customer_tax_id:null,customer_address_line1:null,customer_address_line2:null,customer_city:null,customer_postal_code:null,customer_country_code:null,customer_email:null};
const identified={...anon,recipient_snapshot_mode:"identified",customer_name:"Identified test",customer_tax_id:"TEST-NIF",customer_address_line1:"Test street",customer_city:"Test city",customer_postal_code:"00000",customer_country_code:"ES"};
const owner=`set test.org='${org}';set test.actor='${actor}';set test.role='owner';set test.entitled='true';`;
const today="(now() at time zone 'Atlantic/Canary')::date";
test("001F actual Billing service issuance, atomic counters and immutable declaration",{skip:url?false:"NOT VERIFIED: no isolated local PostgreSQL URL",timeout:180000},async t=>{
 const u=new URL(url);assert.ok(["postgres:","postgresql:"].includes(u.protocol));assert.ok(["127.0.0.1","localhost","[::1]"].includes(u.hostname));assert.match(u.pathname,/^\/phoenix_series_test_[a-z0-9_]+$/);assert.equal(u.search,"");
 const db=u.pathname.slice(1),env={...process.env,PGDATABASE:db,PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGHOST:u.hostname,PGPORT:u.port||"5432",PGSSLMODE:"disable",PGOPTIONS:"",PGSERVICE:"",PGSERVICEFILE:"",PGCONNECT_TIMEOUT:"3"};delete env.PGHOSTADDR;
 const args=["-X","-qAt","-v","ON_ERROR_STOP=1","-v","VERBOSITY=verbose"];
 const raw=s=>spawnSync("psql",args,{env,input:s,encoding:"utf8",timeout:25000});
 const sql=s=>{const r=raw(s);if(r.error)throw r.error;if(r.status!==0)throw Error(r.stderr);return r.stdout.trim();};
 const expectError=(s,re)=>{const r=raw(s);assert.notEqual(r.status,0,r.stdout);assert.match(r.stderr,re);};
 assert.equal(sql('select current_database()'),db);
 assert.equal(sql("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'"),"0");
 assert.equal(sql("select count(*) from pg_namespace where nspname='auth'"),"0");
 assert.equal(sql("select count(*) from pg_roles where rolname in ('anon','authenticated')"),"2");
 sql(fixture);
 const posFoundation=read('20260827000400_pos_001_cash_register_foundation.sql');
 sql(fn(posFoundation,'has_pos_capability')+fn(posFoundation,'require_pos_access')
   +fn(read('20260930000200_pos_session_payment_boundary_001.sql'),'record_pos_payment')
   +fn(read('20260930000300_pos_refund_channel_session_boundary_001.sql'),'record_pos_refund'));
 sql(`revoke all on function public.has_pos_capability(uuid), public.require_pos_access(uuid) from public,anon,authenticated;
 revoke all on function public.record_pos_payment(uuid,numeric,public.payment_method,uuid,text,text,uuid,text,text,text), public.record_pos_refund(uuid,numeric,text,uuid,uuid) from public,anon,authenticated;
 grant execute on function public.record_pos_payment(uuid,numeric,public.payment_method,uuid,text,text,uuid,text,text,text), public.record_pos_refund(uuid,numeric,text,uuid,uuid) to authenticated;`);
 sql(read('20260826000300_billing_001_invoicing_foundation.sql'));
 const entitlement=read('20260827000200_entitlements_001_tenant_feature_access.sql');
 sql(fn(entitlement,'require_billing_entitlement')+entitlement.slice(entitlement.indexOf('create trigger organization_billing_settings_require_entitlement'),entitlement.indexOf('create function public.require_segment_pricing_management_entitlement')));
 sql(fn(read('20260902000200_terminal_customer_ux_001b_shared_walk_in.sql'),'prevent_shared_walk_in_invoice')+'\ncreate trigger invoices_prevent_shared_walk_in before insert or update of customer_id on public.invoices for each row execute function public.prevent_shared_walk_in_invoice();');
 sql(read('20261007000200_billing_tax_inclusive_pricing_001.sql'));
 sql(fn(read('20261004000300_data_retention_scale_001h_billing_sales_document_history.sql'),'list_billing_invoices_page'));
 for(const n of ['20261016000100_billing_simplified_invoice_001b_fiscal_type_foundation.sql','20261016000200_billing_fiscal_profile_001_minimal_configuration.sql','20261016000300_billing_simplified_invoice_001c_series_reservation.sql','20261017000100_billing_simplified_invoice_001d_series_configuration.sql','20261017000200_billing_simplified_invoice_001e_recipient_snapshot_foundation.sql'])sql(read(n));
 sql(owner+`insert into organization_billing_settings(organization_id,issuer_legal_name,issuer_tax_id,issuer_address_line1,issuer_city,issuer_postal_code,issuer_country_code,default_tax_rate) values('${org}','Test issuer','TEST-ISSUER','Test','Test','00000','ES',7);select reserve_billing_simplified_series('S');`);
 let count=100;
 const order=({customer=walkin,quantity=4,price=9,discount=0,organization=org}={})=>{const oid=id(++count);sql(`insert into orders(id,organization_id,customer_id,order_number,currency,production_status,is_active,discount_amount,subtotal,total) values('${oid}','${organization}','${customer}','TEST-${count}','EUR','received',true,${discount},round(${quantity}*${price},2),round(${quantity}*${price},2)-${discount});insert into order_items values('${id(count+10000)}','${organization}','${oid}','Test laundry','service',${quantity},${price},round(${quantity}*${price},2),true,0,now());`);return oid;};
 const draft=(o,recipient=anon)=>sql(owner+`set role authenticated;select create_billing_draft(array['${o}']::uuid[],null::text,null::numeric,null::text,'simplified','${JSON.stringify(recipient)}'::jsonb);`);
 const issue=(i,{date=today,scope="local_laundry_dry_cleaning",requirement="consumer",confirmed="true"}={})=>`select invoice_number from issue_billing_invoice('${i}',${date},'${scope}','${requirement}',${confirmed});`;
 const user=s=>sql(owner+'set role authenticated;'+s);
 const posPay=(o,amount=2)=>`select record_pos_payment('${o}',${amount},'cash','${id(7)}',null,null,'${id(++count)}');`;
 const amounts=i=>sql(`select jsonb_build_object('invoice',to_jsonb(i)-array['document_status','invoice_number','sequence_number','issue_date','issued_at','updated_at','updated_by','service_performed_on','service_operation_scope','fiscal_recipient_requirement','service_declared_by','service_declared_at','issuer_legal_name','issuer_tax_id','issuer_address_line1','issuer_address_line2','issuer_city','issuer_region','issuer_postal_code','issuer_country_code','issuer_email','issuer_phone'], 'items',(select jsonb_agg(to_jsonb(it) order by it.id) from invoice_items it where it.invoice_id=i.id)) from invoices i where i.id='${i}';`);
 const history=draft(order());
 sql(read('20261018000100_billing_simplified_invoice_001f_service_issuance.sql'));
 await t.test('migration keeps all tenants disabled, no business data or simplified counters allocated',()=>{
  assert.equal(sql("select simplified_invoicing_enabled from organization_billing_settings"),'f');assert.equal(sql("select count(*) from billing_invoice_number_counters"),'0');assert.equal(sql(`select service_performed_on is null and document_status='draft' from invoices where id='${history}'`),'t');
  expectError(owner+'set role authenticated;'+issue(history),/billing_simplified_issuance_disabled/);
 });
 // Fixture-only opt-in to test the positive branch. No application writer or
 // remote activation is invoked. Real activation remains a separate approval.
 sql(owner+"update organization_billing_settings set fiscal_territory_code='ES-CN',declared_tax_regime_code='IGIC-GENERAL',simplified_invoicing_enabled=true;");
 await t.test('zero advance: actual ordinary-shared recipient stays NULL, one permanent number and original IGIC',()=>{
  const before=amounts(history);const number=user(issue(history));assert.match(number,/^\d{4}-S-000001$/);assert.equal(amounts(history),before);
  assert.equal(sql(`select customer_id is null and service_performed_on=${today} and service_declared_by='${actor}'::uuid and service_declared_at is not null from invoices where id='${history}'`),'t');
  assert.equal(sql(`select total||'/'||taxable_base||'/'||tax_total from invoices where id='${history}'`),'36.00/33.64/2.36');
 });
 await t.test('double click/lost-response retry returns same number; no new counter after configuration change',()=>{
  const before=sql('select next_value from billing_invoice_number_counters where series=\'S\'');const a=user(issue(history));const b=user(issue(history,{confirmed:'false',date:"'1900-01-01'::date"}));assert.equal(a,b);assert.equal(sql("select next_value from billing_invoice_number_counters where series='S'"),before);
  sql(owner+"update organization_billing_settings set simplified_invoicing_enabled=false;");assert.equal(user(`select invoice_number from issue_billing_invoice('${history}');`),a);sql(owner+"update organization_billing_settings set simplified_invoicing_enabled=true;");
 });
 await t.test('identified occasional and registered recipients issue without changing identity or permanent-customer requirement',()=>{
  for(const customer of [walkin,registered]){
   const i=draft(order({customer}),identified);const before=amounts(i);user(issue(i,{requirement:'consumer_identified'}));assert.equal(amounts(i),before);
   assert.equal(sql(`select recipient_snapshot_mode='identified' and customer_name='Identified test' and ${customer===walkin?'customer_id is null':`customer_id='${registered}'::uuid`} from invoices where id='${i}'`),'t');
  }
 });
 await t.test('manager may explicitly confirm the actual service date',()=>{
  const i=draft(order());assert.match(sql(owner+"set test.role='manager';set role authenticated;"+issue(i)),/-S-/);
 });
 await t.test('already-issued lookup still requires entitlement and the exact tenant',()=>{
  expectError(owner+"set test.entitled='false';set role authenticated;"+`select * from issue_billing_invoice('${history}');`,/billing_not_authorized/);
  expectError(owner+`set test.org='${other}';set role authenticated;`+issue(history),/billing_invalid_draft/);
 });
 await t.test('enabled unsupported fiscal profile cannot be persisted',()=>{
  expectError(owner+"update organization_billing_settings set declared_tax_regime_code='UNKNOWN';",/simplified_profile_valid/);
  expectError(owner+"set role authenticated;update organization_billing_settings set simplified_invoicing_enabled=true;",/permission denied/);
 });
 await t.test('legacy one-argument route cannot issue an unconfirmed simplified draft',()=>{expectError(owner+'set role authenticated;'+`select * from issue_billing_invoice('${draft(order())}');`,/billing_simplified_declaration_required/);});
 for(const options of [{quantity:3,price:1,expected:'3.00/2.80/0.20'},{quantity:4,price:9,discount:10,expected:'26.00/24.30/1.70'},{quantity:2.5,price:9,expected:'22.50/21.03/1.47'}])await t.test(`canonical amounts unchanged: ${options.expected}`,()=>{const i=draft(order(options)),before=amounts(i);user(issue(i));assert.equal(amounts(i),before);assert.equal(sql(`select total||'/'||taxable_base||'/'||tax_total from invoices where id='${i}'`),options.expected);});
 await t.test('zero tax rate retains snapshot when issued',()=>{sql(owner+'update organization_billing_settings set default_tax_rate=0;');const i=draft(order());const before=amounts(i);user(issue(i));assert.equal(amounts(i),before);assert.equal(sql(`select tax_total from invoices where id='${i}'`),'0.00');sql(owner+'update organization_billing_settings set default_tax_rate=7;');});
 await t.test('identified occasional recipient and B2B prior-month service date are frozen, issue date is actual today',()=>{const i=draft(order(),identified);const date="(date_trunc('month',now() at time zone 'Atlantic/Canary')-interval '1 day')::date";const day=Number(sql(`select extract(day from ${today})`));if(day<16){user(issue(i,{date,requirement:'business'}));assert.equal(sql(`select issue_date=${today} and service_performed_on=${date} and customer_id is null from invoices where id='${i}'`),'t');}else expectError(owner+issue(i,{date,requirement:'business'}),/billing_service_date_review_required/);});
 for(const [name,opts,re] of [['no confirmation',{confirmed:'false'},/declaration_required/],['NULL confirmation',{confirmed:'null'},/declaration_required/],['unknown/excluded operation',{scope:'unverified'},/declaration_required/],['ordinary requested',{requirement:'ordinary_required'},/declaration_required/],['business without identity',{requirement:'business'},/customer_configuration/],['NULL service date',{date:'null::date'},/service_date_invalid/],['future service date',{date:`${today}+1`},/service_date_invalid/],['late consumer service date',{date:`${today}-1`},/service_date_review_required/]])await t.test(name,()=>{const i=draft(order());expectError(owner+'set role authenticated;'+issue(i,opts),re);assert.equal(sql(`select document_status from invoices where id='${i}'`),'draft');});
 for(const [name,amountsToPay,status] of [['partial advance',[2],'confirmed'],['full advance',[7],'confirmed'],['advance and balance',[2,5],'confirmed'],['refund history',[2],'refunded'],['pending payment',[2],'pending']])await t.test(`${name} blocked with ledger unchanged`,()=>{const o=order({quantity:1,price:7}),i=draft(o);for(const n of amountsToPay)sql(`insert into payments(organization_id,order_id,status,amount) values('${org}','${o}','${status}',${n});`);const before=sql(`select md5(jsonb_agg(to_jsonb(p) order by id)::text) from payments p`);expectError(owner+'set role authenticated;'+issue(i),/billing_advance_workflow_required/);assert.equal(sql(`select md5(jsonb_agg(to_jsonb(p) order by id)::text) from payments p`),before);});
 await t.test('ceiling 3000 inclusive, exceeding it denied',()=>{user(issue(draft(order({quantity:1,price:3000}))));const i=draft(order({quantity:1,price:3000.01}));expectError(owner+'set role authenticated;'+issue(i),/operation_not_eligible/);});
 for(const [name,context] of [['staff',"set test.role='staff';"],['disabled entitlement',"set test.entitled='false';"],['foreign tenant',`set test.org='${other}';`]])await t.test(`${name} cannot issue or allocate`,()=>{const i=draft(order());expectError(owner+context+'set role authenticated;'+issue(i),/not_authorized|invalid_draft/);});
 await t.test('historical identity, operation date and fiscal type cannot be edited',()=>{for(const change of ["service_performed_on=service_performed_on-1","service_operation_scope='other'","fiscal_recipient_requirement='business'","service_declared_at=now()","customer_name='replacement'","fiscal_document_type='ordinary'"])expectError(owner+`set app.billing_mutation='on';update invoices set ${change} where id='${history}';`,/immutable|reserved|billing_simplified_series_used/);});
 await t.test('client DML/private triggers are not usable to bypass confirmation',()=>{expectError(owner+`set role authenticated;update invoices set document_status='issued' where id='${draft(order())}';`,/permission denied/);expectError(owner+'set role authenticated;select protect_billing_service_declaration();',/permission denied/);});
 await t.test('same order cannot create another ordinary or simplified draft',()=>{const o=order();draft(o);expectError(owner+`set role authenticated;select create_billing_draft(array['${o}']::uuid[]);`,/already_invoiced/);expectError(owner+`select create_billing_draft(array['${o}']::uuid[],null::text,null::numeric,null::text,'simplified','${JSON.stringify(anon)}'::jsonb);`,/already_invoiced/);});
 await t.test('ordinary creation/issue and series separation are unchanged',()=>{const o=order({customer:registered});const i=user(`select create_billing_draft(array['${o}']::uuid[]);`);assert.match(user(`select invoice_number from issue_billing_invoice('${i}');`),/-A-/);assert.equal(sql(`select fiscal_document_type||'/'||next_value from billing_invoice_number_counters where series='A'`),'ordinary/2');expectError(owner+`select create_billing_draft(array['${order({customer:registered})}']::uuid[],'S',7,null);`,/reserved_for_simplified/);});
 await t.test('rollback restores draft and counter',()=>{const i=draft(order()),before=sql("select next_value from billing_invoice_number_counters where series='S'");sql(owner+'begin;'+issue(i)+'rollback;');assert.equal(sql(`select document_status from invoices where id='${i}'`),'draft');assert.equal(sql("select next_value from billing_invoice_number_counters where series='S'"),before);});
 const sessions=new Set();
 const openSql=s=>{
  const child=spawn('psql',args,{env,stdio:['pipe','pipe','pipe']});sessions.add(child);
  let stdout='',stderr='';child.stdout.on('data',s=>stdout+=s);child.stderr.on('data',s=>stderr+=s);
  const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>{sessions.delete(child);resolve({code,stdout,stderr});});});
  child.stdin.write(s+'\n');return {done,end:s=>{if(!child.stdin.writableEnded)child.stdin.end((s??'')+'\n');}};
 };
 t.after(()=>{for(const child of sessions)if(!child.stdin.writableEnded)child.stdin.end('rollback;\n');});
 const asyncSql=s=>{const session=openSql(s);session.end();return session.done;};
 const waitFor=async(query,label)=>{for(let n=0;n<200;n++){if(sql(query)==='1')return;await delay(20);}throw Error(`missing deterministic barrier: ${label}`);};
 const idle=name=>waitFor(`select count(*) from pg_stat_activity where datname=current_database() and application_name='${name}' and state='idle in transaction'`,name);
 const blockedBy=(waiting,blocking)=>waitFor(`select count(*) from pg_stat_activity w join pg_stat_activity b on b.pid=any(pg_blocking_pids(w.pid)) where w.datname=current_database() and b.datname=current_database() and w.application_name='${waiting}' and b.application_name='${blocking}' and w.wait_event_type='Lock'`,`${waiting} blocked by ${blocking}`);
 const sleepBarrier=async name=>{for(let n=0;n<100;n++){if(sql(`select count(*) from pg_stat_activity where datname=current_database() and application_name='${name}' and wait_event='PgSleep'`)==='1')return;await delay(20);}throw Error('first session never reached lock barrier');};
 await t.test('same invoice concurrent issue READ COMMITTED',async()=>{const i=draft(order()),before=Number(sql("select next_value from billing_invoice_number_counters where series='S'"));const first=asyncSql(owner+"set application_name='001f_same_rc';begin isolation level read committed;set role authenticated;"+issue(i)+'select pg_sleep(1.5);commit;');await sleepBarrier('001f_same_rc');const second=asyncSql(owner+'begin isolation level read committed;set role authenticated;'+issue(i)+'commit;');const [a,b]=await Promise.all([first,second]);assert.equal(a.code,0,a.stderr);assert.equal(b.code,0,b.stderr);assert.equal(b.stdout.trim(),a.stdout.trim());assert.equal(Number(sql("select next_value from billing_invoice_number_counters where series='S'")),before+1);});
 for(const level of ['REPEATABLE READ','SERIALIZABLE'])await t.test(`${level}: new simplified issue rejected before counter allocation, even without payments`,()=>{
  const i=draft(order()),before=sql("select next_value from billing_invoice_number_counters where series='S'"),snapshot=amounts(i);
  expectError(owner+`begin isolation level ${level};set role authenticated;`+issue(i),/25000[\s\S]*billing_simplified_read_committed_required/);
  assert.equal(sql("select next_value from billing_invoice_number_counters where series='S'"),before);
  assert.equal(sql(`select document_status||'/'||(invoice_number is null)::text||'/'||(service_declared_at is null)::text from invoices where id='${i}'`),'draft/true/true');
  assert.equal(amounts(i),snapshot);
 });
 for(const level of ['READ COMMITTED','REPEATABLE READ','SERIALIZABLE'])await t.test(`${level}: issued simplified replay remains idempotent and ordinary issuance remains supported`,()=>{
  const before=sql("select next_value from billing_invoice_number_counters where series='S'"),snapshot=sql(`select to_jsonb(i) from invoices i where id='${history}'`);
  const number=sql(`select invoice_number from invoices where id='${history}'`);
  assert.equal(user(`begin isolation level ${level};`+issue(history)+'commit;'),number);
  assert.equal(user(`begin isolation level ${level};select invoice_number from issue_billing_invoice('${history}');commit;`),number);
  assert.equal(sql("select next_value from billing_invoice_number_counters where series='S'"),before);
  assert.equal(sql(`select to_jsonb(i) from invoices i where id='${history}'`),snapshot);
  const o=order({customer:registered}),i=user(`select create_billing_draft(array['${o}']::uuid[]);`);
  assert.match(user(`begin isolation level ${level};select invoice_number from issue_billing_invoice('${i}');commit;`),/-A-/);
  assert.equal(sql(`select service_declared_at is null from invoices where id='${i}'`),'t');
 });
 await t.test('different invoices on same series allocate consecutive distinct numbers under contention',async()=>{const a=draft(order()),b=draft(order()),before=Number(sql("select next_value from billing_invoice_number_counters where series='S'"));const first=asyncSql(owner+"set application_name='001f_two';begin;set role authenticated;"+issue(a)+'select pg_sleep(1.5);commit;');await sleepBarrier('001f_two');const second=asyncSql(owner+'begin;set role authenticated;'+issue(b)+'commit;');const [x,y]=await Promise.all([first,second]);assert.equal(x.code,0,x.stderr);assert.equal(y.code,0,y.stderr);assert.notEqual(x.stdout.trim(),y.stdout.trim());assert.equal(Number(sql("select next_value from billing_invoice_number_counters where series='S'")),before+2);});
 for(const level of ['REPEATABLE READ','SERIALIZABLE'])await t.test(`${level}: snapshot precedes concurrent canonical POS receipt; committed payment cannot be ignored`,async()=>{
  const o=order(),i=draft(o),before=sql("select next_value from billing_invoice_number_counters where series='S'");
  const name='001f_stale_'+level.replaceAll(' ','_');
  const issuer=openSql(owner+`set application_name='${name}';begin isolation level ${level};set role authenticated;select count(*) from payments where order_id='${o}';`);
  try {
   await idle(name); // Establish the issuer's snapshot BEFORE the real POS write.
   const payment=openSql(owner+"set application_name='001f_stale_pos';begin;set role authenticated;"+posPay(o));
   try {await idle('001f_stale_pos');payment.end('commit;');const p=await payment.done;assert.equal(p.code,0,p.stderr);}
   finally {payment.end();}
   assert.equal(sql(`select count(*) from payments where order_id='${o}' and status='confirmed' and channel='pos'`),'1');
   // Show that the same transaction still cannot see the now-committed receipt.
   issuer.end(`select count(*) from payments where order_id='${o}';`+issue(i)+'commit;');
   const result=await issuer.done;assert.notEqual(result.code,0);assert.match(result.stderr,/25000[\s\S]*billing_simplified_read_committed_required/);
   assert.equal(result.stdout.trim(),'0\n0');
  } finally {issuer.end();}
  assert.equal(sql(`select document_status||'/'||(invoice_number is null)::text from invoices where id='${i}'`),'draft/true');
  assert.equal(sql("select next_value from billing_invoice_number_counters where series='S'"),before);
 });
 await t.test('READ COMMITTED: canonical POS receipt commits first; blocked issuer refreshes snapshot and rejects it',async()=>{
  const o=order(),i=draft(o),before=sql("select next_value from billing_invoice_number_counters where series='S'");
  const payment=openSql(owner+"set application_name='001f_real_pos_first';begin;set role authenticated;"+posPay(o));
  let issuer;
  try {
   await idle('001f_real_pos_first');
   issuer=asyncSql(owner+"set application_name='001f_rc_waiter';begin isolation level read committed;set role authenticated;"+issue(i)+'commit;');
   await blockedBy('001f_rc_waiter','001f_real_pos_first');
   payment.end('commit;');const [p,issued]=await Promise.all([payment.done,issuer]);
   assert.equal(p.code,0,p.stderr);assert.notEqual(issued.code,0);assert.match(issued.stderr,/billing_advance_workflow_required/);
   assert.equal(sql(`select document_status from invoices where id='${i}'`),'draft');
   assert.equal(sql("select next_value from billing_invoice_number_counters where series='S'"),before);
   assert.equal(sql(`select count(*) from payments where order_id='${o}' and status='confirmed' and channel='pos'`),'1');
  } finally {payment.end();if(issuer)await issuer;}
 });
 await t.test('READ COMMITTED: issuance commits first; canonical POS writer waits until fiscal commit',async()=>{
  const o=order(),i=draft(o);
  const issuer=openSql(owner+"set application_name='001f_real_issue_first';begin isolation level read committed;set role authenticated;"+issue(i));
  let payment;
  try {
   await idle('001f_real_issue_first');
   const snapshot=sql(`select to_jsonb(i) from invoices i where id='${i}'`); // Still draft outside the uncommitted issuer.
   payment=asyncSql(owner+"set application_name='001f_real_pos_waiter';begin;set role authenticated;"+posPay(o,36)+'commit;');
   await blockedBy('001f_real_pos_waiter','001f_real_issue_first');
   assert.equal(sql(`select count(*) from payments where order_id='${o}'`),'0');
   assert.equal(sql(`select to_jsonb(i) from invoices i where id='${i}'`),snapshot);
   issuer.end('commit;');const [issued,p]=await Promise.all([issuer.done,payment]);assert.equal(issued.code,0,issued.stderr);assert.equal(p.code,0,p.stderr);
   const issuedSnapshot=sql(`select to_jsonb(i) from invoices i where id='${i}'`);
   assert.equal(sql(`select document_status||'/'||total from invoices where id='${i}'`),'issued/36.00');
   assert.equal(user(issue(i)),issued.stdout.trim());assert.equal(sql(`select to_jsonb(i) from invoices i where id='${i}'`),issuedSnapshot);
   assert.equal(sql(`select count(*) from payments where order_id='${o}' and status='confirmed' and channel='pos'`),'1');
  } finally {issuer.end();if(payment)await payment;}
 });
 await t.test('canonical POS refund preserves confirmed source, so the simplified guard cannot miss refund history',()=>{
  const o=order(),i=draft(o),payment=user(posPay(o,7));
  user(`select record_pos_refund('${payment}',2,'Synthetic refund','${id(7)}','${id(++count)}');`);
  assert.equal(sql(`select count(*) from payments where order_id='${o}' and status='confirmed'`),'1');
  assert.equal(sql(`select count(*) from payments where order_id='${o}' and status='refunded'`),'1');
  const before=sql(`select md5(jsonb_agg(to_jsonb(p) order by id)::text) from payments p where order_id='${o}'`);
  expectError(owner+'set role authenticated;'+issue(i),/billing_advance_workflow_required/);
  assert.equal(sql(`select md5(jsonb_agg(to_jsonb(p) order by id)::text) from payments p where order_id='${o}'`),before);
 });
});
