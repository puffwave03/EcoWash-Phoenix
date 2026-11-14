-- TERMINAL-FISCAL-TICKET-INTEGRATION-001: freeze customer-facing notes only.
-- No historical row updates, new writer, role or feature activation.
-- CREATE OR REPLACE preserves the existing function owner and ACL.
begin;
set local lock_timeout = '5s';
create or replace function public.issue_billing_full_prepayment_ticket(
  target_order_id uuid, target_payment_id uuid, target_recipient_requirement text,
  target_service_not_performed boolean, target_laundry_scope_confirmed boolean
)
returns table(invoice_id uuid, invoice_number text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  org_id uuid := public.app_current_organization_id();
  actor_id uuid := auth.uid();
  source_order public.orders%rowtype;
  source_payment public.payments%rowtype;
  source_customer public.customers%rowtype;
  settings public.organization_billing_settings%rowtype;
  existing_link public.billing_invoice_payment_links%rowtype;
  document public.invoices%rowtype;
  recipient jsonb;
  doc_id uuid;
  today date;
  next_sequence bigint;
  number text;
begin
  if actor_id is null or org_id is null or not public.has_organization_role(org_id,
    array['owner','manager']::public.app_role[])
    or not public.organization_entitlement_is_enabled(org_id,'billing.invoicing',now()) then
    raise exception 'billing_not_authorized' using errcode='42501';
  end if;
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'billing_ticket_read_committed_required' using errcode='25000';
  end if;
  if target_service_not_performed is distinct from true
    or target_laundry_scope_confirmed is distinct from true
    or target_recipient_requirement is null
    or target_recipient_requirement not in ('consumer','consumer_identified','business') then
    raise exception 'billing_ticket_confirmation_required' using errcode='22023';
  end if;
  -- Match the existing refund/declaration payment -> order lock order.
  select * into source_payment from public.payments p where p.organization_id=org_id
    and p.order_id=target_order_id and p.id=target_payment_id for share;
  select * into source_order from public.orders o where o.organization_id=org_id
    and o.id=target_order_id for update;
  if source_order.id is null or source_payment.id is null then
    raise exception 'billing_ticket_invalid_payment' using errcode='22023';
  end if;
  select * into settings from public.organization_billing_settings s
    where s.organization_id=org_id for share;
  if settings.fiscal_ticket_phase_a_enabled is distinct from true then
    raise exception 'billing_ticket_disabled' using errcode='55000';
  end if;
  -- The immutable canonical payment link is the operation's idempotency key.
  -- Replays recover the issued document even after production has progressed.
  select * into existing_link from public.billing_invoice_payment_links l
    where l.organization_id=org_id and l.payment_id=target_payment_id;
  if existing_link.payment_id is not null then
    select * into document from public.invoices i
      where i.organization_id=org_id and i.id=existing_link.invoice_id for share;
    if existing_link.order_id is distinct from target_order_id
      or existing_link.billing_link_role<>'final' or document.document_status<>'issued'
      or document.billing_event_kind<>'advance' or document.fiscal_ticket_order_snapshot is null
      or document.advance_recipient_requirement is distinct from target_recipient_requirement then
      raise exception 'billing_ticket_request_conflict' using errcode='23505';
    end if;
    return query select document.id,document.invoice_number;
    return;
  end if;
  select (now() at time zone o.timezone)::date into today from public.organizations o where o.id=org_id;
  if not source_order.is_active or source_order.production_status<>'received'
    or source_order.completed_at is not null or source_order.received_at is null
    or exists(select 1 from public.order_status_history h where h.organization_id=org_id
      and h.order_id=target_order_id and h.to_status not in ('draft','received'))
    or not exists(select 1 from public.order_status_history h where h.organization_id=org_id
      and h.order_id=target_order_id and h.to_status='received')
    or source_order.currency<>'EUR' or source_order.total<=0 or source_order.total>3000 then
    raise exception 'billing_ticket_order_review_required' using errcode='55000';
  end if;
  if source_payment.status<>'confirmed' or source_payment.channel<>'pos'
    or source_payment.pos_session_id is null or source_payment.refunded_from_payment_id is not null
    or source_payment.amount is distinct from source_order.total
    or source_payment.paid_at<source_order.received_at or source_payment.paid_at>clock_timestamp()
    or today is null or (source_payment.paid_at at time zone
      (select timezone from public.organizations where id=org_id))::date<>today
    or exists(select 1 from public.payments p where p.organization_id=org_id
      and p.order_id=target_order_id and p.id<>target_payment_id and p.status<>'void') then
    raise exception 'billing_ticket_invalid_payment' using errcode='22023';
  end if;
  if exists(select 1 from public.invoice_orders l where l.organization_id=org_id and l.order_id=target_order_id)
    or exists(select 1 from public.billing_advance_event_declarations d
      where d.organization_id=org_id and d.order_id=target_order_id)
    or exists(select 1 from public.billing_invoice_payment_links l
      where l.organization_id=org_id and l.order_id=target_order_id) then
    raise exception 'billing_fiscal_history_review_required' using errcode='55000';
  end if;
  if settings.simplified_invoicing_enabled is distinct from true
    or settings.fiscal_territory_code is distinct from 'ES-CN'
    or settings.declared_tax_regime_code is distinct from 'IGIC-GENERAL'
    or settings.issuer_country_code is distinct from 'ES' or settings.default_tax_rate is distinct from 7
    or settings.simplified_series is null
    or nullif(btrim(settings.issuer_legal_name),'') is null
    or nullif(btrim(settings.issuer_tax_id),'') is null
    or nullif(btrim(settings.issuer_address_line1),'') is null
    or nullif(btrim(settings.issuer_city),'') is null
    or nullif(btrim(settings.issuer_postal_code),'') is null then
    raise exception 'billing_ticket_profile_review_required' using errcode='55000';
  end if;
  select * into source_customer from public.customers c
    where c.organization_id=org_id and c.id=source_order.customer_id;
  if source_customer.id is null or (source_customer.customer_type='business'
    and target_recipient_requirement<>'business')
    or (source_customer.customer_type<>'business' and target_recipient_requirement='business') then
    raise exception 'billing_customer_configuration_required' using errcode='22023';
  end if;
  recipient := jsonb_build_object('recipient_snapshot_mode','anonymous','customer_id',null,
    'customer_name',null,'customer_tax_id',null,'customer_address_line1',null,
    'customer_address_line2',null,'customer_city',null,'customer_postal_code',null,
    'customer_country_code',null,'customer_email',null);
  if target_recipient_requirement<>'consumer' then
    recipient := recipient || jsonb_build_object('recipient_snapshot_mode','identified',
      'customer_name',coalesce(nullif(source_customer.company_name,''),source_customer.display_name),
      'customer_tax_id',source_customer.tax_id,'customer_address_line1',source_customer.billing_address_line1,
      'customer_city',source_customer.billing_city,'customer_postal_code',source_customer.billing_postal_code,
      'customer_country_code',source_customer.billing_country_code);
  end if;
  recipient := public.normalize_billing_recipient_snapshot(recipient);
  perform set_config('app.billing_advance_event_mutation','on',true);
  insert into public.billing_advance_event_declarations(organization_id,order_id,payment_id,
    payment_amount,payment_paid_at,service_not_performed_confirmed,declared_by,declared_at)
    values(org_id,target_order_id,target_payment_id,source_payment.amount,source_payment.paid_at,true,actor_id,clock_timestamp());
  perform set_config('app.fiscal_ticket_phase_a','on',true);
  -- Reuse the one canonical inclusive line/discount snapshot builder.
  doc_id := public.create_billing_draft_internal(array[target_order_id],settings.simplified_series,
    settings.default_tax_rate,null,'simplified',recipient);
  perform set_config('app.fiscal_ticket_invoice',doc_id::text,true);
  select * into document from public.invoices where organization_id=org_id and id=doc_id for update;
  if document.total is distinct from source_payment.amount
    or document.taxable_base+document.tax_total is distinct from document.total then
    raise exception 'billing_totals_invalid' using errcode='22023';
  end if;
  perform set_config('app.billing_mutation','on',true);
  perform set_config('app.billing_advance_issue','on',true);
  perform set_config('app.billing_advance_link_mutation','on',true);
  insert into public.billing_invoice_payment_links
    (organization_id,order_id,invoice_id,billing_link_role,payment_id,attributed_amount)
    values(org_id,target_order_id,doc_id,'final',target_payment_id,source_payment.amount);
  insert into public.billing_invoice_number_counters(organization_id,series,fiscal_document_type,next_value)
    values(org_id,document.series,'simplified',2)
    on conflict(organization_id,series) do update set
      next_value=public.billing_invoice_number_counters.next_value+1,updated_at=now()
    returning next_value-1 into next_sequence;
  number := extract(year from today)::integer::text||'-'||document.series||'-'
    ||lpad(next_sequence::text,greatest(6,length(next_sequence::text)),'0');
  update public.invoices set document_status='issued',billing_event_kind='advance',
    invoice_number=number,sequence_number=next_sequence,issue_date=today,issued_at=now(),
    updated_by=actor_id,advance_operation_scope='local_laundry_dry_cleaning',
    advance_recipient_requirement=target_recipient_requirement,advance_declared_by=actor_id,
    advance_declared_at=clock_timestamp(),fiscal_ticket_order_snapshot=jsonb_build_object(
      'order_number',source_order.order_number,'due_at',source_order.due_at,'location_id',source_order.location_id,
      'customer_notes',source_order.customer_notes)
    where organization_id=org_id and id=doc_id;
  perform set_config('app.fiscal_ticket_phase_a','off',true);
  perform set_config('app.fiscal_ticket_invoice','',true);
  perform set_config('app.billing_advance_event_mutation','off',true);
  perform set_config('app.billing_advance_issue','off',true);
  perform set_config('app.billing_advance_link_mutation','off',true);
  perform set_config('app.billing_mutation','off',true);
  return query select doc_id,number;
end;
$$;
commit;
