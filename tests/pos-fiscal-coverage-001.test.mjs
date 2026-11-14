import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
function load(path, imports = {}) {
  const module = { exports: {} };
  runInNewContext(ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    module, exports: module.exports, FormData, encodeURIComponent, require(name) {
      if (name === 'server-only') return {};
      if (Object.hasOwn(imports, name)) return imports[name];
      if (['react', 'react/jsx-runtime'].includes(name)) return require(name);
      throw Error(`Unexpected import ${name}`);
    },
  }); return module.exports;
}

const contract=load('src/features/billing/fiscal-coverage.ts');
const messages=load('src/features/billing/fiscal-coverage-messages.ts');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const evidence={servicePerformedOn:'2026-11-13',completionHistoryId:id(9),operationalCompletedAt:'2026-11-14T10:00:00Z',declaredAt:'2026-11-14T10:30:00Z',timezone:'Atlantic/Canary',statementVersion:'pos-service-v1'};
const payment={paymentId:id(1),orderId:id(2),amount:21,currency:'EUR',paidAt:'2026-11-14T10:30:00Z',status:'review_required',reason:'postservice_fiscal_rule_not_enabled',document:null,evidence};
const response={enabled:false,today:'2026-11-14',timezone:'Atlantic/Canary',payments:[payment]};
test('four coverage states are independent from payment, with verified attribution required for covered states',()=>{
 for(const status of ['review_required','issuance_pending'])assert.equal(contract.parseFiscalCoverage({...response,payments:[{...payment,status}]}).state,'ready');
 for(const status of ['document_issued','existing_document_linked']){
  assert.equal(contract.parseFiscalCoverage({...response,payments:[{...payment,status}]}).state,'unavailable');
  assert.equal(contract.parseFiscalCoverage({...response,payments:[{...payment,status,document:{id:id(3),number:'SYNTHETIC-S-1',amount:21,issuedAt:payment.paidAt}}]}).state,'ready');
 }
});
test('empty response differs from error, malformed, duplicate or incomplete coverage data',()=>{
 assert.equal(contract.parseFiscalCoverage({...response,payments:[]}).state,'ready');
 for(const r of [null,{}, {...response,payments:[payment,payment]}, {...response,payments:[{...payment,evidence:{}}]}, {...response,today:'2026-02-30'}, {...response,payments:[{...payment,amount:NaN}]}])assert.equal(contract.parseFiscalCoverage(r).state,'unavailable');
});
function reader({denied=false,data=response,error=null}={}){
 const calls=[];const mod=load('src/features/billing/server/fiscal-coverage.ts',{
  '@/features/pos/server/access':{requirePosAccess:async()=>{if(denied)throw Error('DENIED');}},
  '@/lib/supabase/server':{createSupabaseServerClient:async()=>({rpc:async(...args)=>{calls.push(args);return{data,error};}})},
  '@/features/billing/fiscal-coverage':contract,
 });return{calls,run:()=>mod.getPosFiscalCoverage('en',[id(1)])};
}
test('coverage read calls only bounded read RPC with persisted IDs and no client tenant or fiscal writer',async()=>{
 const a=reader();assert.equal((await a.run()).state,'ready');assert.equal(a.calls.length,1);assert.equal(a.calls[0][0],'get_pos_fiscal_coverage');assert.equal(JSON.stringify(a.calls[0][1]),JSON.stringify({target_payment_ids:[id(1)]}));
});
test('authorization checked before query; DB errors or missing requested rows never become an empty successful history',async()=>{
 const denied=reader({denied:true});await assert.rejects(denied.run(),/DENIED/);assert.equal(denied.calls.length,0);
 for(const options of [{error:{code:'42501'}},{data:{...response,payments:[]}},{data:{...response,payments:[{...payment,paymentId:id(99)}]}}])assert.equal((await reader(options).run()).state,'unavailable');
});
const validation=load('src/features/pos/validation.ts',{'@/features/payments/types':load('src/features/payments/types.ts')});
function action(mode='success'){
 const calls=[],fallback=[];const guard=async()=>{if(mode==='denied')throw Error('DENIED');};
 const mod=load('src/features/pos/server/coverage-actions.ts',{
  'next/cache':{revalidatePath:()=>{}},'./actions':{recordPosPaymentAction:async(...args)=>{fallback.push(args);return{success:true};}},'./access':{requirePosAccess:guard},
  '@/features/shop-terminal/server/access':{requireShopTerminalAccess:guard},'@/features/entitlements/server/resolver':{requireEntitlement:guard},
  '@/features/entitlements/feature-catalog':{FEATURES:{billingInvoicing:'billing.invoicing'}},'@/features/pos/validation':validation,
  '@/features/billing/fiscal-coverage':contract,'@/features/pos/providers/types':{MANUAL_CARD_PROVIDER:'manual'},
  '@/lib/supabase/server':{createSupabaseServerClient:async()=>({rpc:async(...args)=>{calls.push(args);if(mode==='timeout')throw Error('TIMEOUT');return{data:id(1),error:mode==='sql-error'?{code:'22023'}:null};}})},
 });const form=new FormData();for(const[k,v]of Object.entries({amount:'21',method:'cash',orderId:id(2),sessionId:id(3),idempotencyKey:id(4),serviceEvidence:'on',servicePerformedOn:'2026-11-13',organization_id:id(99)}))form.set(k,v);
 return{form,calls,fallback,run:()=>mod.recordPosPaymentWithCoverageAction('en',{fieldErrors:{},formError:null,success:false},form)};
}
test('no explicit declaration delegates unchanged canonical POS action and never manufactures evidence',async()=>{
 const a=action();a.form.delete('serviceEvidence');assert.equal((await a.run()).success,true);assert.equal(a.calls.length,0);assert.equal(a.fallback.length,1);
});
test('explicit declaration calls one atomic payment/evidence RPC, preserves idempotency and ignores tenant input',async()=>{
 const a=action();assert.equal((await a.run()).success,true);assert.equal(a.calls.length,1);assert.equal(a.fallback.length,0);const [name,args]=a.calls[0];
 assert.equal(name,'record_pos_payment_with_service_evidence');assert.equal(args.target_idempotency_key,id(4));assert.equal(args.target_service_performed_on,'2026-11-13');assert.equal(args.target_confirmed,true);assert.equal(args.target_amount,21);assert.equal('organization_id'in args,false);
});
test('missing or invalid date and revoked authorization never create a collection',async()=>{
 for(const value of ['', '2026-02-30','not-a-date']){const a=action();a.form.set('servicePerformedOn',value);assert.equal((await a.run()).success,false);assert.equal(a.calls.length,0);assert.equal(a.fallback.length,0);}
 const a=action('denied');await assert.rejects(a.run(),/DENIED/);assert.equal(a.calls.length,0);
});
test('uncertain response is reported as uncertain, without retry, fallback payment or fiscal issuance',async()=>{
 const a=action('timeout');assert.equal((await a.run()).paymentOutcome,'uncertain');assert.equal(a.calls.length,1);assert.equal(a.fallback.length,0);
 const b=action('sql-error');assert.equal((await b.run()).success,false);assert.equal(b.fallback.length,0);assert.equal(b.calls.length,1);
});
function workspace(locale, enabled=true, checked=false, status='completed'){
 const mod=load('src/components/pos/PosWorkspace.tsx',{
  react:{useActionState:(a,s)=>[s,a,false],useState:v=>[typeof v==='function'?id(4):checked,()=>{}]},
  '@/components/Button':{Button:'button'},'@/components/Card':{Card:'section'},'@/lib/number-format':{formatCurrency:()=>''},'@/i18n/navigation':{Link:'a'},
 });
 const nodes=n=>Array.isArray(n)?n.flatMap(nodes):!n||typeof n!=='object'?[]:typeof n.type==='function'?nodes(n.type(n.props)):[n,...nodes(n.props?.children)];
 return nodes(mod.PosWorkspace({actions:{pay:async()=>{}},canSeeHistory:false,currency:'EUR',history:[],historyNavigation:{},locale,locations:[],orders:[{id:id(2),total:21,totalPaid:0,outstanding:21,productionStatus:status}],payments:[],paymentNavigation:{},query:'',retryHref:'/',session:{id:id(3)},summary:null,text:JSON.parse(read(`src/i18n/${locale}/common.json`)).pos,serviceEvidence:enabled?{today:'2026-11-14',text:messages.fiscalCoverageMessages(locale)}:undefined}));
}
for(const locale of ['en','es','it','fr','de']){
 test(`${locale}: actual POS form has an unchecked declaration and blank date before confirmation, hidden when disabled or unperformed`,()=>{
  const nodes=workspace(locale);const box=nodes.find(n=>n.type==='input'&&n.props.name==='serviceEvidence');const date=nodes.find(n=>n.type==='input'&&n.props.name==='servicePerformedOn');
  assert.equal(box.props.checked,false);assert.equal(date.props.value,undefined);assert.equal(date.props.defaultValue,undefined);assert.equal(date.props.disabled,true);assert.equal(date.props.max,'2026-11-14');assert.equal(nodes.indexOf(box)<nodes.findIndex(n=>n.type==='button'&&n.props.type==='submit'&&n.props.children===JSON.parse(read(`src/i18n/${locale}/common.json`)).pos.actions.pay),true);
  const chosen=workspace(locale,true,true).find(n=>n.type==='input'&&n.props.name==='servicePerformedOn');assert.equal(chosen.props.required,true);assert.equal(chosen.props.disabled,false);
  for(const ns of [workspace(locale,false),workspace(locale,true,false,'received')])assert.equal(ns.some(n=>n.props?.name==='serviceEvidence'),false);
 });
 test(`${locale}: coverage renderer displays review, persisted fiscal reference and declared date without another ticket or issuance form`,()=>{
  const mod=load('src/components/billing/PosFiscalCoverage.tsx',{'@/features/billing/fiscal-coverage-messages':messages,'@/lib/number-format':{formatCurrency:v=>String(v)}});
  const text=messages.fiscalCoverageMessages(locale);assert.ok(Object.values(text).every(v=>typeof v==='string'&&v.length>5));
  const html=renderToStaticMarkup(React.createElement(mod.PosFiscalCoverage,{locale,currency:'EUR',data:{...response,state:'ready',payments:[payment,{...payment,paymentId:id(5),status:'existing_document_linked',document:{id:id(6),number:'SYNTHETIC-A-123',issuedAt:payment.paidAt,amount:21}}]}}));
  assert.ok(html.includes(text.review_required));assert.ok(html.includes('2026-11-13'));assert.ok(html.includes('SYNTHETIC-A-123'));assert.equal(/<article|<form|<button/.test(html),false);
  const unavailable=renderToStaticMarkup(React.createElement(mod.PosFiscalCoverage,{locale,currency:'EUR',data:{state:'unavailable'}}));assert.ok(unavailable.includes(text.unavailable.replaceAll('’','’')));
 });
}
