-- Local forward-only proposal. No historical backfill or remote application.
-- Evidence of an explicit operator statement, not proof of physical execution.
begin;
set local lock_timeout = '5s';

create table public.billing_postservice_payment_evidence (
  organization_id uuid not null,
  order_id uuid not null,
  payment_id uuid not null,
  completion_history_id uuid not null references public.order_status_history(id) on delete restrict,
  service_performed_on date not null,
  declaration_timing text not null check (declaration_timing in ('contemporaneous','retrospective')),
  declared_by uuid not null references public.profiles(id) on delete restrict,
  declared_at timestamptz not null,
  primary key (organization_id,payment_id),
  foreign key (organization_id,order_id,payment_id)
    references public.payments(organization_id,order_id,id) on delete restrict
);

create function public.protect_billing_postservice_evidence()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'billing_postservice_evidence_immutable' using errcode='55000';
  end if;
  if current_setting('app.billing_postservice_capture',true) is distinct from 'on'
    or new.organization_id is distinct from public.app_current_organization_id()
    or new.declared_by is distinct from auth.uid()
    or not exists(select 1 from public.order_status_history h
      where h.id=new.completion_history_id and h.organization_id=new.organization_id
        and h.order_id=new.order_id and h.to_status='completed') then
    raise exception 'billing_postservice_evidence_not_authorized' using errcode='42501';
  end if;
  new.declared_at := clock_timestamp();
  return new;
end;
$$;
create trigger billing_postservice_evidence_guard
before insert or update or delete on public.billing_postservice_payment_evidence
for each row execute function public.protect_billing_postservice_evidence();
revoke all on function public.protect_billing_postservice_evidence() from public,anon,authenticated;
alter table public.billing_postservice_payment_evidence enable row level security;
create policy billing_postservice_evidence_management
on public.billing_postservice_payment_evidence for select to authenticated
using (public.billing_can_read_advance_event_declaration(organization_id));
revoke all on public.billing_postservice_payment_evidence from public,anon,authenticated,service_role;
grant select on public.billing_postservice_payment_evidence to authenticated;

-- Opt-in wrapper around the unchanged canonical POS writer. No separate payment
-- write path. A failed evidence check rolls the payment back in this transaction.
create function public.record_pos_postservice_payment(
  target_order_id uuid, target_amount numeric, target_method public.payment_method,
  target_pos_session_id uuid, target_reference text, target_notes text,
  target_idempotency_key uuid, target_confirmed boolean,
  target_provider text default null, target_provider_reference text default null,
  target_external_status text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  org_id uuid := public.app_current_organization_id();
  source_order public.orders%rowtype;
  existing_payment uuid;
  event_id uuid;
  event_count bigint;
  result_id uuid;
  local_today date;
  old_evidence public.billing_postservice_payment_evidence%rowtype;
begin
  perform public.require_pos_access(org_id);
  if target_confirmed is distinct from true then
    raise exception 'billing_postservice_confirmation_required' using errcode='22023';
  end if;
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'billing_postservice_read_committed_required' using errcode='25000';
  end if;
  -- Same lock order as record_pos_payment: session, then order. Nothing is issued.
  perform 1 from public.pos_sessions s where s.organization_id=org_id
    and s.id=target_pos_session_id for update;
  select * into source_order from public.orders o
    where o.organization_id=org_id and o.id=target_order_id for update;
  if source_order.id is null then
    raise exception 'billing_postservice_order_invalid' using errcode='22023';
  end if;
  select p.id into existing_payment from public.payments p
    where p.organization_id=org_id and p.idempotency_key=target_idempotency_key;
  if existing_payment is not null then
    select * into old_evidence from public.billing_postservice_payment_evidence e
      where e.organization_id=org_id and e.payment_id=existing_payment;
    if old_evidence.payment_id is null or old_evidence.order_id<>target_order_id
      or old_evidence.declared_by<>auth.uid()
      or old_evidence.declaration_timing<>'contemporaneous' then
      raise exception 'billing_postservice_historical_payment_review_required' using errcode='55000';
    end if;
    -- Canonical writer validates the full replay payload; never add late evidence.
    return public.record_pos_payment(target_order_id,target_amount,target_method,
      target_pos_session_id,target_reference,target_notes,target_idempotency_key,
      target_provider,target_provider_reference,target_external_status);
  end if;
  select (clock_timestamp() at time zone o.timezone)::date into local_today
    from public.organizations o where o.id=org_id;
  select count(*),min(h.id::text)::uuid into event_count,event_id
    from public.order_status_history h where h.organization_id=org_id
      and h.order_id=target_order_id and h.to_status='completed';
  if source_order.production_status<>'completed' or event_count<>1
    or source_order.completed_at is null or local_today is null
    or (source_order.completed_at at time zone
      (select o.timezone from public.organizations o where o.id=org_id))::date<>local_today
    or not exists(select 1 from public.order_status_history h where h.id=event_id
      and h.changed_at=source_order.completed_at)
    or exists(select 1 from public.payments p where p.organization_id=org_id
      and p.order_id=target_order_id and p.status<>'void')
    or exists(select 1 from public.billing_advance_event_declarations d
      where d.organization_id=org_id and d.order_id=target_order_id)
    or exists(select 1 from public.invoice_orders l join public.invoices i
      on i.organization_id=l.organization_id and i.id=l.invoice_id
      where l.organization_id=org_id and l.order_id=target_order_id
        and (i.document_status<>'draft' or l.billing_link_role<>'final')) then
    raise exception 'billing_postservice_history_review_required' using errcode='55000';
  end if;
  result_id := public.record_pos_payment(target_order_id,target_amount,target_method,
    target_pos_session_id,target_reference,target_notes,target_idempotency_key,
    target_provider,target_provider_reference,target_external_status);
  perform set_config('app.billing_postservice_capture','on',true);
  insert into public.billing_postservice_payment_evidence
    (organization_id,order_id,payment_id,completion_history_id,service_performed_on,
      declaration_timing,declared_by,declared_at)
    values(org_id,target_order_id,result_id,event_id,local_today,
      'contemporaneous',auth.uid(),clock_timestamp());
  perform set_config('app.billing_postservice_capture','off',true);
  return result_id;
end;
$$;
revoke all on function public.record_pos_postservice_payment(uuid,numeric,public.payment_method,uuid,text,text,uuid,boolean,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.record_pos_postservice_payment(uuid,numeric,public.payment_method,uuid,text,text,uuid,boolean,text,text,text) to authenticated;

create or replace function public.issue_billing_invoice(
  target_invoice_id uuid, target_service_performed_on date,
  target_operation_scope text, target_recipient_requirement text, target_confirmed boolean
) returns table(invoice_id uuid, invoice_number text)
language plpgsql security definer set search_path = public as $$
declare
  org_id uuid := public.app_current_organization_id();
  actor_id uuid := auth.uid();
  inv public.invoices%rowtype;
  settings public.organization_billing_settings%rowtype;
  source_order public.orders%rowtype;
  source_customer public.customers%rowtype;
  today date;
  totals record;
  source_order_id uuid;
  source_link_count bigint;
  source_link_active boolean;
  next_sequence bigint;
  fiscal_number text;
  postservice_payment_id uuid;
  postservice_locked_payment_ids uuid[] := array[]::uuid[];
  payment_lock record;
begin
  if org_id is null or actor_id is null
    or not public.has_organization_role(org_id,array['owner','manager']::public.app_role[])
    or not public.organization_entitlement_is_enabled(org_id,'billing.invoicing',now()) then
    raise exception 'billing_not_authorized' using errcode = '42501';
  end if;
  -- This first read establishes no invoice lock. Draft issuers must take the
  -- source order before the invoice, matching advance/final issuance.
  select * into inv from public.invoices i
  where i.organization_id=org_id and i.id=target_invoice_id;
  if inv.id is null or inv.fiscal_document_type <> 'simplified' then
    raise exception 'billing_invalid_draft' using errcode = '22023';
  end if;
  if inv.document_status='issued' then
    -- Terminal replay: never acquire an order/settings/counter lock after this
    -- invoice lock. Preserve replay independently of changed declarations.
    select * into inv from public.invoices i
    where i.organization_id=org_id and i.id=target_invoice_id for update;
    if inv.id is not null and inv.fiscal_document_type='simplified'
      and inv.document_status='issued' then
      return query select inv.id,inv.invoice_number; return;
    end if;
    raise exception 'billing_invalid_draft' using errcode = '22023';
  end if;
  if inv.document_status <> 'draft' then
    raise exception 'billing_invalid_draft' using errcode = '22023';
  end if;

  select count(*), min(l.order_id::text)::uuid, bool_and(l.is_active)
  into source_link_count, source_order_id, source_link_active
  from public.invoice_orders l
  where l.organization_id=org_id and l.invoice_id=target_invoice_id;
  if source_link_count<>1 or source_order_id is null
    or source_link_active is distinct from true then
    raise exception 'billing_invalid_orders' using errcode = '22023';
  end if;
  -- CR-01: match the established payment -> order -> invoice lock protocol.
  -- Refund owns session -> source payment -> order FK. Lock only explicitly
  -- attested source payments BEFORE the order; late discovery must fail closed.
  -- READ COMMITTED guards below run AFTER any wait and see committed refunds.
  if current_setting('transaction_isolation') = 'read committed' then
    for payment_lock in
      select p.id from public.payments p
      join public.billing_postservice_payment_evidence e
        on e.organization_id=p.organization_id and e.order_id=p.order_id and e.payment_id=p.id
      where p.organization_id=org_id and p.order_id=source_order_id
        and e.declaration_timing='contemporaneous'
      order by p.id for share of p
    loop
      postservice_locked_payment_ids := array_append(postservice_locked_payment_ids,payment_lock.id);
    end loop;
  end if;
  -- CR-01 end.
  select o.* into source_order from public.orders o
  where o.organization_id=org_id and o.id=source_order_id for update of o;
  if source_order.id is null then
    raise exception 'billing_invalid_orders' using errcode = '22023';
  end if;
  select * into inv from public.invoices i
  where i.organization_id=org_id and i.id=target_invoice_id for update;
  if inv.id is null or inv.fiscal_document_type <> 'simplified' then
    raise exception 'billing_invalid_draft' using errcode = '22023';
  end if;
  -- A concurrent full advance/service issue may have committed while waiting.
  -- Return its existing document before all new-issuance-only checks.
  if inv.document_status='issued' then
    return query select inv.id,inv.invoice_number; return;
  end if;
  if inv.document_status <> 'draft' then
    raise exception 'billing_invalid_draft' using errcode = '22023';
  end if;
  -- Only NEW simplified issuance requires fresh statement snapshots. The POS
  -- writer locks this same order until its payment INSERT commits; it does not
  -- UPDATE the order, so a pre-existing RR/Serializable snapshot could miss that
  -- payment even after waiting for the lock. Fail before any fiscal mutation.
  -- Issued-document replay above and the ordinary RPC remain unrestricted.
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'billing_simplified_read_committed_required' using errcode = '25000';
  end if;
  if target_confirmed is distinct from true or target_operation_scope is distinct from 'local_laundry_dry_cleaning'
    or target_recipient_requirement is null
    or target_recipient_requirement not in ('consumer','consumer_identified','business') then
    raise exception 'billing_simplified_declaration_required' using errcode = '22023';
  end if;
  select * into settings from public.organization_billing_settings s
  where s.organization_id=org_id for share;
  if settings.organization_id is null or not settings.simplified_invoicing_enabled
    or settings.fiscal_territory_code is distinct from 'ES-CN'
    or settings.declared_tax_regime_code is distinct from 'IGIC-GENERAL'
    or settings.issuer_country_code is distinct from 'ES'
    or settings.simplified_series is null or settings.simplified_series is distinct from inv.series then
    raise exception 'billing_simplified_issuance_disabled' using errcode = '55000';
  end if;
  if nullif(btrim(settings.issuer_legal_name),'') is null or nullif(btrim(settings.issuer_tax_id),'') is null
    or nullif(btrim(settings.issuer_address_line1),'') is null or nullif(btrim(settings.issuer_city),'') is null
    or nullif(btrim(settings.issuer_postal_code),'') is null then
    raise exception 'billing_issuer_configuration_required' using errcode = '22023';
  end if;
  select (now() at time zone o.timezone)::date into today from public.organizations o where o.id=org_id;
  if today is null or target_service_performed_on is null or target_service_performed_on>today
    or (inv.due_date is not null and inv.due_date<today) then
    raise exception 'billing_service_date_invalid' using errcode = '22023';
  end if;
  -- Local services only: special laundry ceiling applies to the whole invoice,
  -- not to handpicked SKU codes. Unknown/excluded/other operations use ordinary.
  if inv.currency <> 'EUR' or inv.total<0 or inv.total>3000 or not inv.prices_include_tax then
    raise exception 'billing_simplified_operation_not_eligible' using errcode = '22023';
  end if;
  if target_recipient_requirement<>'consumer' and inv.recipient_snapshot_mode<>'identified' then
    raise exception 'billing_customer_configuration_required' using errcode = '22023';
  end if;
  -- Date of issue is actual local issue day, not a backdated draft field. Service
  -- date is separately declared; consumer timing and B2B deadline are explicit.
  if (target_recipient_requirement<>'business' and target_service_performed_on<>today)
    or (target_recipient_requirement='business' and today >=
      (date_trunc('month',target_service_performed_on::timestamp)+interval '1 month 15 days')::date) then
    raise exception 'billing_service_date_review_required' using errcode = '22023';
  end if;
  if (select count(*) from public.invoice_orders l where l.organization_id=org_id and l.invoice_id=inv.id)<>1
    or not exists(select 1 from public.invoice_orders l where l.organization_id=org_id and l.invoice_id=inv.id and l.order_id=source_order_id and l.is_active) then
    raise exception 'billing_invalid_orders' using errcode = '22023';
  end if;
  -- Revalidated link above must still point to the order already locked.
  -- Never chase a changed link while holding the invoice lock.
  if source_order.id is null or not source_order.is_active or source_order.production_status in ('draft','cancelled')
    or source_order.currency<>inv.currency or source_order.total<>inv.total then
    raise exception 'billing_invalid_orders' using errcode = '22023';
  end if;
  select * into source_customer from public.customers c where c.organization_id=org_id and c.id=source_order.customer_id;
  if source_customer.id is null
    or (inv.customer_id is not null and inv.customer_id is distinct from source_customer.id)
    or (source_customer.customer_type='business' and target_recipient_requirement<>'business') then
    raise exception 'billing_customer_configuration_required' using errcode = '22023';
  end if;
  if exists (select 1 from public.invoice_orders l where l.organization_id=org_id
    and l.order_id=source_order.id and l.invoice_id<>inv.id) then
    raise exception 'billing_simplified_fiscal_history_review_required' using errcode = '55000';
  end if;
  -- Keep the payment-history guard; permit only explicit same-operation evidence.
  -- No inference of actual performance from production/payment timestamps.
  if exists(select 1 from public.payments p where p.organization_id=org_id
    and p.order_id=source_order.id and p.status<>'void') then
    -- Only the new opt-in, same-day, single-payment evidence can specialize the
    -- existing guard. Neither timestamps nor channel alone classify a payment.
    select p.id into postservice_payment_id
    from public.payments p join public.billing_postservice_payment_evidence e
      on e.organization_id=p.organization_id and e.order_id=p.order_id and e.payment_id=p.id
    join public.order_status_history h on h.id=e.completion_history_id
      and h.organization_id=e.organization_id and h.order_id=e.order_id
    where p.organization_id=org_id and p.order_id=source_order.id
      and p.id=any(postservice_locked_payment_ids)
      and p.status='confirmed' and p.channel='pos' and p.pos_session_id is not null
      and p.refunded_from_payment_id is null and e.declaration_timing='contemporaneous'
      and e.service_performed_on=target_service_performed_on
      and e.service_performed_on=today and source_order.production_status='completed'
      and h.to_status='completed' and h.changed_at=source_order.completed_at
      and (select count(*) from public.order_status_history x
        where x.organization_id=org_id and x.order_id=source_order.id and x.to_status='completed')=1
      and (select count(*) from public.payments x
        where x.organization_id=org_id and x.order_id=source_order.id and x.status<>'void')=1
      and not exists(select 1 from public.billing_advance_event_declarations x
        where x.organization_id=org_id and x.order_id=source_order.id)
      and not exists(select 1 from public.billing_invoice_payment_links x
        where x.organization_id=org_id and x.payment_id=p.id);
    if postservice_payment_id is null then
      raise exception 'billing_advance_workflow_required' using errcode = '55000';
    end if;
  end if;
  select count(*) as count, count(*) filter(where not it.prices_include_tax) as incompatible,
    round(sum(it.line_subtotal),2) as subtotal, round(sum(it.discount_amount),2) as discount_total,
    round(sum(it.taxable_base),2) as taxable_base, round(sum(it.tax_amount),2) as tax_total,
    round(sum(it.line_total),2) as total
  into totals from public.invoice_items it where it.organization_id=org_id and it.invoice_id=inv.id;
  if totals.count<1 or totals.incompatible<>0 or totals.subtotal is distinct from inv.subtotal
    or totals.discount_total is distinct from inv.discount_total or totals.taxable_base is distinct from inv.taxable_base
    or totals.tax_total is distinct from inv.tax_total or totals.total is distinct from inv.total
    or exists(select 1 from public.invoice_items it where it.organization_id=org_id and it.invoice_id=inv.id
      and it.source_order_id is distinct from source_order.id) then
    raise exception 'billing_totals_invalid' using errcode = '22023';
  end if;
  if postservice_payment_id is not null then
    perform set_config('app.billing_advance_link_mutation','on',true);
    insert into public.billing_invoice_payment_links
      (organization_id,order_id,invoice_id,billing_link_role,payment_id,attributed_amount)
      select org_id,source_order.id,inv.id,'final',p.id,p.amount
      from public.payments p where p.organization_id=org_id and p.id=postservice_payment_id;
    perform set_config('app.billing_advance_link_mutation','off',true);
  end if;
  -- Typed 001D counter/ownership, same canonical upsert, no parallel sequence.
  insert into public.billing_invoice_number_counters(organization_id,series,fiscal_document_type,next_value)
  values(org_id,inv.series,'simplified',2)
  on conflict(organization_id,series) do update set
    next_value=public.billing_invoice_number_counters.next_value+1,updated_at=now()
  returning next_value-1 into next_sequence;
  fiscal_number := extract(year from today)::integer::text || '-' || inv.series || '-' || lpad(next_sequence::text,greatest(6,length(next_sequence::text)),'0');
  perform set_config('app.billing_mutation','on',true);
  perform set_config('app.billing_simplified_service_issue','on',true);
  update public.invoices i set document_status='issued',invoice_number=fiscal_number,sequence_number=next_sequence,
    issue_date=today,issued_at=now(),service_performed_on=target_service_performed_on,
    service_operation_scope=target_operation_scope,fiscal_recipient_requirement=target_recipient_requirement,
    service_declared_by=actor_id,service_declared_at=now(),updated_by=actor_id,
    issuer_legal_name=settings.issuer_legal_name,issuer_tax_id=settings.issuer_tax_id,
    issuer_address_line1=settings.issuer_address_line1,issuer_address_line2=settings.issuer_address_line2,
    issuer_city=settings.issuer_city,issuer_region=settings.issuer_region,issuer_postal_code=settings.issuer_postal_code,
    issuer_country_code=settings.issuer_country_code,issuer_email=settings.issuer_email,issuer_phone=settings.issuer_phone
  where i.organization_id=org_id and i.id=inv.id;
  return query select inv.id,fiscal_number;
end;
$$;


commit;
