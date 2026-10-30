import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const read = path => readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const draft='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const payment='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const other='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
function actionHarness({linkRole='final',linkInvoice=draft,lost=false,missing=false,role='owner',entitled=true,status='issued',event='advance',rpcError}={}) {
  const calls=[];
  const rows={
    billing_invoice_payment_links: missing?[]:[{organization_id:'tenant',payment_id:payment,invoice_id:linkInvoice,billing_link_role:linkRole}],
    invoices:[{organization_id:'tenant',id:linkInvoice,document_status:status,billing_event_kind:event}],
  };
  const client={
    async rpc(name,args) { calls.push({name,args}); if(lost) throw Error('Response lost'); return {data:null,error:rpcError?{message:rpcError}:null}; },
    from(table) { const filters=[]; return {
      select(){return this;},eq(k,v){filters.push([k,v]);return this;},
      async maybeSingle(){return {data:rows[table].find(row=>filters.every(([k,v])=>row[k]===v))??null,error:null};},
    }; },
  };
  const exports={};
  runInNewContext(ts.transpileModule(read('src/features/billing/server/actions.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
    exports,require(name){
      if(name==='next/cache')return {revalidatePath(){}};
      if(name==='next/navigation')return {redirect(href){throw Object.assign(Error('REDIRECT'),{href});}};
      if(name==='@/lib/auth/require-role')return {async requireOwnerOrManager(){if(!['owner','manager'].includes(role))throw Error('ROLE_DENIED');return {membership:{organization:{id:'tenant'}}};}};
      if(name==='@/features/entitlements/feature-catalog')return {FEATURES:{billingInvoicing:'billing.invoicing'}};
      if(name==='@/features/entitlements/server/resolver')return {async requireEntitlement(){if(!entitled)throw Error('ENTITLEMENT_DENIED');}};
      if(name==='@/lib/supabase/server')return {async createSupabaseServerClient(){return client;}};
      if(name.startsWith('@/features/billing/'))return {};
      throw Error(`Unexpected import ${name}`);
    },
  });
  const form=new FormData();
  form.set('operationScope','local_laundry_dry_cleaning');form.set('fiscalRecipientRequirement','consumer');form.set('advanceIssueConfirmed','confirmed');
  return {calls,run:()=>exports.issueBillingAdvanceAction('it',draft,payment,form)};
}
for(const lost of [false,true])test(`full prepayment action resolves committed original UUID, lost=${lost}`,async()=>{
  const h=actionHarness({lost});
  await assert.rejects(h.run(),e=>e.href===`/it/app/billing/${draft}?saved=issued`);
  assert.equal(h.calls.length,1); // No blind retry, including a lost RPC response.
  assert.equal(h.calls[0].name,'issue_billing_advance_invoice');
  assert.equal(h.calls[0].args.target_payment_id,payment);
});
test('partial advance recovery still redirects to its separate document',async()=>{
  const h=actionHarness({linkRole:'advance',linkInvoice:other,lost:true});
  await assert.rejects(h.run(),e=>e.href===`/it/app/billing/${other}?saved=issued`);
  assert.equal(h.calls.length,1);
});
for(const options of [{linkInvoice:other},{missing:true},{status:'draft'},{event:'service'}])test(`recovery rejects incompatible evidence ${JSON.stringify(options)}`,async()=>{
  const h=actionHarness(options);
  await assert.rejects(h.run(),e=>e.href===`/it/app/billing/${draft}?error=issueUncertain`);
  assert.equal(h.calls.length,1);
});
for(const options of [{role:'staff'},{entitled:false}])test(`action gates before RPC ${JSON.stringify(options)}`,async()=>{
  const h=actionHarness(options);await assert.rejects(h.run(),/DENIED/);assert.equal(h.calls.length,0);
});

test('advance issuance maps invalid draft to actionable feedback without changing other rejections',async()=>{
  for(const [message,expected] of [['billing_advance_full_reconciliation_required','fullPrepaymentBlocked'],['billing_invalid_draft','invalidDraft'],['unexpected database error','generic']]) {
    const h=actionHarness({missing:true,rpcError:message});
    await assert.rejects(h.run(),e=>e.href===`/it/app/billing/${draft}?error=${expected}`);
    assert.equal(h.calls.length,1);
  }
});

test('invoice detail displays invalid-draft feedback in all five locales',async()=>{
  const exports={};
  const detail={invoice:{id:draft}};
  const jsx=(type,props)=>({type,props});
  runInNewContext(ts.transpileModule(read('src/app/[locale]/app/(dashboard)/billing/[invoiceId]/page.tsx'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
  }).outputText,{
    exports,require(name){
      if(name==='react/jsx-runtime')return {jsx,jsxs:jsx,Fragment:'fragment'};
      if(name==='next-intl/server')return {getTranslations:async({locale})=>key=>{
        assert.equal(key,'errors.invalidDraft');
        return JSON.parse(read(`src/i18n/${locale}/common.json`)).billing.errors.invalidDraft;
      }};
      if(name==='@/features/billing/server/queries')return {getBillingInvoice:async()=>detail};
      if(name==='@/components/billing/BillingInvoiceView')return {BillingInvoiceView:'BillingInvoiceView'};
      throw Error(`Unexpected import ${name}`);
    },
  });
  for(const locale of ['it','es','en','fr','de']){
    const message=JSON.parse(read(`src/i18n/${locale}/common.json`)).billing.errors.invalidDraft;
    assert.ok(message?.length>25,`${locale} invalid-draft feedback missing`);
    const tree=await exports.default({params:Promise.resolve({invoiceId:draft,locale}),searchParams:Promise.resolve({error:'invalidDraft'})});
    const [alert,view]=tree.props.children;
    assert.equal(alert.props.role,'alert');
    assert.equal(alert.props.children,message);
    assert.equal(view.props.detail,detail);
    const ordinary=await exports.default({params:Promise.resolve({invoiceId:draft,locale}),searchParams:Promise.resolve({})});
    assert.equal(ordinary.props.children[0],null);
  }
});

test('migration preserves the partial writer and adds no zero-final or alternate payment model',()=>{
  const old=read('supabase/migrations/20261019000100_billing_simplified_invoice_001g_c2_exact_reconciliation.sql');
  const sql=read('supabase/migrations/20261028163423_billing_full_prepayment_001.sql');
  const tail=s=>s.slice(s.indexOf('\n  if rates<>1'),s.indexOf('revoke all on function public.issue_billing_advance_invoice'));
  // The newly inserted full branch has a differently indented rate check.
  assert.equal(tail(sql),tail(old));
  assert.doesNotMatch(sql,/create(?: or replace)? function public.issue_billing_final_after_advances|alter table|insert into public.payments/i);
  assert.match(sql,/service_not_performed_confirmed is distinct from true/);
});

test('five locales identify the full advance in shared screen/print view',()=>{
  for(const locale of ['it','en','es','fr','de']) {
    const strings=JSON.parse(read(`src/i18n/${locale}/common.json`)).billing.advanceFlow;
    for(const key of ['fullPrepaymentInvoice','fullPrepaymentHelp','fullPrepaymentConfirm','issueFullPrepayment'])assert.ok(strings[key]?.length>10);
  }
  const view=read('src/components/billing/BillingInvoiceView.tsx');
  assert.match(view,/detail.fullPrepayment \? "advanceFlow.fullPrepaymentInvoice"/);
  assert.match(view,/BillingInvoiceView\(\{ detail, locale, printMode: true/);
});
