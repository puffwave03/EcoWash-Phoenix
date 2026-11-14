-- Local proposal only. Does not enable issuance, change S06 or backfill history.
begin;
set local lock_timeout = '5s';

-- A declaration cannot be reconstructed from payments or production history.
-- This is immutable evidence, not another financial ledger.
create table public.pos_service_payment_evidence (
  organization_id uuid not null,
  order_id uuid not null,
  payment_id uuid not null,
  completion_history_id uuid not null references public.order_status_history(id) on delete restrict,
  service_performed_on date not null,
  operational_completed_at timestamptz not null,
  organization_timezone text not null,
  statement_version text not null check (statement_version = 'pos-service-v1'),
  declared_by uuid not null references public.profiles(id) on delete restrict,
  declared_at timestamptz not null,
  primary key (organization_id,payment_id),
  foreign key (organization_id,order_id,payment_id)
    references public.payments(organization_id,order_id,id) on delete restrict
);
create function public.protect_pos_service_payment_evidence()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'pos_service_evidence_immutable' using errcode='55000';
  end if;
  if new.organization_id is distinct from public.app_current_organization_id()
    or new.declared_by is distinct from auth.uid()
    or current_setting('app.pos_service_capture',true) is distinct from new.payment_id::text
    or not exists(select 1 from public.order_status_history h
      where h.id=new.completion_history_id and h.organization_id=new.organization_id
        and h.order_id=new.order_id and h.to_status='completed'
        and h.changed_at=new.operational_completed_at) then
    raise exception 'pos_service_evidence_not_authorized' using errcode='42501';
  end if;
  new.declared_at := clock_timestamp();
  return new;
end;
$$;
create trigger pos_service_payment_evidence_guard
before insert or update or delete on public.pos_service_payment_evidence
for each row execute function public.protect_pos_service_payment_evidence();
revoke all on function public.protect_pos_service_payment_evidence() from public,anon,authenticated,service_role;
alter table public.pos_service_payment_evidence enable row level security;
-- No broad table grant: the POS-scoped reader below returns only requested payments.
revoke all on public.pos_service_payment_evidence from public,anon,authenticated,service_role;

create function public.record_pos_payment_with_service_evidence(
  target_order_id uuid, target_amount numeric, target_method public.payment_method,
  target_pos_session_id uuid, target_reference text, target_notes text,
  target_idempotency_key uuid, target_service_performed_on date, target_confirmed boolean,
  target_provider text default null, target_provider_reference text default null,
  target_external_status text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  org uuid := public.app_current_organization_id();
  ord public.orders%rowtype;
  old_evidence public.pos_service_payment_evidence%rowtype;
  previous_id uuid; result_id uuid; event_id uuid; event_count bigint;
  zone text; today date; event_time timestamptz;
begin
  perform public.require_pos_access(org);
  perform public.require_shop_terminal_access(org);
  if auth.uid() is null or not public.organization_entitlement_is_enabled(org,'billing.invoicing',now()) then
    raise exception 'pos_coverage_not_authorized' using errcode='42501';
  end if;
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'pos_service_read_committed_required' using errcode='25000';
  end if;
  select o.timezone into zone from public.organizations o where o.id=org;
  today := (clock_timestamp() at time zone zone)::date;
  if target_confirmed is distinct from true or target_service_performed_on is null
    or target_service_performed_on>today or target_pos_session_id is null then
    raise exception 'pos_service_declaration_required' using errcode='22023';
  end if;
  -- Identical session -> order lock protocol to the canonical POS writer.
  perform 1 from public.pos_sessions s where s.organization_id=org
    and s.id=target_pos_session_id for update;
  select * into ord from public.orders o where o.organization_id=org
    and o.id=target_order_id for update;
  if ord.id is null then raise exception 'pos_order_invalid' using errcode='22023'; end if;
  select p.id into previous_id from public.payments p
    where p.organization_id=org and p.idempotency_key=target_idempotency_key;
  if previous_id is not null then
    select * into old_evidence from public.pos_service_payment_evidence e
      where e.organization_id=org and e.payment_id=previous_id;
    if old_evidence.payment_id is null then
      raise exception 'pos_service_historical_payment_review_required' using errcode='55000';
    end if;
    if old_evidence.order_id is distinct from target_order_id
      or old_evidence.declared_by is distinct from auth.uid()
      or old_evidence.service_performed_on is distinct from target_service_performed_on then
      raise exception 'pos_service_idempotency_conflict' using errcode='23505';
    end if;
    -- Validate the original monetary payload, without adding or changing evidence.
    return public.record_pos_payment(target_order_id,target_amount,target_method,
      target_pos_session_id,target_reference,target_notes,target_idempotency_key,
      target_provider,target_provider_reference,target_external_status);
  end if;
  if not coalesce((select s.pos_billing_payment_link_enabled from public.organization_billing_settings s
    where s.organization_id=org),false) then
    raise exception 'pos_coverage_disabled' using errcode='55000';
  end if;
  select count(*),min(h.id::text)::uuid,min(h.changed_at) into event_count,event_id,event_time
    from public.order_status_history h where h.organization_id=org and h.order_id=ord.id
      and h.to_status='completed';
  if ord.production_status<>'completed' or ord.completed_at is null or event_count<>1
    or event_time is distinct from ord.completed_at or event_time>clock_timestamp()
    or target_service_performed_on<(ord.created_at at time zone zone)::date then
    raise exception 'pos_service_history_review_required' using errcode='55000';
  end if;
  -- The declared date is NOT inferred from completion or delivery chronology.
  -- Prior-day declarations are stored as evidence only; no fiscal writer is called.
  result_id := public.record_pos_payment(target_order_id,target_amount,target_method,
    target_pos_session_id,target_reference,target_notes,target_idempotency_key,
    target_provider,target_provider_reference,target_external_status);
  perform set_config('app.pos_service_capture',result_id::text,true);
  insert into public.pos_service_payment_evidence
    (organization_id,order_id,payment_id,completion_history_id,service_performed_on,
      operational_completed_at,organization_timezone,statement_version,declared_by,declared_at)
    values(org,ord.id,result_id,event_id,target_service_performed_on,event_time,zone,
      'pos-service-v1',auth.uid(),clock_timestamp());
  perform set_config('app.pos_service_capture','',true);
  return result_id;
end;
$$;
revoke all on function public.record_pos_payment_with_service_evidence(uuid,numeric,public.payment_method,uuid,text,text,uuid,date,boolean,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.record_pos_payment_with_service_evidence(uuid,numeric,public.payment_method,uuid,text,text,uuid,date,boolean,text,text,text) to authenticated;

-- Coverage is derived, never a new authoritative payment or invoice record.
-- Input is bounded to the existing POS page; foreign/missing IDs fail the entire read.
create function public.get_pos_fiscal_coverage(target_payment_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare org uuid:=public.app_current_organization_id(); result jsonb; zone text;
begin
  perform public.require_pos_access(org);
  perform public.require_shop_terminal_access(org);
  if auth.uid() is null or not public.organization_entitlement_is_enabled(org,'billing.invoicing',now()) then
    raise exception 'pos_coverage_not_authorized' using errcode='42501'; end if;
  if target_payment_ids is null or cardinality(target_payment_ids)>100
    or exists(select 1 from unnest(target_payment_ids) x(id) where x.id is null
      or not exists(select 1 from public.payments p where p.organization_id=org and p.id=x.id
        and p.channel='pos' and p.status='confirmed')) then
    raise exception 'pos_coverage_payment_not_found' using errcode='22023'; end if;
  select o.timezone into zone from public.organizations o where o.id=org;
  select jsonb_build_object('enabled',coalesce((select s.pos_billing_payment_link_enabled
      from public.organization_billing_settings s where s.organization_id=org),false),
    'today',(now() at time zone zone)::date,'timezone',zone,
    'payments',coalesce(jsonb_agg(jsonb_build_object(
      'paymentId',p.id,'orderId',p.order_id,'amount',p.amount,'currency',o.currency,'paidAt',p.paid_at,
      'status',case
        when i.document_status='issued' and l.attributed_amount=p.amount and io.is_active
          and i.currency=o.currency and p.pos_session_id is not null and not refunded then
          case when i.pos_billing_order_snapshot is not null or i.fiscal_ticket_order_snapshot is not null
            then 'document_issued' else 'existing_document_linked' end
        when l.payment_id is not null or refunded or candidates>0 or e.payment_id is not null or p.pos_session_id is null
          or o.production_status<>'received' or o.completed_at is not null
          or progressed or (p.paid_at at time zone zone)::date<>(now() at time zone zone)::date
          then 'review_required'
        else 'issuance_pending' end,
      'reason',case
        when refunded then 'refund_review'
        when p.pos_session_id is null then 'pos_session_review'
        when l.payment_id is not null and (i.document_status<>'issued' or l.attributed_amount<>p.amount
          or not io.is_active or i.currency<>o.currency) then 'invalid_attribution'
        when i.document_status='issued' then 'persisted_attribution'
        when candidates>0 then 'existing_document_requires_attribution'
        when e.payment_id is not null then 'postservice_fiscal_rule_not_enabled'
        when o.production_status<>'received' or o.completed_at is not null or progressed then 'service_evidence_review'
        when (p.paid_at at time zone zone)::date<>(now() at time zone zone)::date then 'historical_payment_review'
        else 'no_document_attributed' end,
      'document',case when i.id is not null then jsonb_build_object('id',i.id,'number',i.invoice_number,
        'issuedAt',i.issued_at,'amount',l.attributed_amount) else null end,
      'evidence',case when e.payment_id is not null then jsonb_build_object(
        'servicePerformedOn',e.service_performed_on,'completionHistoryId',e.completion_history_id,
        'operationalCompletedAt',e.operational_completed_at,'declaredAt',e.declared_at,
        'timezone',e.organization_timezone,'statementVersion',e.statement_version) else null end
    ) order by p.paid_at,p.id),'[]'::jsonb)) into result
  from public.payments p join public.orders o on o.organization_id=p.organization_id and o.id=p.order_id
  left join public.billing_invoice_payment_links l on l.organization_id=p.organization_id and l.payment_id=p.id
  left join public.invoices i on i.organization_id=l.organization_id and i.id=l.invoice_id
  left join public.invoice_orders io on io.organization_id=l.organization_id and io.invoice_id=l.invoice_id
    and io.order_id=l.order_id and io.billing_link_role=l.billing_link_role
  left join public.pos_service_payment_evidence e on e.organization_id=p.organization_id and e.payment_id=p.id
  cross join lateral (select
    exists(select 1 from public.payments r where r.organization_id=org and r.refunded_from_payment_id=p.id
      and r.status='refunded') as refunded,
    exists(select 1 from public.order_status_history h where h.organization_id=org and h.order_id=p.order_id
      and h.to_status not in ('draft','received')) as progressed,
    (select count(*) from public.invoice_orders c join public.invoices d on d.organization_id=c.organization_id and d.id=c.invoice_id
      where c.organization_id=org and c.order_id=p.order_id and d.document_status<>'draft') as candidates
  ) facts
  where p.organization_id=org and p.id=any(target_payment_ids);
  return result;
end;
$$;
revoke all on function public.get_pos_fiscal_coverage(uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.get_pos_fiscal_coverage(uuid[]) to authenticated;
commit;
