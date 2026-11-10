import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require=createRequire(import.meta.url);
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
function load(path, imports={}) {
  const compiledModule={exports:{}};
  const compiled=ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  runInNewContext(compiled,{module:compiledModule,exports:compiledModule.exports,console:{error(){}},require(name){
    if(name==='server-only')return {};
    if(name==='react/jsx-runtime')return require(name);
    if(Object.hasOwn(imports,name))return imports[name];
    throw Error(`Unexpected dependency ${name}`);
  }});
  return compiledModule.exports;
}
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const locales=['it','es','en','fr','de'];
const messages=locale=>JSON.parse(read(`src/i18n/${locale}/common.json`));
const translate=async({locale,namespace})=>key=>{
  const dictionary=namespace.split('.').slice(1).reduce((value,part)=>value[part],messages(locale));
  assert.equal(typeof dictionary[key],'string',`Missing ${locale}:${namespace}.${key}`);
  return dictionary[key];
};
const {formatQuantity}=load('src/lib/number-format.ts');
const printPath='src/components/service-albarans/ServiceAlbaranDocument.tsx';
const Document=load(printPath,{
  'next-intl/server':{getTranslations:translate},
  '@/components/printing/PrintButton':{PrintButton:({label})=>React.createElement('button',null,label)},
  '@/i18n/navigation':{Link:({locale,href,children})=>React.createElement('a',{href:`/${locale}${href}`},children)},
  '@/lib/number-format':{formatQuantity},
  '@/lib/organization-timezone':{formatOrganizationDateTime:value=>value},
}).ServiceAlbaranDocument;
function document() {
  return {id:id(1),order_id:id(501),document_number:'ALB-2026-000001',document_status:'issued',snapshot_version:1,
    created_by:'PRIVATE_OPERATOR',cancellation_reason:'PRIVATE_REASON',snapshot:{version:1,
      document:{number:'ALB-2026-000001',issuedAt:'2026-11-10T10:00:00Z'},
      organization:{id:id(101),name:'Synthetic Laundry',timezone:'Atlantic/Canary',credentials:'PRIVATE_KEY'},
      location:{id:id(201),name:'Site A'},customer:{id:id(301),name:'Hotel A',notes:'PRIVATE_CUSTOMER'},
      property:{id:id(401),name:'Apartment A',accessInstructions:'PRIVATE_ACCESS'},
      order:{id:id(501),number:'EW-501',internalNotes:'PRIVATE_ORDER',customerNotes:'PRIVATE_NOTE',total:999},
      completion:{eventId:id(1501),recordedAt:'2026-11-09T09:00:00Z',operator:'PRIVATE_OPERATOR'},
      items:[{id:id(2501),description:'Synthetic laundry',quantity:2,unitType:'piece',notes:'PRIVATE_ITEM',unitPrice:999,lineTotal:1998},
        {id:id(2502),description:'Weight service',quantity:1.25,unitType:'weight'},
        ...['area','cycle','service','day'].map((unitType,index)=>({id:id(2503+index),description:`Synthetic ${unitType}`,quantity:1.25,unitType}))],payments:[{reference:'PRIVATE_PAYMENT'}]}};
}
for(const locale of locales) {
  test(`${locale}: A4 snapshot contains service, site, customer, property and units; excludes all prices/private fields`,async()=>{
    const fixture=document(), before=JSON.stringify(fixture);
    const html=renderToStaticMarkup(await Document({locale,albaran:fixture}));
    for(const value of ['ALB-2026-000001','EW-501','Hotel A','Apartment A','Site A','Synthetic laundry',formatQuantity(1.25,locale),messages(locale).print.units.weight])assert.ok(html.includes(value));
    for(const unit of ['piece','weight','area','cycle','service','day'])assert.ok(html.includes(`<td>${messages(locale).print.units[unit]}</td>`),`Missing canonical unit ${locale}/${unit}`);
    assert.ok(html.includes(messages(locale).serviceAlbarans.notFiscal));
    assert.ok(html.includes(messages(locale).serviceAlbarans.recordedEvidence));
    assert.match(html,/order-print-ticket/);
    assert.ok(html.includes(`/${locale}/app/orders/${id(501)}#service-albarans`));
    assert.doesNotMatch(html,/PRIVATE|999|1998|window\.print|autoPrint|onload/i);
    assert.equal(JSON.stringify(fixture),before);
  });
  test(`${locale}: cancelled history reprints with cancellation status, no private reason or new document`,async()=>{
    const fixture=document(); fixture.document_status='cancelled'; fixture.snapshot.property=null;
    const html=renderToStaticMarkup(await Document({locale,albaran:fixture}));
    assert.ok(html.includes(messages(locale).serviceAlbarans.cancelled));
    assert.match(html,/ALB-2026-000001/);assert.doesNotMatch(html,/PRIVATE/);
  });
}
test('five locale contracts have identical, complete keys',()=>{
  const keys=Object.keys(messages('en').serviceAlbarans).sort();
  for(const locale of locales)assert.deepEqual(Object.keys(messages(locale).serviceAlbarans).sort(),keys);
});

const historyDocument=()=>({...document(),issued_at:'2026-11-10T10:00:00Z'});
async function panel(result, {canCancel=false,productionStatus='completed'}={}) {
  const Panel=load('src/components/service-albarans/ServiceAlbaranPanel.tsx',{
    'node:crypto':{randomUUID:()=>id(10001)},
    'next-intl/server':{getTranslations:translate},
    '@/components/Card':{Card:({children})=>React.createElement('div',null,children)},
    '@/components/service-albarans/AlbaranSubmitButton':{AlbaranSubmitButton:({label})=>React.createElement('button',null,label)},
    '@/features/service-albarans/server/actions':{issueServiceAlbaranAction:async()=>{},cancelServiceAlbaranAction:async()=>{}},
    '@/features/service-albarans/server/queries':{getOrderServiceAlbarans:async()=>result},
    '@/i18n/navigation':{Link:({href,children})=>React.createElement('a',{href},children)},
    '@/lib/organization-timezone':{formatOrganizationDateTime:value=>value},
  }).ServiceAlbaranPanel;
  return renderToStaticMarkup(await Panel({locale:'en',order:{id:id(501),customerId:id(301),productionStatus,isActive:true,locationId:id(201)},hasItems:true,canCancel,error:false}));
}
test('eligible empty history exposes one explicit issue action; ineligible orders do not',async()=>{
  const html=await panel({available:true,businessCustomer:true,documents:[]});
  assert.equal((html.match(/name="requestId"/g)||[]).length,1);
  assert.ok(html.includes(messages('en').serviceAlbarans.issue));
  for(const options of [{businessCustomer:false},{businessCustomer:true,productionStatus:'washing'}]) {
    const denied=await panel({available:true,businessCustomer:options.businessCustomer,documents:[]},options);
    assert.doesNotMatch(denied,/name="requestId"/);
  }
});
test('active history offers reprint, hides issue and restricts cancellation controls to management',async()=>{
  const result={available:true,businessCustomer:true,documents:[historyDocument()]};
  const staff=await panel(result),manager=await panel(result,{canCancel:true});
  assert.match(staff,/ALB-2026-000001/);assert.doesNotMatch(staff,/name="requestId"|name="reason"/);
  assert.match(manager,/name="reason"/);assert.doesNotMatch(manager,/name="requestId"/);
});
test('cancelled history is retained and fresh issue includes the previous document precondition',async()=>{
  const cancelled=historyDocument();cancelled.document_status='cancelled';
  const html=await panel({available:true,businessCustomer:true,documents:[cancelled]});
  assert.match(html,/ALB-2026-000001/);
  assert.ok(html.includes(`name="previousAlbaranId" value="${cancelled.id}"`));
});
test('unavailable history shows an explicit notice and disables document mutations',async()=>{
  const html=await panel({available:false},{canCancel:true});
  assert.ok(html.includes(messages('en').serviceAlbarans.unavailable));
  assert.ok(!html.includes(messages('en').serviceAlbarans.empty));
  assert.doesNotMatch(html,/name="requestId"|name="reason"/);
});

const actionPath='src/features/service-albarans/server/actions.ts';
function actions({denied=false,response={data:id(900),error:null}}={}) {
  const calls=[],paths=[];
  const access=async()=>{calls.push('access');if(denied)throw Error('DENIED');};
  const result=load(actionPath,{
    'next/cache':{revalidatePath:path=>paths.push(path)},
    'next/navigation':{redirect:path=>{throw Error(`REDIRECT:${path}`);}},
    '@/features/printing/server/access':{requirePrintAccess:access},
    '@/lib/auth/require-role':{requireOwnerOrManager:access},
    '@/features/entitlements/feature-catalog':{FEATURES:{printing:'printing'}},
    '@/features/entitlements/server/resolver':{requireEntitlement:access},
    '@/lib/supabase/server':{createSupabaseServerClient:async()=>({rpc:async(name,args)=>{calls.push({name,args});return response;}})},
  });
  return {...result,calls,paths};
}
test('explicit issue invokes only albaran RPC with validated IDs and redirects to persisted print',async()=>{
  const api=actions(),form=new FormData();form.set('requestId',id(10001));
  await assert.rejects(api.issueServiceAlbaranAction('it',id(501),form),/REDIRECT:.*albarans\/.*\/print$/);
  const writes=api.calls.filter(call=>typeof call==='object');
  assert.equal(writes.length,1);assert.equal(writes[0].name,'issue_service_albaran');
  assert.deepEqual(JSON.parse(JSON.stringify(writes[0].args)),{target_order_id:id(501),target_request_id:id(10001),target_previous_albaran_id:null});
});
test('reissue explicitly carries the last cancelled document as history precondition',async()=>{
  const api=actions(),form=new FormData();form.set('requestId',id(10002));form.set('previousAlbaranId',id(900));
  await assert.rejects(api.issueServiceAlbaranAction('es',id(501),form),/REDIRECT/);
  assert.equal(api.calls.find(call=>typeof call==='object').args.target_previous_albaran_id,id(900));
});
test('missing/invalid request IDs and unauthorized users never call a writer',async()=>{
  const api=actions(); await assert.rejects(api.issueServiceAlbaranAction('it',id(501),new FormData()),/albaranError=1/);
  assert.equal(api.calls.filter(call=>typeof call==='object').length,0);
  const denied=actions({denied:true}),form=new FormData();form.set('requestId',id(10001));
  await assert.rejects(denied.issueServiceAlbaranAction('it',id(501),form),/DENIED/);
  assert.equal(denied.calls.length,1);
});
test('failed issue does not redirect to print or replay payment/Billing/REC actions',async()=>{
  const api=actions({response:{data:null,error:{code:'22023'}}}),form=new FormData();form.set('requestId',id(10001));
  await assert.rejects(api.issueServiceAlbaranAction('fr',id(501),form),/albaranError=1/);
  assert.equal(api.paths.length,0);
  assert.deepEqual(api.calls.filter(call=>typeof call==='object').map(call=>call.name),['issue_service_albaran']);
});
test('cancellation requires management access, reason and matching order/document identifiers',async()=>{
  const api=actions(),form=new FormData();form.set('reason','Synthetic cancellation');
  await assert.rejects(api.cancelServiceAlbaranAction('de',id(501),id(900),form),/REDIRECT:.*#service-albarans/);
  const write=api.calls.find(call=>typeof call==='object');
  assert.equal(write.name,'cancel_service_albaran');assert.equal(write.args.target_order_id,id(501));assert.equal(write.args.target_albaran_id,id(900));
  const invalid=actions(); await assert.rejects(invalid.cancelServiceAlbaranAction('it',id(501),id(900),new FormData()),/albaranError=1/);
  assert.equal(invalid.calls.filter(call=>typeof call==='object').length,0);
});

function queries({failed=false,transport=false,missing=false}={}) {
  const filters=[],calls=[];
  const db={from(table){calls.push(table);const chain={
    select(){return chain;},eq(key,value){filters.push([table,key,value]);return chain;},order(){return chain;},
    async maybeSingle(){if(transport)throw Error('network');return {data:missing?null:table==='customers'?{customer_type:'business'}:document(),error:failed?{code:'XX000'}:null};},
    async returns(){if(transport)throw Error('network');return {data:failed?null:[document()],error:failed?{code:'XX000'}:null};},
  };return chain;}};
  const api=load('src/features/service-albarans/server/queries.ts',{
    'next/navigation':{notFound:()=>{throw Error('NOT_FOUND');}},
    '@/features/printing/server/access':{requirePrintAccess:async()=>({membership:{organization:{id:id(101)}}})},
    '@/lib/supabase/server':{createSupabaseServerClient:async()=>db},
  });return {...api,filters,calls};
}
test('snapshot and per-order history reads are explicitly tenant scoped and never invoke financial sources',async()=>{
  const api=queries();assert.equal((await api.getServiceAlbaran('it',id(900))).document_number,'ALB-2026-000001');
  const history=await api.getOrderServiceAlbarans('it',id(501),id(301));assert.equal(history.available,true);
  assert.ok(api.filters.some(([,key,value])=>key==='organization_id'&&value===id(101)));
  assert.ok(api.filters.some(([,key,value])=>key==='order_id'&&value===id(501)));
  assert.ok(api.calls.every(table=>['service_albarans','customers'].includes(table)));
});
test('query/transport failures remain unavailable, never a valid empty history or a zero balance',async()=>{
  for(const options of [{failed:true},{transport:true}]) {
    const api=queries(options);assert.equal((await api.getOrderServiceAlbarans('it',id(501),id(301))).available,false);
    await assert.rejects(api.getServiceAlbaran('it',id(900)));
  }
  await assert.rejects(queries({missing:true}).getServiceAlbaran('it',id(900)),/NOT_FOUND/);
});
test('GET print route only reads persisted snapshot and rejects wrong order association',async()=>{
  const calls=[];
  const Page=load('src/app/[locale]/app/(dashboard)/orders/[orderId]/albarans/[albaranId]/print/page.tsx',{
    'next/navigation':{notFound:()=>{throw Error('NOT_FOUND');}},
    '@/components/service-albarans/ServiceAlbaranDocument':{ServiceAlbaranDocument:Document},
    '@/features/service-albarans/server/queries':{getServiceAlbaran:async(...args)=>{calls.push(args);return document();}},
  }).default;
  await Page({params:Promise.resolve({locale:'it',orderId:id(501),albaranId:id(900)})});
  await assert.rejects(Page({params:Promise.resolve({locale:'it',orderId:id(502),albaranId:id(900)})}),/NOT_FOUND/);
  assert.equal(calls.length,2);
});
test('migration is additive and retains existing financial/operational writers',()=>{
  const sql=read('supabase/migrations/20261110102208_b2b_albaran_service_001.sql');
  assert.doesNotMatch(sql,/\b(?:drop|truncate)\s|create or replace|alter table public\.(?:orders|payments|invoices|operational_receipts)\b/i);
  assert.doesNotMatch(sql,/\b(?:insert into|update|delete from) public\.(?:orders|order_items|order_status_history|payments|invoices|operational_receipts)\b/i);
});
