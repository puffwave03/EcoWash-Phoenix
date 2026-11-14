-- Pilot IGIC policy supplied by PO/adviser: final fiscal quotas = operation - issued advances.
-- Local proposal only; all existing files/documents/payments remain unchanged.
begin;
set local lock_timeout = '5s';

alter table public.organization_billing_settings
  add column igic_final_reconciliation_enabled boolean not null default false;
alter table public.invoices add column igic_final_reconciliation_snapshot jsonb;
alter table public.invoice_items
  add column igic_final_base_adjustment numeric(14,2) not null default 0;

-- Zero is exactly the previous constraint. A nonzero exception is limited to a
-- cent-precision mono-rate IGIC final residual and must pass the scoped guard.
alter table public.invoice_items drop constraint invoice_items_amounts_valid;
alter table public.invoice_items add constraint invoice_items_amounts_valid check (
  quantity > 0 and unit_price >= 0
  and line_subtotal = round(quantity * unit_price, 2)
  and discount_amount >= 0 and discount_amount <= line_subtotal
  and tax_rate between 0 and 100 and taxable_base >= 0 and tax_amount >= 0 and line_total >= 0
  and (igic_final_base_adjustment=0 or (prices_include_tax and tax_rate=7))
  and (
    (not prices_include_tax and igic_final_base_adjustment=0
      and taxable_base = line_subtotal - discount_amount
      and tax_amount = round(taxable_base * tax_rate / 100, 2)
      and line_total = taxable_base + tax_amount)
    or (prices_include_tax and line_total = line_subtotal - discount_amount
      and taxable_base = round(line_total / (1 + tax_rate / 100), 2) + igic_final_base_adjustment
      and tax_amount = line_total - taxable_base
      and line_total = taxable_base + tax_amount)
  )
);

create function public.protect_igic_final_reconciliation_snapshot()
returns trigger language plpgsql set search_path = '' as $$
declare s public.organization_billing_settings%rowtype; a record; v_order_id uuid; expected jsonb;
begin
  if tg_op='UPDATE' and new.igic_final_reconciliation_snapshot is not distinct from old.igic_final_reconciliation_snapshot then return new; end if;
  if new.igic_final_reconciliation_snapshot is null and tg_op='INSERT' then return new; end if;
  if tg_op='INSERT' or old.document_status<>'draft' or old.igic_final_reconciliation_snapshot is not null then
    raise exception 'billing_igic_reconciliation_immutable' using errcode='55000'; end if;
  if auth.uid() is null or new.organization_id is distinct from public.app_current_organization_id()
    or current_setting('app.igic_final_invoice',true) is distinct from old.id::text
    or not public.pos_billing_context_allowed(new.organization_id) then
    raise exception 'billing_igic_reconciliation_not_authorized' using errcode='42501'; end if;
  select * into s from public.organization_billing_settings where organization_id=new.organization_id;
  if s.igic_final_reconciliation_enabled is distinct from true or s.fiscal_territory_code is distinct from 'ES-CN'
    or s.declared_tax_regime_code is distinct from 'IGIC-GENERAL' or s.default_tax_rate<>7
    or old.fiscal_document_type<>'simplified' or old.billing_event_kind<>'service'
    or not old.prices_include_tax or old.currency<>'EUR' then
    raise exception 'billing_igic_reconciliation_scope_invalid' using errcode='22023'; end if;
  select l.order_id into v_order_id from public.invoice_orders l
    where l.organization_id=new.organization_id and l.invoice_id=old.id and l.billing_link_role='final' and l.is_active;
  select sum(i.total) gross,sum(i.taxable_base) base,sum(i.tax_total) tax,
    jsonb_agg(jsonb_build_object('invoice_id',i.id,'invoice_number',i.invoice_number,
      'payment_id',p.payment_id,'total',i.total,'base',i.taxable_base,'tax',i.tax_total) order by i.id) documents
    into a from public.invoice_orders l join public.invoices i on i.organization_id=l.organization_id and i.id=l.invoice_id
    join public.billing_invoice_payment_links p on p.organization_id=l.organization_id and p.invoice_id=l.invoice_id
      and p.order_id=l.order_id and p.billing_link_role='advance'
    where l.organization_id=new.organization_id and l.order_id=v_order_id and l.billing_link_role='advance' and i.document_status='issued';
  expected:=jsonb_build_object('policy','ES-CN-IGIC7-FINAL-DIFF-v1','order_id',v_order_id,
    'operation_total',old.total,'operation_base',old.taxable_base,'operation_tax',old.tax_total,
    'advance_total',a.gross,'advance_base',a.base,'advance_tax',a.tax,
    'unadjusted_final_base',round((old.total-a.gross)/1.07,2),
    'base_adjustment',old.taxable_base-a.base-round((old.total-a.gross)/1.07,2),
    'tax_adjustment',-(old.taxable_base-a.base-round((old.total-a.gross)/1.07,2)),
    'advance_documents',a.documents,'declared_by',auth.uid());
  if v_order_id is null or a.gross is null or new.igic_final_reconciliation_snapshot is distinct from expected
    or old.taxable_base-a.base<=0 or old.tax_total-a.tax<0 then
    raise exception 'billing_igic_reconciliation_review_required' using errcode='22023'; end if;
  return new;
end;
$$;
create trigger invoices_igic_final_reconciliation_guard before insert or update on public.invoices
for each row execute function public.protect_igic_final_reconciliation_snapshot();
revoke all on function public.protect_igic_final_reconciliation_snapshot() from public,anon,authenticated,service_role;

create function public.protect_igic_final_reconciliation_item()
returns trigger language plpgsql set search_path = '' as $$
declare i public.invoices%rowtype; evidence jsonb;
begin
  if new.igic_final_base_adjustment=0 then return new; end if;
  select * into i from public.invoices where organization_id=new.organization_id and id=new.invoice_id;
  evidence:=i.igic_final_reconciliation_snapshot;
  if auth.uid() is null or i.document_status is distinct from 'draft'
    or new.organization_id is distinct from public.app_current_organization_id()
    or current_setting('app.igic_final_invoice',true) is distinct from i.id::text
    or not public.pos_billing_context_allowed(new.organization_id)
    or evidence->>'policy' is distinct from 'ES-CN-IGIC7-FINAL-DIFF-v1'
    or new.igic_final_base_adjustment is distinct from (evidence->>'base_adjustment')::numeric
    or new.taxable_base is distinct from (evidence->>'operation_base')::numeric-(evidence->>'advance_base')::numeric
    or new.tax_amount is distinct from (evidence->>'operation_tax')::numeric-(evidence->>'advance_tax')::numeric
    or new.line_total is distinct from (evidence->>'operation_total')::numeric-(evidence->>'advance_total')::numeric
    or new.quantity<>1 or new.unit_type<>'service' or new.discount_amount<>0 or new.tax_rate<>7
    or not new.prices_include_tax then
    raise exception 'billing_igic_reconciliation_item_invalid' using errcode='22023'; end if;
  return new;
end;
$$;
create trigger invoice_items_igic_final_reconciliation_guard before insert or update on public.invoice_items
for each row execute function public.protect_igic_final_reconciliation_item();
revoke all on function public.protect_igic_final_reconciliation_item() from public,anon,authenticated,service_role;


create or replace function public.pos_billing_issue_final_internal(
  target_final_draft_id uuid, target_balance_payment_id uuid,
  target_service_performed_on date, target_operation_scope text,
  target_recipient_requirement text, target_confirmed boolean
) returns table(invoice_id uuid, invoice_number text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  org_id uuid := public.app_current_organization_id();
  actor_id uuid := auth.uid();
  v_order_id uuid;
  source_order public.orders%rowtype;
  source_customer public.customers%rowtype;
  final_draft public.invoices%rowtype;
  settings public.organization_billing_settings%rowtype;
  balance_payment public.payments%rowtype;
  source_payment public.payments%rowtype;
  tenant_timezone text;
  local_today date;
  tax_rate numeric(7,4);
  rate_count integer;
  item_count integer;
  payment_count integer;
  advance_count integer;
  advance_gross numeric(14,2);
  advance_base numeric(14,2);
  advance_tax numeric(14,2);
  balance_base numeric(14,2);
  balance_tax numeric(14,2);
  service_items jsonb;
  reconciliation jsonb;
  base_adjustment numeric(14,2) := 0;
  advance_documents jsonb;
  next_sequence bigint;
  fiscal_number text;
begin
  if org_id is null or actor_id is null
    or not (public.has_organization_role(org_id,array['owner','manager']::public.app_role[]) or public.pos_billing_context_allowed(org_id))
    or not public.organization_entitlement_is_enabled(org_id,'billing.invoicing',now()) then
    raise exception 'billing_not_authorized' using errcode='42501';
  end if;
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'billing_final_read_committed_required' using errcode='25000';
  end if;
  select l.order_id into v_order_id from public.invoice_orders l
    where l.organization_id=org_id and l.invoice_id=target_final_draft_id
      and l.billing_link_role='final' and l.is_active;
  if v_order_id is null then
    raise exception 'billing_invalid_draft' using errcode='22023';
  end if;
  -- Match C1/refund's payment-first lock order. A fresh READ COMMITTED
  -- statement sees every POS payment/refund committed while waiting.
  for source_payment in select * from public.payments p
    where p.organization_id=org_id and p.order_id=v_order_id
    order by p.id for share loop
    null;
  end loop;
  select * into source_order from public.orders o
    where o.organization_id=org_id and o.id=v_order_id for update;
  select * into final_draft from public.invoices i
    where i.organization_id=org_id and i.id=target_final_draft_id for update;
  if final_draft.id is null or source_order.id is null then
    raise exception 'billing_invalid_draft' using errcode='22023';
  end if;
  -- Committed replay returns only the same final document and same balance
  -- attribution. It never allocates a second number.
  if final_draft.document_status='issued' then
    if final_draft.billing_event_kind='service' and exists(
      select 1 from public.billing_invoice_payment_links l
      where l.organization_id=org_id and l.invoice_id=target_final_draft_id
        and l.order_id=v_order_id and l.payment_id=target_balance_payment_id
        and l.billing_link_role='final') then
      return query select final_draft.id,final_draft.invoice_number; return;
    end if;
    raise exception 'billing_final_already_issued' using errcode='55000';
  end if;
  if target_confirmed is distinct from true
    or target_operation_scope is distinct from 'local_laundry_dry_cleaning'
    or target_recipient_requirement not in ('consumer','consumer_identified','business')
    or target_service_performed_on is null then
    raise exception 'billing_simplified_declaration_required' using errcode='22023';
  end if;
  select * into settings from public.organization_billing_settings s
    where s.organization_id=org_id for share;
  select o.timezone, (now() at time zone o.timezone)::date into tenant_timezone, local_today
    from public.organizations o where o.id=org_id;
  if settings.organization_id is null or not settings.simplified_invoicing_enabled
    or settings.fiscal_territory_code is distinct from 'ES-CN'
    or settings.declared_tax_regime_code is distinct from 'IGIC-GENERAL'
    or settings.issuer_country_code is distinct from 'ES'
    or settings.simplified_series is distinct from final_draft.series
    or nullif(btrim(settings.issuer_legal_name),'') is null
    or nullif(btrim(settings.issuer_tax_id),'') is null
    or nullif(btrim(settings.issuer_address_line1),'') is null
    or nullif(btrim(settings.issuer_city),'') is null
    or nullif(btrim(settings.issuer_postal_code),'') is null then
    raise exception 'billing_simplified_issuance_disabled' using errcode='55000';
  end if;
  if local_today is null or target_service_performed_on>local_today
    or (target_recipient_requirement<>'business' and target_service_performed_on<>local_today)
    or (target_recipient_requirement='business' and local_today >=
      (date_trunc('month',target_service_performed_on::timestamp)
        + interval '1 month 15 days')::date) then
    raise exception 'billing_service_date_review_required' using errcode='22023';
  end if;
  if final_draft.document_status<>'draft'
    or final_draft.fiscal_document_type<>'simplified'
    or final_draft.billing_event_kind<>'service'
    or not final_draft.prices_include_tax or final_draft.currency<>'EUR'
    or final_draft.total<>source_order.total or final_draft.total>3000
    or source_order.production_status in ('draft','cancelled')
    or not source_order.is_active
    or (final_draft.due_date is not null and final_draft.due_date<local_today)
    or (target_recipient_requirement<>'consumer' and
      final_draft.recipient_snapshot_mode<>'identified') then
    raise exception 'billing_invalid_draft' using errcode='22023';
  end if;
  select * into source_customer from public.customers c
    where c.organization_id=org_id and c.id=source_order.customer_id;
  if source_customer.id is null
    or (source_customer.customer_type='business'
      and target_recipient_requirement<>'business') then
    raise exception 'billing_customer_configuration_required' using errcode='22023';
  end if;
  if exists(select 1 from public.invoice_orders l join public.invoices i
      on i.organization_id=l.organization_id and i.id=l.invoice_id
      where l.organization_id=org_id and l.order_id=v_order_id
        and l.invoice_id<>target_final_draft_id
        and (l.billing_link_role<>'advance' or i.document_status<>'issued'
          or i.billing_event_kind<>'advance')) then
    raise exception 'billing_fiscal_history_review_required' using errcode='55000';
  end if;
  select count(*),count(distinct it.tax_rate),min(it.tax_rate)
    into item_count,rate_count,tax_rate from public.invoice_items it
    where it.organization_id=org_id and it.invoice_id=target_final_draft_id;
  if item_count<1 or rate_count<>1 or tax_rate<>7 or settings.default_tax_rate<>7
    or exists(select 1 from public.invoice_items it
      where it.organization_id=org_id and it.invoice_id=target_final_draft_id
        and (not it.prices_include_tax or it.source_order_id is distinct from v_order_id))
    or (select coalesce(sum(it.line_total),0) from public.invoice_items it
      where it.organization_id=org_id and it.invoice_id=target_final_draft_id)<>final_draft.total
    or (select coalesce(sum(it.taxable_base),0) from public.invoice_items it
      where it.organization_id=org_id and it.invoice_id=target_final_draft_id)<>final_draft.taxable_base
    or (select coalesce(sum(it.tax_amount),0) from public.invoice_items it
      where it.organization_id=org_id and it.invoice_id=target_final_draft_id)<>final_draft.tax_total then
    raise exception 'billing_exact_reconciliation_required' using errcode='22023';
  end if;
  select * into balance_payment from public.payments p
    where p.organization_id=org_id and p.order_id=v_order_id
      and p.id=target_balance_payment_id;
  if balance_payment.id is null or balance_payment.status<>'confirmed'
    or balance_payment.channel<>'pos' or balance_payment.pos_session_id is null
    or balance_payment.refunded_from_payment_id is not null
    or exists(select 1 from public.billing_invoice_payment_links l
      where l.organization_id=org_id and l.payment_id=balance_payment.id) then
    raise exception 'billing_final_invalid_payment' using errcode='22023';
  end if;
  select count(*) into payment_count from public.payments p
    where p.organization_id=org_id and p.order_id=v_order_id and p.status<>'void';
  if exists(select 1 from public.payments p
      where p.organization_id=org_id and p.order_id=v_order_id
        and p.status<>'void' and (p.status<>'confirmed' or p.channel<>'pos'
          or p.pos_session_id is null or p.refunded_from_payment_id is not null
          or exists(select 1 from public.payments r where r.organization_id=org_id
            and r.refunded_from_payment_id=p.id and r.status='refunded')))
    or exists(select 1 from public.billing_advance_event_declarations d
      where d.organization_id=org_id and d.order_id=v_order_id
        and d.payment_id=target_balance_payment_id) then
    raise exception 'billing_final_payment_history_review_required' using errcode='55000';
  end if;
  select count(*),coalesce(sum(i.total),0),coalesce(sum(i.taxable_base),0),
    coalesce(sum(i.tax_total),0)
    into advance_count,advance_gross,advance_base,advance_tax
    from public.invoice_orders l join public.invoices i
      on i.organization_id=l.organization_id and i.id=l.invoice_id
    where l.organization_id=org_id and l.order_id=v_order_id
      and l.billing_link_role='advance' and i.document_status='issued';
  if advance_count<1 or payment_count<>advance_count+1
    or exists(select 1 from public.invoice_orders l join public.invoices i
      on i.organization_id=l.organization_id and i.id=l.invoice_id
      left join public.billing_invoice_payment_links pl
        on pl.organization_id=l.organization_id and pl.invoice_id=l.invoice_id
        and pl.order_id=l.order_id and pl.billing_link_role='advance'
      left join public.billing_advance_event_declarations d
        on d.organization_id=l.organization_id and d.order_id=l.order_id
        and d.payment_id=pl.payment_id
      left join public.payments p
        on p.organization_id=l.organization_id and p.order_id=l.order_id
        and p.id=pl.payment_id
      where l.organization_id=org_id and l.order_id=v_order_id
        and l.billing_link_role='advance' and (i.document_status<>'issued'
          or i.billing_event_kind<>'advance' or pl.payment_id is null
          or i.advance_operation_scope is distinct from target_operation_scope
          or i.advance_recipient_requirement is distinct from target_recipient_requirement
          or d.payment_id is null or p.status<>'confirmed'
          or pl.attributed_amount<>p.amount or i.total<>p.amount
          or i.taxable_base<>round(i.total/(1+tax_rate/100),2)
          or i.tax_total<>i.total-i.taxable_base
          or i.recipient_snapshot_mode<>final_draft.recipient_snapshot_mode
          or i.customer_id is distinct from final_draft.customer_id
          or i.customer_name is distinct from final_draft.customer_name
          or i.customer_tax_id is distinct from final_draft.customer_tax_id))
    or advance_gross+balance_payment.amount<>final_draft.total then
    raise exception 'billing_final_payment_links_invalid' using errcode='22023';
  end if;
  -- Compare canonical collection dates, never production/logistics timestamps.
  -- Same-day events remain valid: a DATE cannot establish their intraday order.
  if exists (select 1 from public.invoice_orders l
    join public.billing_invoice_payment_links pl
      on pl.organization_id=l.organization_id and pl.invoice_id=l.invoice_id
        and pl.order_id=l.order_id and pl.billing_link_role='advance'
    join public.billing_advance_event_declarations d
      on d.organization_id=pl.organization_id and d.order_id=pl.order_id
        and d.payment_id=pl.payment_id
    where l.organization_id=org_id and l.order_id=v_order_id
      and l.billing_link_role='advance'
      and (d.payment_paid_at at time zone tenant_timezone)::date > target_service_performed_on) then
    raise exception 'billing_service_date_before_advance' using errcode='22023';
  end if;
  balance_base:=round(balance_payment.amount/(1+tax_rate/100),2);
  balance_tax:=balance_payment.amount-balance_base;
  if settings.igic_final_reconciliation_enabled then
    -- Preserve the canonical operation snapshot and issued advance components.
    -- This is a residual fiscal quota, not a new standalone 7% service.
    if exists(select 1 from public.invoice_orders l join public.invoices i
      on i.organization_id=l.organization_id and i.id=l.invoice_id
      where l.organization_id=org_id and l.order_id=v_order_id and l.billing_link_role='advance'
        and (i.currency<>'EUR' or not i.prices_include_tax or not exists(
          select 1 from public.invoice_items x where x.organization_id=i.organization_id and x.invoice_id=i.id
          having count(*)>0 and count(distinct x.tax_rate)=1 and min(x.tax_rate)=7
            and bool_and(x.prices_include_tax) and sum(x.taxable_base)=i.taxable_base
            and sum(x.tax_amount)=i.tax_total and sum(x.line_total)=i.total))) then
      raise exception 'billing_igic_reconciliation_scope_invalid' using errcode='22023';
    end if;
    balance_base:=final_draft.taxable_base-advance_base;
    balance_tax:=final_draft.tax_total-advance_tax;
    base_adjustment:=balance_base-round(balance_payment.amount/(1+tax_rate/100),2);
    if balance_base<=0 or balance_tax<0
      or advance_base+balance_base<>final_draft.taxable_base
      or advance_tax+balance_tax<>final_draft.tax_total then
      raise exception 'billing_igic_reconciliation_review_required' using errcode='22023';
    end if;
    select jsonb_agg(jsonb_build_object('invoice_id',i.id,'invoice_number',i.invoice_number,
      'payment_id',p.payment_id,'total',i.total,'base',i.taxable_base,'tax',i.tax_total) order by i.id)
      into advance_documents from public.invoice_orders l join public.invoices i
      on i.organization_id=l.organization_id and i.id=l.invoice_id
      join public.billing_invoice_payment_links p on p.organization_id=l.organization_id and p.invoice_id=l.invoice_id
        and p.order_id=l.order_id and p.billing_link_role='advance'
      where l.organization_id=org_id and l.order_id=v_order_id and l.billing_link_role='advance' and i.document_status='issued';
    reconciliation:=jsonb_build_object('policy','ES-CN-IGIC7-FINAL-DIFF-v1','order_id',v_order_id,
      'operation_total',final_draft.total,'operation_base',final_draft.taxable_base,'operation_tax',final_draft.tax_total,
      'advance_total',advance_gross,'advance_base',advance_base,'advance_tax',advance_tax,
      'unadjusted_final_base',round(balance_payment.amount/(1+tax_rate/100),2),
      'base_adjustment',base_adjustment,'tax_adjustment',-base_adjustment,
      'advance_documents',advance_documents,'declared_by',actor_id);
  end if;
  if advance_gross+balance_payment.amount<>final_draft.total
    or advance_base+advance_tax<>advance_gross
    or balance_base+balance_tax<>balance_payment.amount then
    raise exception 'billing_exact_reconciliation_required' using errcode='22023';
  end if;
  -- The commercial operation snapshot retains its original line descriptions,
  -- quantities, prices and canonical full-order taxes. With the pilot policy,
  -- final quotas deduct immutable advances; otherwise retain historical rounding.
  select jsonb_agg(jsonb_build_object('description',it.description,
    'unit_type',it.unit_type,'quantity',it.quantity,'unit_price',it.unit_price,
    'line_subtotal',it.line_subtotal,'discount_amount',it.discount_amount,
    'taxable_base',it.taxable_base,'tax_rate',it.tax_rate,
    'tax_amount',it.tax_amount,'line_total',it.line_total)
    order by it.display_order,it.id) into service_items
    from public.invoice_items it where it.organization_id=org_id
      and it.invoice_id=target_final_draft_id;
  perform set_config('app.billing_mutation','on',true);
  perform set_config('app.billing_advance_link_mutation','on',true);
  if reconciliation is not null then
    perform set_config('app.igic_final_invoice',target_final_draft_id::text,true);
    update public.invoices set igic_final_reconciliation_snapshot=reconciliation
      where organization_id=org_id and id=target_final_draft_id;
  end if;
  delete from public.invoice_items it where it.organization_id=org_id
    and it.invoice_id=target_final_draft_id;
  insert into public.invoice_items(organization_id,invoice_id,description,
    unit_type,quantity,unit_price,line_subtotal,discount_amount,taxable_base,
    tax_rate,tax_amount,line_total,prices_include_tax,igic_final_base_adjustment)
    values(org_id,target_final_draft_id,'Saldo · '||source_order.order_number,
      'service',1,balance_payment.amount,balance_payment.amount,0,
      balance_base,tax_rate,balance_tax,balance_payment.amount,true,base_adjustment);
  update public.invoices set subtotal=balance_payment.amount,discount_total=0,
    taxable_base=balance_base,tax_total=balance_tax,total=balance_payment.amount,
    updated_by=actor_id where organization_id=org_id and id=target_final_draft_id;
  insert into public.billing_invoice_payment_links
    (organization_id,order_id,invoice_id,billing_link_role,payment_id,attributed_amount)
    values(org_id,v_order_id,target_final_draft_id,'final',
      balance_payment.id,balance_payment.amount);
  insert into public.billing_invoice_number_counters
    (organization_id,series,fiscal_document_type,next_value)
    values(org_id,final_draft.series,'simplified',2)
    on conflict(organization_id,series) do update set
      next_value=public.billing_invoice_number_counters.next_value+1,updated_at=now()
    returning next_value-1 into next_sequence;
  fiscal_number:=extract(year from local_today)::integer::text||'-'||final_draft.series||'-'
    ||lpad(next_sequence::text,greatest(6,length(next_sequence::text)),'0');
  perform set_config('app.billing_simplified_service_issue','on',true);
  update public.invoices set pos_billing_order_snapshot=current_setting('app.pos_billing_snapshot',true)::jsonb,
    document_status='issued',invoice_number=fiscal_number,
    sequence_number=next_sequence,issue_date=local_today,issued_at=now(),
    issuer_legal_name=settings.issuer_legal_name,issuer_tax_id=settings.issuer_tax_id,
    issuer_address_line1=settings.issuer_address_line1,
    issuer_address_line2=settings.issuer_address_line2,
    issuer_city=settings.issuer_city,issuer_region=settings.issuer_region,
    issuer_postal_code=settings.issuer_postal_code,
    issuer_country_code=settings.issuer_country_code,
    issuer_email=settings.issuer_email,issuer_phone=settings.issuer_phone,
    operation_total=final_draft.total,
    operation_taxable_base=final_draft.taxable_base,
    operation_tax_total=final_draft.tax_total,
    documented_advance_total=advance_gross,
    documented_advance_taxable_base=advance_base,
    documented_advance_tax_total=advance_tax,
    operation_rounding_base_delta=advance_base+balance_base-final_draft.taxable_base,
    operation_items_snapshot=service_items,
    service_performed_on=target_service_performed_on,
    service_operation_scope=target_operation_scope,
    fiscal_recipient_requirement=target_recipient_requirement,
    service_declared_by=actor_id,service_declared_at=now(),updated_by=actor_id
    where organization_id=org_id and id=target_final_draft_id;
  perform set_config('app.billing_final_link_mutation','on',true);
  update public.invoice_orders set final_invoice_id=target_final_draft_id
    where organization_id=org_id and order_id=v_order_id
      and billing_link_role='advance' and final_invoice_id is null;
  perform set_config('app.igic_final_invoice','',true);
  return query select target_final_draft_id,fiscal_number;
end;
$$;
revoke all on function public.pos_billing_issue_final_internal(uuid,uuid,date,text,text,boolean) from public,anon,authenticated,service_role;
commit;
