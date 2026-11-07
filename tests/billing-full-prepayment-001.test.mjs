import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const read = path => readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const draft='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function invoicePageHarness() {
  const exports={};
  const detail={invoice:{id:draft}};
  const jsx=(type,props)=>({type,props});
  runInNewContext(ts.transpileModule(read('src/app/[locale]/app/(dashboard)/billing/[invoiceId]/page.tsx'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
  }).outputText,{
    exports,require(name){
      if(name==='react/jsx-runtime')return {jsx,jsxs:jsx,Fragment:'fragment'};
      if(name==='next-intl/server')return {getTranslations:async({locale})=>key=>{
        assert.equal(key.split('.')[0],'errors');
        const errors=JSON.parse(read(`src/i18n/${locale}/common.json`)).billing.errors;
        assert.ok(Object.hasOwn(errors,key.slice(7)),`Unknown translation ${key}`);
        return errors[key.slice(7)];
      }};
      if(name==='@/features/billing/server/queries')return {getBillingInvoice:async()=>detail};
      if(name==='@/components/billing/BillingInvoiceView')return {BillingInvoiceView:'BillingInvoiceView'};
      throw Error(`Unexpected import ${name}`);
    },
  });
  return {detail,render:(locale,error)=>exports.default({
    params:Promise.resolve({invoiceId:draft,locale}),searchParams:Promise.resolve({error}),
  })};
}

const feedbackKeys=['settingsInvalid','generic','issuer','customer','duplicate','unauthorized','orders',
  'documentType','simplifiedUnavailable','simplifiedSeriesInvalid','simplifiedSeriesUsed',
  'simplifiedSeriesSettings','invalidDraft','fullPrepaymentBlocked','advanceBlocked','serviceDate',
  'serviceDeclaration','issueUncertain'];
for(const code of feedbackKeys)test(`invoice feedback displays ${code} in all five locales`,async()=>{
  const h=invoicePageHarness();
  for(const locale of ['it','es','en','fr','de']){
    const errors=JSON.parse(read(`src/i18n/${locale}/common.json`)).billing.errors;
    assert.deepEqual(Object.keys(errors).sort(),[...feedbackKeys].sort(),`${locale} error keys`);
    const message=errors[code];
    assert.ok(message?.length>10,`${locale} ${code} feedback missing`);
    const [alert,view]=(await h.render(locale,code)).props.children;
    assert.equal(alert.type,'p');
    assert.equal(alert.props.role,'alert');
    assert.equal(alert.props.className,'mb-4 rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700');
    assert.equal(alert.props.children,message);
    assert.equal(view.props.detail,h.detail);
    assert.equal(view.props.locale,locale);
  }
});
test('invoice feedback is absent without a nonempty error',async()=>{
  const h=invoicePageHarness();
  for(const error of [undefined,'']) {
    const [alert,view]=(await h.render('it',error)).props.children;
    assert.equal(alert,null);
    assert.equal(view.props.detail,h.detail);
  }
});
test('invoice feedback uses generic for unknown or repeated URL codes without exposing input',async()=>{
  const h=invoicePageHarness();
  for(const locale of ['it','es','en','fr','de']) {
    const generic=JSON.parse(read(`src/i18n/${locale}/common.json`)).billing.errors.generic;
    for(const error of ['unknown','__proto__','constructor','errors.customer','SQLSTATE P0001: private details',' ',['customer','advanceBlocked']]) {
      const [alert]=(await h.render(locale,error)).props.children;
      assert.equal(alert.props.role,'alert');
      assert.equal(alert.props.children,generic);
    }
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
    for(const key of ['fullPrepaymentInvoice','fullPrepaymentHelp'])assert.ok(strings[key]?.length>10);
  }
  const view=read('src/components/billing/BillingInvoiceView.tsx');
  assert.match(view,/detail.fullPrepayment \? "advanceFlow.fullPrepaymentInvoice"/);
  assert.match(view,/BillingInvoiceView\(\{ detail, locale, printMode: true/);
});
