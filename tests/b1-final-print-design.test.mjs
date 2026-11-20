import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadPreviewModule, previewProps } from '../scripts/preview-billing-simplified-ticket.mjs';
const { BillingSimplifiedTicket, OperationalOrderTicket }=loadPreviewModule('src/components/billing/BillingSimplifiedTicket.tsx');
const { parseTicketSpecialMessage }=loadPreviewModule('src/features/printing/ticket-settings.ts');
const render=(c,p)=>renderToStaticMarkup(createElement(c,p));
function issued(){const p=previewProps('named');delete p.demonstration;p.document.fiscalUseAllowed=true;Object.assign(p.document.document,{status:'issued',number:'2026-S-000001',issuedAt:'2026-11-19T12:00:00Z'});p.document.presentation={version:2,timeZone:'Atlantic/Canary',serviceConditions:'Stored terms\nSecond line',specialMessage:'Stored message\nNext line',scheduleByOrder:{[p.document.orders[0].id]:{readyAt:'2026-11-20T10:00:00Z',pickupAt:'2026-11-21T12:30:00Z',deliveryAt:null}}};return p;}
test('one customer layout: frozen fiscal presentation and operational paper share message/order/date sections',()=>{
 const p=issued(), html=render(BillingSimplifiedTicket,p);assert.match(html,/customer-design/);assert.match(html,/class="customer-order"/);assert.match(html,/Recogida prevista:.*21 nov 2026, 12:30/);assert.match(html,/Trabajo previsto listo:.*20 nov 2026, 10:00/);
 assert.ok(html.indexOf('simplified-special-message"')>html.indexOf('simplified-totals"'));assert.ok(html.indexOf('simplified-special-message"')<html.indexOf('<footer'));
 const op=render(OperationalOrderTicket,{data:p.document,locale:'es',timeZone:'Atlantic/Canary',presentation:{specialMessage:'Operational message',serviceConditions:'Operational footer',scheduleByOrder:p.document.presentation.scheduleByOrder}});assert.match(op,/TICKET OPERATIVO · NO FISCAL/);assert.match(op,/customer-order/);assert.match(op,/Operational message/);assert.doesNotMatch(op,/2026-S-000001/);
});
test('issued message/conditions/timezone come only from Billing and cannot be replaced by current tenant props',()=>{
 const p=issued(),before=JSON.stringify(p.document);p.presentation.specialMessage='NEW LIVE MESSAGE';p.presentation.serviceConditions='NEW LIVE TERMS';p.timeZone='Asia/Tokyo';const html=render(BillingSimplifiedTicket,p);
 assert.match(html,/Stored message\nNext line/);assert.match(html,/Stored terms\nSecond line/);assert.doesNotMatch(html,/NEW LIVE/);assert.match(html,/21 nov 2026, 12:30/);assert.equal(JSON.stringify(p.document),before);
});
test('two tenant logo identities remain isolated; no logo gives the stored text heading',()=>{
 for(const name of ['Tenant A','Tenant B']){const p=issued(),path=`${name}/logo/immutable.png`;p.document.issuer.legalName=name;p.document.issuer.logoPath=path;p.presentation.branding={logoPath:path,logoUrl:'data:image/png;base64,AAAA'};
  assert.match(render(BillingSimplifiedTicket,p),/<img[^>]*class="print-brand-logo"/);
  p.presentation.branding={logoPath:'other-tenant/logo/image.png',logoUrl:'https://wrong.invalid/logo.png'};const isolated=render(BillingSimplifiedTicket,p);assert.doesNotMatch(isolated,/<img|wrong\.invalid/);assert.ok(isolated.includes(`<h1>${name}</h1>`));
  p.document.issuer.logoPath=null;assert.doesNotMatch(render(BillingSimplifiedTicket,p),/<img/);
 }
});
test('special message optional, multiline, escaped; no arbitrary HTML or empty section',()=>{
 const p=issued();p.document.presentation.specialMessage='<script>alert(1)</script>\nLine two';const html=render(BillingSimplifiedTicket,p);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/white-space:pre-wrap/);
 for(const v of [null,'',' \n ']){p.document.presentation.specialMessage=v;assert.doesNotMatch(render(BillingSimplifiedTicket,p),/<section class="simplified-special-message"/);}
 assert.equal(parseTicketSpecialMessage('a\nb').specialMessage,'a\nb');assert.equal(parseTicketSpecialMessage(' \n').specialMessage,null);assert.equal(parseTicketSpecialMessage('a'.repeat(4001)),null);
});
test('historical invoice cannot acquire a new message or new customer design retroactively',()=>{
 const p=issued();p.document.presentation={version:null,serviceConditions:null,specialMessage:null,scheduleByOrder:{}};p.presentation.specialMessage='Later message';p.presentation.serviceConditions='Later terms';const h=render(BillingSimplifiedTicket,p);
 assert.doesNotMatch(h,/Later message|Later terms|class="customer-order"|<section class="simplified-special-message"/);assert.match(h,/2026-S-000001/);
});
