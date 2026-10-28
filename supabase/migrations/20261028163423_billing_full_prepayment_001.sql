-- BILLING-FULL-PREPAYMENT-001: local technical verification only.
-- No fiscal production authorization; no historical rows are changed.
begin;
set local lock_timeout = '5s';

create or replace function public.protect_billing_service_declaration()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.document_status <> 'draft' and (
    new.service_performed_on is distinct from old.service_performed_on
    or new.service_operation_scope is distinct from old.service_operation_scope
    or new.fiscal_recipient_requirement is distinct from old.fiscal_recipient_requirement
    or new.service_declared_by is distinct from old.service_declared_by
    or new.service_declared_at is distinct from old.service_declared_at) then
    raise exception 'billing_issued_snapshot_immutable' using errcode = '55000';
  end if;
  if new.fiscal_document_type = 'simplified' and new.document_status <> 'draft'
    and (tg_op = 'INSERT' or old.document_status = 'draft') then
    if (new.billing_event_kind = 'advance' and
         current_setting('app.billing_advance_issue',true) is distinct from 'on')
      or (new.billing_event_kind = 'service' and
         (current_setting('app.billing_simplified_service_issue',true) is distinct from 'on'
          or new.service_declared_by is distinct from auth.uid()))
      or not public.has_organization_role(new.organization_id,
        array['owner','manager']::public.app_role[])
      or not public.organization_entitlement_is_enabled(new.organization_id,'billing.invoicing',now())
      or not exists (select 1 from public.organization_billing_settings s
        where s.organization_id = new.organization_id and s.simplified_invoicing_enabled
          and s.fiscal_territory_code = 'ES-CN'
          and s.declared_tax_regime_code = 'IGIC-GENERAL'
          and s.issuer_country_code = 'ES' and s.simplified_series = new.series) then
      raise exception 'billing_simplified_issuance_disabled' using errcode = '55000';
    end if;
  end if;
  if new.billing_event_kind='advance' and new.document_status='issued'
    and (tg_op='INSERT' or old.document_status='draft')
    and exists(select 1 from public.invoice_orders l
      where l.organization_id=new.organization_id and l.invoice_id=new.id
        and l.billing_link_role='final') then
    if not exists(select 1 from public.invoice_orders l
      join public.billing_invoice_payment_links pl
        on pl.organization_id=l.organization_id and pl.invoice_id=l.invoice_id
        and pl.order_id=l.order_id and pl.billing_link_role=l.billing_link_role
      join public.billing_advance_event_declarations d
        on d.organization_id=pl.organization_id and d.order_id=pl.order_id
        and d.payment_id=pl.payment_id
      where l.organization_id=new.organization_id and l.invoice_id=new.id
        and l.billing_link_role='final' and l.is_active
        and pl.attributed_amount=new.total and d.payment_amount=new.total
        and d.service_not_performed_confirmed)
      or (select count(*) from public.billing_invoice_payment_links pl
        where pl.organization_id=new.organization_id and pl.invoice_id=new.id)<>1 then
      raise exception 'billing_advance_full_attribution_required' using errcode='22023';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.issue_billing_advance_invoice(target_final_draft_id uuid,
  target_payment_id uuid, target_operation_scope text,
  target_recipient_requirement text, target_confirmed boolean)
returns table(invoice_id uuid, invoice_number text)
language plpgsql security definer set search_path = public as $$
declare
  org_id uuid := public.app_current_organization_id();
  actor_id uuid := auth.uid();
  v_order_id uuid;
  payment_row public.payments%rowtype;
  order_row public.orders%rowtype;
  source_customer public.customers%rowtype;
  full_draft public.invoices%rowtype;
  settings public.organization_billing_settings%rowtype;
  prior_link public.billing_invoice_payment_links%rowtype;
  declaration public.billing_advance_event_declarations%rowtype;
  rate numeric(7,4);
  rates integer;
  advance_id uuid;
  base_amount numeric(14,2);
  local_today date;
  next_sequence bigint;
  fiscal_number text;
begin
  if org_id is null or actor_id is null
    or not public.has_organization_role(org_id,array['owner','manager']::public.app_role[])
    or not public.organization_entitlement_is_enabled(org_id,'billing.invoicing',now()) then
    raise exception 'billing_not_authorized' using errcode = '42501';
  end if;
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'billing_advance_read_committed_required' using errcode = '25000';
  end if;
  select l.order_id into v_order_id from public.invoice_orders l
    where l.organization_id=org_id and l.invoice_id=target_final_draft_id
      and l.billing_link_role='final' and l.is_active;
  if v_order_id is null then
    raise exception 'billing_invalid_draft' using errcode = '22023';
  end if;
  -- Refund takes source payment before its refund-row FK touches the order.
  select * into payment_row from public.payments p
    where p.organization_id=org_id and p.order_id=v_order_id and p.id=target_payment_id
    for share;
  select * into order_row from public.orders o
    where o.organization_id=org_id and o.id=v_order_id for update;
  select * into full_draft from public.invoices i
    where i.organization_id=org_id and i.id=target_final_draft_id for update;
  if full_draft.id is null then
    raise exception 'billing_invalid_draft' using errcode = '22023';
  end if;
  select * into prior_link from public.billing_invoice_payment_links l
    where l.organization_id=org_id and l.payment_id=target_payment_id;
  if prior_link.payment_id is not null then
    if prior_link.order_id<>v_order_id or (prior_link.billing_link_role<>'advance' and not
        (prior_link.billing_link_role='final' and prior_link.invoice_id=target_final_draft_id
          and prior_link.attributed_amount=full_draft.total))
      or not exists(select 1 from public.invoices i where i.organization_id=org_id
        and i.id=prior_link.invoice_id and i.document_status='issued'
        and i.billing_event_kind='advance') then
      raise exception 'billing_advance_payment_already_attributed' using errcode = '23505';
    end if;
    return query select i.id,i.invoice_number from public.invoices i
      where i.organization_id=org_id and i.id=prior_link.invoice_id;
    return;
  end if;
  if target_confirmed is distinct from true
    or target_operation_scope is distinct from 'local_laundry_dry_cleaning'
    or target_recipient_requirement is null
    or target_recipient_requirement not in ('consumer','consumer_identified','business') then
    raise exception 'billing_simplified_declaration_required' using errcode='22023';
  end if;
  if payment_row.id is null or payment_row.status<>'confirmed'
    or payment_row.channel<>'pos' or payment_row.pos_session_id is null
    or payment_row.refunded_from_payment_id is not null
    or exists(select 1 from public.payments r where r.organization_id=org_id
      and r.refunded_from_payment_id=target_payment_id and r.status='refunded')
    or exists(select 1 from public.payments p where p.organization_id=org_id
      and p.order_id=v_order_id and p.status in ('pending','refunded')) then
    raise exception 'billing_advance_invalid_payment' using errcode = '22023';
  end if;
  select * into declaration from public.billing_advance_event_declarations d
    where d.organization_id=org_id and d.order_id=v_order_id and d.payment_id=target_payment_id;
  if declaration.payment_id is null or declaration.payment_amount<>payment_row.amount
    or declaration.payment_paid_at<>payment_row.paid_at then
    raise exception 'billing_advance_declaration_required' using errcode = '22023';
  end if;
  select (now() at time zone o.timezone)::date into local_today
    from public.organizations o where o.id=org_id;
  if local_today is null
    or (payment_row.paid_at at time zone (select timezone from public.organizations where id=org_id))::date<>local_today then
    raise exception 'billing_advance_date_review_required' using errcode = '22023';
  end if;
  select * into settings from public.organization_billing_settings s
    where s.organization_id=org_id for share;
  if settings.organization_id is null or not settings.simplified_invoicing_enabled
    or settings.fiscal_territory_code is distinct from 'ES-CN'
    or settings.declared_tax_regime_code is distinct from 'IGIC-GENERAL'
    or settings.issuer_country_code is distinct from 'ES'
    or settings.simplified_series is null or settings.simplified_series<>full_draft.series
    or nullif(btrim(settings.issuer_legal_name),'') is null
    or nullif(btrim(settings.issuer_tax_id),'') is null
    or nullif(btrim(settings.issuer_address_line1),'') is null
    or nullif(btrim(settings.issuer_city),'') is null
    or nullif(btrim(settings.issuer_postal_code),'') is null then
    raise exception 'billing_simplified_issuance_disabled' using errcode = '55000';
  end if;
  if full_draft.document_status<>'draft' or full_draft.fiscal_document_type<>'simplified'
    or full_draft.billing_event_kind<>'service' or not full_draft.prices_include_tax
    or full_draft.currency<>'EUR' or full_draft.total<>order_row.total
    or full_draft.total>3000 or order_row.production_status in ('draft','cancelled')
    or not order_row.is_active or payment_row.amount>full_draft.total then
    raise exception 'billing_invalid_draft' using errcode = '22023';
  end if;
  select * into source_customer from public.customers c
    where c.organization_id=org_id and c.id=order_row.customer_id;
  if source_customer.id is null
    or (source_customer.customer_type='business'
      and target_recipient_requirement<>'business')
    or (target_recipient_requirement<>'consumer'
      and full_draft.recipient_snapshot_mode<>'identified') then
    raise exception 'billing_customer_configuration_required' using errcode='22023';
  end if;
  if exists(select 1 from public.invoice_orders l join public.invoices i
      on i.organization_id=l.organization_id and i.id=l.invoice_id
      where l.organization_id=org_id and l.order_id=v_order_id
        and l.invoice_id<>target_final_draft_id
        and (l.billing_link_role<>'advance' or i.document_status<>'issued'
          or i.billing_event_kind<>'advance')) then
    raise exception 'billing_fiscal_history_review_required' using errcode = '55000';
  end if;
  select min(it.tax_rate),count(distinct it.tax_rate) into rate,rates
    from public.invoice_items it where it.organization_id=org_id
      and it.invoice_id=target_final_draft_id;
  -- Full prepayment consumes the original draft. The final link reserves
  -- the order; billing_event_kind records the pre-service fiscal event.
  if payment_row.amount=full_draft.total then
    if payment_row.amount<=0
      or declaration.service_not_performed_confirmed is distinct from true
      or exists(select 1 from public.payments p where p.organization_id=org_id
        and p.order_id=v_order_id and p.id<>target_payment_id and p.status<>'void')
      or exists(select 1 from public.billing_invoice_payment_links l
        where l.organization_id=org_id and l.order_id=v_order_id)
      or exists(select 1 from public.invoice_orders l where l.organization_id=org_id
        and l.order_id=v_order_id and l.invoice_id<>target_final_draft_id)
      or (select count(*) from public.invoice_orders l where l.organization_id=org_id
        and l.invoice_id=target_final_draft_id)<>1 then
      raise exception 'billing_advance_full_history_review_required' using errcode='22023';
    end if;
    if rates<>1 or rate is null or rate<>7 or settings.default_tax_rate<>7
      or full_draft.taxable_base<>round(full_draft.total/(1+rate/100),2)
      or full_draft.tax_total<>full_draft.total-full_draft.taxable_base
      or exists(select 1 from public.invoice_items it where it.organization_id=org_id
        and it.invoice_id=target_final_draft_id
        and (not it.prices_include_tax or it.source_order_id is distinct from v_order_id))
      or (select sum(it.line_total) from public.invoice_items it
        where it.organization_id=org_id and it.invoice_id=target_final_draft_id) is distinct from full_draft.total
      or (select sum(it.taxable_base) from public.invoice_items it
        where it.organization_id=org_id and it.invoice_id=target_final_draft_id) is distinct from full_draft.taxable_base
      or (select sum(it.tax_amount) from public.invoice_items it
        where it.organization_id=org_id and it.invoice_id=target_final_draft_id) is distinct from full_draft.tax_total then
      raise exception 'billing_advance_full_reconciliation_required' using errcode='22023';
    end if;
    perform set_config('app.billing_mutation','on',true);
    perform set_config('app.billing_advance_issue','on',true);
    perform set_config('app.billing_advance_link_mutation','on',true);
    insert into public.billing_invoice_payment_links
      (organization_id,order_id,invoice_id,billing_link_role,payment_id,attributed_amount)
      values(org_id,v_order_id,target_final_draft_id,'final',target_payment_id,payment_row.amount);
    insert into public.billing_invoice_number_counters
      (organization_id,series,fiscal_document_type,next_value)
      values(org_id,full_draft.series,'simplified',2)
      on conflict(organization_id,series) do update set
        next_value=public.billing_invoice_number_counters.next_value+1,updated_at=now()
      returning next_value-1 into next_sequence;
    fiscal_number:=extract(year from local_today)::integer::text||'-'||full_draft.series||'-'
      ||lpad(next_sequence::text,greatest(6,length(next_sequence::text)),'0');
    -- Preserve every original item and monetary amount. Do not declare service.
    update public.invoices set document_status='issued',billing_event_kind='advance',
      issue_date=local_today,issued_at=now(),invoice_number=fiscal_number,
      sequence_number=next_sequence,updated_by=actor_id,
      issuer_legal_name=settings.issuer_legal_name,issuer_tax_id=settings.issuer_tax_id,
      issuer_address_line1=settings.issuer_address_line1,
      issuer_address_line2=settings.issuer_address_line2,
      issuer_city=settings.issuer_city,issuer_region=settings.issuer_region,
      issuer_postal_code=settings.issuer_postal_code,
      issuer_country_code=settings.issuer_country_code,
      issuer_email=settings.issuer_email,issuer_phone=settings.issuer_phone,
      advance_operation_scope=target_operation_scope,
      advance_recipient_requirement=target_recipient_requirement,
      advance_declared_by=actor_id,advance_declared_at=now()
      where organization_id=org_id and id=target_final_draft_id;
    return query select target_final_draft_id,fiscal_number;
    return;
  end if;
  if rates<>1 or rate is null or rate<>7 or settings.default_tax_rate<>7
    or exists(select 1 from public.invoice_items it where it.organization_id=org_id
      and it.invoice_id=target_final_draft_id
      and (not it.prices_include_tax or it.source_order_id is distinct from v_order_id))
    or payment_row.amount+(select coalesce(sum(i.total),0) from public.invoice_orders l
      join public.invoices i on i.organization_id=l.organization_id and i.id=l.invoice_id
      where l.organization_id=org_id and l.order_id=v_order_id
        and l.billing_link_role='advance' and i.document_status='issued')>=full_draft.total then
    raise exception 'billing_exact_reconciliation_required' using errcode = '22023';
  end if;
  base_amount:=round(payment_row.amount/(1+rate/100),2);
  perform set_config('app.billing_mutation','on',true);
  perform set_config('app.billing_advance_issue','on',true);
  insert into public.invoices(organization_id,customer_id,series,currency,
    fiscal_document_type,recipient_snapshot_mode,prices_include_tax,
    customer_name,customer_tax_id,customer_address_line1,customer_address_line2,
    customer_city,customer_postal_code,customer_country_code,customer_email,
    issuer_legal_name,issuer_tax_id,issuer_address_line1,issuer_address_line2,
    issuer_city,issuer_region,issuer_postal_code,issuer_country_code,
    issuer_email,issuer_phone,issuer_logo_path,created_by,updated_by)
  values(org_id,full_draft.customer_id,full_draft.series,full_draft.currency,
    'simplified',full_draft.recipient_snapshot_mode,true,
    full_draft.customer_name,full_draft.customer_tax_id,full_draft.customer_address_line1,
    full_draft.customer_address_line2,full_draft.customer_city,
    full_draft.customer_postal_code,full_draft.customer_country_code,full_draft.customer_email,
    settings.issuer_legal_name,settings.issuer_tax_id,settings.issuer_address_line1,
    settings.issuer_address_line2,settings.issuer_city,settings.issuer_region,
    settings.issuer_postal_code,settings.issuer_country_code,settings.issuer_email,
    settings.issuer_phone,full_draft.issuer_logo_path,actor_id,actor_id)
  returning id into advance_id;
  insert into public.invoice_orders(organization_id,invoice_id,order_id,billing_link_role)
    values(org_id,advance_id,v_order_id,'advance');
  insert into public.invoice_items(organization_id,invoice_id,description,unit_type,
    quantity,unit_price,line_subtotal,discount_amount,taxable_base,tax_rate,
    tax_amount,line_total,prices_include_tax)
    values(org_id,advance_id,'Anticipo · '||order_row.order_number,'service',
      1,payment_row.amount,payment_row.amount,0,base_amount,rate,
      payment_row.amount-base_amount,payment_row.amount,true);
  update public.invoices set subtotal=payment_row.amount,taxable_base=base_amount,
    tax_total=payment_row.amount-base_amount,total=payment_row.amount
    where organization_id=org_id and id=advance_id;
  perform set_config('app.billing_advance_link_mutation','on',true);
  insert into public.billing_invoice_payment_links
    (organization_id,order_id,invoice_id,billing_link_role,payment_id,attributed_amount)
    values(org_id,v_order_id,advance_id,'advance',payment_row.id,payment_row.amount);
  insert into public.billing_invoice_number_counters
    (organization_id,series,fiscal_document_type,next_value)
    values(org_id,full_draft.series,'simplified',2)
    on conflict(organization_id,series) do update set
      next_value=public.billing_invoice_number_counters.next_value+1,updated_at=now()
    returning next_value-1 into next_sequence;
  fiscal_number:=extract(year from local_today)::integer::text||'-'||full_draft.series||'-'
    ||lpad(next_sequence::text,greatest(6,length(next_sequence::text)),'0');
  update public.invoices set document_status='issued',billing_event_kind='advance',
    issue_date=local_today,issued_at=now(),invoice_number=fiscal_number,
    sequence_number=next_sequence,updated_by=actor_id,
    advance_operation_scope=target_operation_scope,
    advance_recipient_requirement=target_recipient_requirement,
    advance_declared_by=actor_id,advance_declared_at=now()
    where organization_id=org_id and id=advance_id;
  return query select advance_id,fiscal_number;
end;
$$;
revoke all on function public.issue_billing_advance_invoice(uuid,uuid,text,text,boolean)
  from public,anon,authenticated;
grant execute on function public.issue_billing_advance_invoice(uuid,uuid,text,text,boolean)
  to authenticated;
commit;
