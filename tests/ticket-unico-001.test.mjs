import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
const source = readFileSync(new URL('../src/features/orders/server/actions.ts', import.meta.url), 'utf8');
const orderId='00000000-0000-4000-8000-000000000001';
function scenario({mode='issued', allowed=true, automatic=true, gateError=false}={}) {
 const calls=[];const redirect=href=>{throw Object.assign(Error('REDIRECT'),{href});};
 const client={from:()=>{const chain={select:()=>chain,eq:()=>chain,maybeSingle:async()=>({data:{assigned_to:null,production_status:'packing'},error:null})};return chain;},rpc:async(name,args)=>{
  calls.push({name,args});if(mode==='timeout')throw Error('CONNECTION_LOST');
  if(mode==='transport')return{data:null,error:{code:'',message:'NETWORK'}};
  return{data:mode==='empty'?null:{status:mode},error:null};
 }};
 const modules={
  '@/features/billing/server/ticket-unico':{ticketUnicoEnabled:async()=>{if(gateError)throw Error('ticket_unico_state_unavailable');return automatic;}},
  'next/cache':{revalidatePath:()=>{}},'next/navigation':{redirect},
  '@/features/shop-terminal/server/access':{requireShopTerminalAccess:async()=>{if(!allowed)throw Error('DENIED');}},
  '@/lib/auth/require-membership':{requireMembership:async()=>({membership:{role:'owner',organization:{id:'e09f1e0b-1c4d-4450-9a30-79999bee545a'}},profile:{id:orderId}})},
  '@/lib/auth/capabilities':{hasOperationalCapability:()=>allowed},
  '@/lib/supabase/server':{createSupabaseServerClient:async()=>client},
  '@/features/orders/validation':{parseProductionStatus:s=>['ready','washing','completed'].includes(s)?s:null,isUuid:s=>/^[0-9a-f-]{36}$/.test(s),optionalDbValue:s=>s||null},
  '@/features/orders/workflow':{FINAL_PRODUCTION_STATUSES:['completed','cancelled']},
  '@/lib/daily-close-error':{isBusinessDayClosedError:()=>false},
 };
 const module={exports:{}};
 runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,console,require:n=>{assert.ok(n in modules,`unmocked import ${n}`);return modules[n];}});
 const form=new FormData();for(const[k,v]of Object.entries({targetStatus:'ready',finalPositionId:orderId,finalPackageCount:'1',finalStorageMode:'folded',completionFormVersion:'ticket-unico-v1'}))form.set(k,v);
 return{form,calls,request:()=>module.exports.requestOrdinaryInvoiceAction('it',orderId),run:()=>module.exports.transitionOrderStatusAction('it',orderId,'order',form)};
}
test('existing completion button delegates once with the explicit current-work evidence',async()=>{
 const s=scenario();await s.run();assert.equal(s.calls.length,1);assert.equal(s.calls[0].name,'complete_order_with_billing');assert.equal(s.calls[0].args.target_completed_now,true);assert.equal('organization_id'in s.calls[0].args,false);
});
test('late or legacy completion forms cannot claim contemporaneous service',async()=>{
 for(const legacy of [false,true]){const s=scenario();if(legacy)s.form.delete('completionFormVersion');else s.form.set('completionRecordedLate','on');await s.run();assert.equal(s.calls[0].args.target_completed_now,false);}
});
test('SQL fiscal review is shown on the existing order page without a second RPC',async()=>{
 const s=scenario({mode:'review_required'});await assert.rejects(s.run(),e=>e.href.includes('fiscalReview=1'));assert.equal(s.calls.length,1);
});
test('timeout, transport failure and empty response remain uncertain, without any automatic retry',async()=>{
 for(const mode of ['timeout','transport','empty']){const s=scenario({mode});await assert.rejects(s.run(),e=>e.href.includes('fiscalReview=uncertain'));assert.equal(s.calls.length,1);}
});
test('a role lacking the operational capability never reaches Billing or the completion RPC',async()=>{
 const s=scenario({allowed:false});await s.run();assert.equal(s.calls.length,0);
});
test('other production transitions continue using the existing canonical RPC',async()=>{
 const s=scenario();s.form.set('targetStatus','washing');await s.run();assert.equal(s.calls.length,1);assert.equal(s.calls[0].name,'transition_order_status');assert.equal('target_completed_now'in s.calls[0].args,false);
});

test('Terminal rejects non-boolean ordinary intent before any RPC, without silently changing its meaning',async()=>{
 const terminal=readFileSync(new URL('../src/features/shop-terminal/server/actions.ts',import.meta.url),'utf8');
 let accessCalls=0;const module={exports:{}};
 runInNewContext(ts.transpileModule(terminal,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,console,require:name=>{
  if(name==='@/features/shop-terminal/server/access')return{requireShopTerminalAccess:async()=>{accessCalls++;throw Error('REACHED_AUTH');}};
  return{};
 }});
 const payload={customerId:orderId,idempotencyKey:orderId,dueAt:'2026-11-16T12:00:00Z',discountAmount:0,items:[{serviceId:orderId,quantity:1}],payments:[]};
 for(const ordinaryInvoiceRequested of ['true','false',1,{},null]){
  const form=new FormData();form.set('payload',JSON.stringify({...payload,ordinaryInvoiceRequested}));
  const result=await module.exports.submitShopOrderAction('it',{result:null,error:null},form);assert.equal(result.error,'validation');
 }
 assert.equal(accessCalls,0);
 for(const ordinaryInvoiceRequested of [true,false]){
  const form=new FormData();form.set('payload',JSON.stringify({...payload,ordinaryInvoiceRequested}));
  await assert.rejects(module.exports.submitShopOrderAction('it',{result:null,error:null},form),/REACHED_AUTH/);
 }
 assert.equal(accessCalls,2);
});

test('authorized counter operators can register an ordinary request on an existing order without issuing it',async()=>{
 const s=scenario();await assert.rejects(s.request(),e=>e.href===`/it/app/orders/${orderId}`);assert.equal(s.calls.length,1);assert.equal(s.calls[0].name,'request_order_ordinary_invoice');
 const denied=scenario({allowed:false});await assert.rejects(denied.request(),/DENIED/);assert.equal(denied.calls.length,0);
});


test('disabled/non-pilot actions use the original READY and completed mutations, without fiscal evidence parameters',async()=>{
 for(const targetStatus of ['ready','completed']) {
  const s=scenario({automatic:false});s.form.set('targetStatus',targetStatus);await s.run();
  assert.equal(s.calls.length,1);assert.equal(s.calls[0].name,targetStatus==='ready'?'transition_order_ready_with_storage':'transition_order_status');
  assert.equal('target_completed_now' in s.calls[0].args,false);
 }
 const request=scenario({automatic:false});await assert.rejects(request.request(),e=>e.href===`/it/app/orders/${orderId}`);assert.equal(request.calls.length,0);
});

function loadModule(path,modules) {
 const module={exports:{}};
 runInNewContext(ts.transpileModule(readFileSync(new URL(`../${path}`,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,console,FormData,require:name=>{
  if(name==='server-only')return{};
  assert.ok(name in modules,`unmocked import ${name}`);return modules[name];
 }});return module.exports;
}

test('effective UI gate requires the server flag: UUID, malformed/missing flag and read errors never enable it',async()=>{
 for(const [org,data,error,throws,expected] of [
  ['pilot',true,null,false,true],['pilot',false,null,false,false],['pilot',null,null,false,false],
  ['pilot','true',null,false,false],['pilot',true,{code:'PGRST202'},false,false],['pilot',true,null,true,false],
  ['other',true,null,false,false],
 ]) {
  let calls=0;
  const mod=loadModule('src/features/billing/server/ticket-unico.ts',{
   '@/lib/auth/require-membership':{requireMembership:async()=>({membership:{organization:{id:org}}})},
   '@/features/billing/ticket-unico':{TICKET_UNICO_PILOT_ID:'pilot'},
   '@/lib/supabase/server':{createSupabaseServerClient:async()=>({rpc:async(name,...args)=>{calls++;assert.equal(name,'get_ticket_unico_enabled');assert.equal(args.length,0);if(throws)throw Error('NETWORK');return{data,error};}})},
  });
  if(org==='pilot'&&(error||throws||typeof data!=='boolean'))await assert.rejects(mod.ticketUnicoEnabled('it'),/ticket_unico_state_unavailable/);
  else assert.equal(await mod.ticketUnicoEnabled('it'),expected);assert.equal(calls,org==='pilot'?1:0);
 }
});

test('order creation keeps the original RPC/arguments when disabled and uses the atomic wrapper only when enabled',async()=>{
 for(const automatic of [false,true]) {
  const calls=[];const redirect=href=>{throw Object.assign(Error('REDIRECT'),{href});};
  const mod=loadModule('src/features/orders/server/actions.ts',{
   '@/features/billing/server/ticket-unico':{ticketUnicoEnabled:async()=>automatic},
   'next/cache':{revalidatePath:()=>{}},'next/navigation':{redirect},
   '@/features/shop-terminal/server/access':{},'@/lib/auth/require-membership':{requireMembership:async()=>({})},'@/lib/auth/capabilities':{},
   '@/lib/supabase/server':{createSupabaseServerClient:async()=>({rpc:(name,args)=>{calls.push({name,args});return{single:async()=>({data:{id:orderId},error:null})};}})},
   '@/features/orders/validation':{parseOrderForm:()=>({valid:true,fieldErrors:{},input:{customerId:orderId,priority:'normal'}}),optionalDbValue:v=>v||null},
   '@/features/orders/workflow':{},'@/lib/daily-close-error':{},
  });
  const form=new FormData();form.set('ordinaryInvoiceRequested','on');
  await assert.rejects(mod.createOrderAction('it',undefined,form),e=>e.href===`/it/app/orders/${orderId}`);
  assert.equal(calls.length,1);assert.equal(calls[0].name,automatic?'create_order_with_fiscal_route':'create_order');
  assert.equal('target_ordinary_invoice_requested' in calls[0].args,automatic);
 }
});

test('ordinary draft uses the legacy writer when disabled; disabled entry preparation adds no route mutation',async()=>{
 for(const automatic of [false,true]) {
  const calls=[];const redirect=href=>{throw Object.assign(Error('REDIRECT'),{href});};
  const client={rpc:async(name,args)=>{calls.push({name,args});return{data:orderId,error:null};}};
  const common={
   '@/features/billing/server/ticket-unico':{ticketUnicoEnabled:async()=>automatic},
   'next/cache':{revalidatePath:()=>{}},'next/navigation':{redirect},
   '@/lib/supabase/server':{createSupabaseServerClient:async()=>client},
  };
  const billing=readFileSync(new URL('../src/features/billing/server/actions.ts',import.meta.url),'utf8');
  // Explicit imported dependencies; unrelated exports are not invoked by this scenario.
  const deps=Object.fromEntries([...billing.matchAll(/from \"([^\"]+)\"/g)].map(m=>[m[1],{}]));
  const mods={...deps,...common,'@/lib/auth/require-role':{requireOwnerOrManager:async()=>({})},
   '@/features/entitlements/server/resolver':{requireEntitlement:async()=>{}},
   '@/features/entitlements/feature-catalog':{FEATURES:{billingInvoicing:'billing.invoicing'}},
   '@/features/billing/tax-rate':{parseTaxRate:()=>7},
   '@/features/billing/document-selection':{validateBillingDocumentSelection:()=>({allowed:true})},
  };
  const source=ts.transpileModule(billing,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  // Keep the production selection parser, whose export location is discovered from the import.
  for(const match of billing.matchAll(/import \{([^}]+)\} from \"([^\"]+)\"/g)) {
   if(match[1].includes('validateBillingDocumentSelection'))mods[match[2]]={...mods[match[2]],validateBillingDocumentSelection:()=>({allowed:true})};
  }
  const module={exports:{}};runInNewContext(source,{module,exports:module.exports,console,require:n=>{assert.ok(n in mods,n);return mods[n];}});
  const form=new FormData();form.set('orderId',orderId);form.set('taxRate','7');form.set('series','A');
  await assert.rejects(module.exports.createBillingDraftAction('it',orderId,form),e=>e.href===`/it/app/billing/${orderId}`);
  assert.equal(calls[0].name,automatic?'create_billing_draft_with_order_route':'create_billing_draft');
  calls.length=0;
  const entry=loadModule('src/features/billing/server/order-route-actions.ts',{...common,'./order-entry':{getBillingOrderEntry:async()=>({kind:'prepare',href:'/app/billing/new'})}});
  await assert.rejects(entry.prepareOrdinaryBillingForOrder('it',orderId),e=>e.href==='/it/app/billing/new');
  assert.equal(calls.length,automatic?1:0);
 }
});


test('Terminal intake sends the original parameter contract when off and the scoped wrapper only when on',async()=>{
 for(const automatic of [false,true]) {
  const calls=[];const chain={select:()=>chain,eq:()=>chain,is:()=>chain,limit:()=>chain,returns:async()=>({data:[{id:orderId}],error:null})};
  const client={from:()=>chain,rpc:(name,args)=>{calls.push({name,args});return{single:async()=>({data:{order_id:orderId,order_number:'EW-SYNTHETIC',total:21,subtotal:21,discount_amount:0,paid:0,outstanding:21},error:null})};}};
  const mod=loadModule('src/features/shop-terminal/server/actions.ts',{
   '@/features/billing/server/ticket-unico':{ticketUnicoEnabled:async()=>automatic},
   'next/cache':{revalidatePath:()=>{}},'@/i18n/routing':{},
   '@/features/shop-terminal/server/access':{requireShopTerminalAccess:async()=>({membership:{organization:{id:orderId,timezone:'Atlantic/Canary'}}})},
   '@/lib/supabase/server':{createSupabaseServerClient:async()=>client},
   '@/features/shop-terminal/server/queries':{},'@/features/barcode/payload':{},'@/features/entitlements/feature-catalog':{},
   '@/features/entitlements/server/resolver':{},'@/features/services/types':{},'@/lib/organization-timezone':{},
   '@/lib/daily-close-error':{},'@/features/shop-terminal/submission-rejection':{},
  });
  const form=new FormData();form.set('payload',JSON.stringify({customerId:orderId,idempotencyKey:orderId,dueAt:'2026-11-16T12:00:00Z',discountAmount:0,items:[{serviceId:orderId,quantity:2}],payments:[],ordinaryInvoiceRequested:true}));
  const result=await mod.submitShopOrderAction('it',{error:null,result:null},form);
  assert.equal(result.error,null);assert.equal(calls.length,1);
  assert.equal(calls[0].name,automatic?'submit_shop_terminal_order_with_fiscal_route':'submit_shop_terminal_order');
  assert.equal('target_ordinary_invoice_requested' in calls[0].args,automatic);
  assert.equal(Object.keys(calls[0].args).length,automatic?25:24);
 }
});


test('unknown activation state stops a fiscal completion before mutation; unrelated washing uses no fiscal gate',async()=>{
 const s=scenario({gateError:true});await assert.rejects(s.run(),/ticket_unico_state_unavailable/);assert.equal(s.calls.length,0);
 const other=scenario({gateError:true});other.form.set('targetStatus','washing');await other.run();assert.equal(other.calls.length,1);assert.equal(other.calls[0].name,'transition_order_status');
});
