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
      if (['react', 'react/jsx-runtime'].includes(name)) return require(name);
      if (Object.hasOwn(imports, name)) return imports[name];
      throw Error(`Unexpected import ${name}`);
    },
  }); return module.exports;
}
const types=load('src/features/billing/payment-link.ts');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const snapshot={workflow:'pos_billing_payment_link',order_id:id(1),order_number:'EW-SYNTHETIC-21',created_at:'2026-11-14T10:00:00Z',due_at:'2026-11-16T10:00:00Z',customer_name:'Snapshot customer',customer_notes:'Frozen <note>',currency:'EUR',subtotal:21,discount:0,total:21,items:[{id:id(5),description:'Frozen shirt',quantity:2,unitType:'piece',unitPrice:10.5,lineTotal:21}]};
const doc={id:id(3),paymentId:id(2),number:'SYNTHETIC-S-000001',issuedAt:'2026-11-14T10:00:00Z',role:'advance',event:'advance',total:5,base:4.67,tax:.33,roundingDelta:null,snapshot,issuer:{name:'Synthetic issuer',taxId:'TEST-ONLY',address:'Test street'}};
test('typed response distinguishes empty history, malformed response and historical documents without new snapshot',()=>{
  assert.equal(types.parsePosBillingDocuments({enabled:false,documents:[]}).state,'ready');
  for(const v of [null,{}, {enabled:true,documents:[{}]}, {enabled:true,documents:[{...doc,snapshot:{}}]}]) assert.equal(types.parsePosBillingDocuments(v).state,'unavailable');
  assert.equal(types.parsePosBillingDocuments({enabled:true,documents:[doc,{...doc,id:id(4),snapshot:null}]}).documents.length,2);
});
function api({denied=false,error=null,data={enabled:false,documents:[]}}={}){
 const calls=[];const mod=load('src/features/billing/server/payment-link.ts',{
  '@/features/shop-terminal/server/access':{requireShopTerminalAccess:async()=>{if(denied)throw Error('POS_DENIED');}},
  '@/features/printing/server/access':{requirePrintAccess:async()=>{}},'@/features/entitlements/server/resolver':{requireEntitlement:async()=>{}},
  '@/features/entitlements/feature-catalog':{FEATURES:{billingInvoicing:'billing.invoicing'}},
  '@/lib/supabase/server':{createSupabaseServerClient:async()=>({rpc:async(...args)=>{calls.push(args);return{data,error};}})},
  '@/features/billing/payment-link':types,
 });return{calls,run:()=>mod.getPosBillingPaymentDocuments('en',id(1))};
}
test('order-scoped GET sends no tenant from browser and never invokes an issuer',async()=>{
 const a=api();assert.equal((await a.run()).state,'ready');assert.equal(a.calls[0][0],'get_pos_billing_payment_documents');assert.deepEqual(Object.keys(a.calls[0][1]),['target_order_id']);
});
test('authorization failure propagates; SQL errors remain unavailable rather than an empty list',async()=>{
 const a=api({denied:true});await assert.rejects(a.run(),/POS_DENIED/);assert.equal(a.calls.length,0);assert.equal((await api({error:{code:'42501'}}).run()).state,'unavailable');
});
function action(mode='success'){
 const calls=[];const redirect=href=>{throw Object.assign(Error('REDIRECT'),{href});};
 const mod=load('src/features/billing/server/payment-link-actions.ts',{
  'next/navigation':{redirect},'next/cache':{revalidatePath:()=>{}},'./payment-link':{requirePosBillingAccess:async()=>{if(mode==='denied')throw Error('DENIED');}},
  '@/features/billing/fiscal-ticket':load('src/features/billing/fiscal-ticket.ts'),'@/features/billing/payment-link':types,
  '@/lib/supabase/server':{createSupabaseServerClient:async()=>({rpc:async(...args)=>{calls.push(args);if(mode==='timeout')throw Error('TIMEOUT');return{data:[{invoice_id:id(3)}],error:null};}})},
 });const form=new FormData();for(const [key,value]of Object.entries({paymentId:id(2),event:'advance',recipient:'consumer',confirmed:'on',laundryScope:'on',organization_id:id(99),amount:'999'}))form.set(key,value);
 return{form,calls,run:()=>mod.issuePosBillingPaymentDocument('en',id(1),form)};
}
test('explicit issue delegates once and redirects to the existing 80mm customer copy without another payment',async()=>{
 const a=action();await assert.rejects(a.run(),e=>e.href.endsWith('result=issued'));assert.equal(a.calls.length,1);assert.equal(a.calls[0][0],'issue_pos_billing_payment_document');assert.equal(a.calls[0][1].target_order_id,id(1));assert.equal(a.calls[0][1].target_service_performed_on,null);assert.equal('amount'in a.calls[0][1],false);assert.equal('organization_id'in a.calls[0][1],false);
});
test('missing confirmations, final service date and permission never invoke an issuer',async()=>{
 for(const key of ['confirmed','laundryScope','recipient','event']){const a=action();a.form.delete(key);await assert.rejects(a.run(),e=>e.href.endsWith('result=confirmation'));assert.equal(a.calls.length,0);}
 const a=action();a.form.set('event','final');await assert.rejects(a.run(),e=>e.href.endsWith('result=confirmation'));assert.equal(a.calls.length,0);
 const b=action('denied');await assert.rejects(b.run(),/DENIED/);assert.equal(b.calls.length,0);
});
test('uncertain issue is never retried or treated as a new POS collection',async()=>{
 const a=action('timeout');await assert.rejects(a.run(),e=>e.href.endsWith('result=uncertain'));assert.equal(a.calls.length,1);
});
function renderer(locale){
 const all=JSON.parse(read(`src/i18n/${locale}/common.json`));const intl={getTranslations:async({namespace})=>key=>key.split('.').reduce((v,k)=>v[k],namespace.split('.').slice(1).reduce((v,k)=>v[k],all))};
 const empty={};const copy=load('src/components/printing/OrderPrintDocument.tsx',{
  'next-intl/server':intl,'next/image':{default:'img'},'@/components/printing/PrintButton':{PrintButton:()=>null},
  '@/features/printing/labels':empty,'@/i18n/navigation':{Link:({children,prefetch:ignoredPrefetch,locale:ignoredLocale,...props})=>React.createElement('a',props,children)},'@/lib/number-format':load('src/lib/number-format.ts'),
  '@/components/barcode/ScannableQrCode':empty,'@/features/barcode/payload':empty,'@/lib/organization-timezone':load('src/lib/organization-timezone.ts'),
 });
 const ui=load('src/components/billing/PosBillingCustomerCopy.tsx',{
  'next-intl/server':intl,'@/i18n/navigation':{Link:({children,prefetch:ignoredPrefetch,locale:ignoredLocale,...props})=>React.createElement('a',props,children)},'@/components/printing/OrderPrintDocument':copy,
  '@/components/printing/PrintButton':{PrintButton:()=>null},'@/lib/number-format':load('src/lib/number-format.ts'),
  '@/lib/organization-timezone':load('src/lib/organization-timezone.ts'),'@/features/billing/server/payment-link-actions':{issuePosBillingPaymentDocument:async()=>{}},
  '@/features/billing/payment-link-messages':load('src/features/billing/payment-link-messages.ts'),
 });
 const context={branding:{brand:{name:'Synthetic laundry',logoPath:null},support:{}},organizationName:'Synthetic laundry',locationName:null,timezone:'Atlantic/Canary',
  order:{id:id(1),orderNumber:'EW-SYNTHETIC-21',customerName:'Live customer',customerNotes:'Live modified note',internalNotes:'SECRET INTERNAL',createdAt:snapshot.created_at,dueAt:snapshot.due_at,currency:'EUR',subtotal:21,discountAmount:0,total:21},items:snapshot.items,
  payments:[{id:id(2),amount:5,status:'confirmed',channel:'pos',paidAt:doc.issuedAt}],paymentSummary:{totalPaid:5,balanceDue:16}};
 return async(data,change={})=>renderToStaticMarkup(await ui.PosBillingCustomerCopy({locale,format:'80mm',data,context:{...context,...change}}));
}
for(const locale of ['en','es','it','fr','de']){
 test(`${locale}: single existing customer layout, actual paid/residual, immutable notes and all issued references`,async()=>{
  const render=renderer(locale);const html=await render({state:'ready',enabled:false,documents:[doc,{...doc,id:id(4),paymentId:id(8),number:'SYNTHETIC-S-000002',role:'final',event:'service',total:16,base:14.95,tax:1.05,roundingDelta:-.01}]});
  const dictionary=JSON.parse(read(`src/i18n/${locale}/common.json`));const money=load('src/lib/number-format.ts').formatCurrency;
  assert.ok(html.includes(`<dt>${dictionary.print.fields.paid}</dt><dd>${money(5,'EUR',locale)}</dd>`));
  assert.ok(html.includes(`<dt>${dictionary.print.fields.outstanding}</dt><dd>${money(16,'EUR',locale)}</dd>`));
  const settled=await render({state:'ready',enabled:false,documents:[doc]},{paymentSummary:{totalPaid:21,balanceDue:0}});
  assert.ok(settled.includes(`<dt>${dictionary.print.fields.paid}</dt><dd>${money(21,'EUR',locale)}</dd>`));
  assert.ok(settled.includes(`<dt>${dictionary.print.fields.outstanding}</dt><dd>${money(0,'EUR',locale)}</dd>`));
  assert.equal((html.match(/<article/g)||[]).length,1);assert.ok(html.includes(doc.number));assert.ok(html.includes('SYNTHETIC-S-000002'));assert.ok(html.includes('Frozen &lt;note&gt;'));assert.equal(html.includes('Live modified note'),false);assert.equal(html.includes('SECRET INTERNAL'),false);assert.ok(html.includes('Frozen shirt'));assert.equal(html.includes('<form'),false);
  const empty=await render({state:'ready',enabled:true,documents:[]},{payments:[],paymentSummary:{totalPaid:0,balanceDue:21}});assert.equal(empty.includes('<form'),false);assert.equal(empty.includes('SYNTHETIC-S-000001'),false);
  const pending=await render({state:'ready',enabled:true,documents:[]});assert.ok(pending.includes('<form'));assert.equal(/checked=/.test(pending),false);assert.ok(pending.includes('value=""'));assert.equal((pending.match(/<article/g)||[]).length,1);
 });
}
