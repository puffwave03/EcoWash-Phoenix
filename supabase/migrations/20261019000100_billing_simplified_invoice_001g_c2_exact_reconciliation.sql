-- 001G-C2 local advance/final issuance. Apply only after separate CTO/release approval.
-- No tenant is enabled by this migration.
begin;
set local lock_timeout = '5s';
lock table public.invoices, public.invoice_orders, public.invoice_items,
  public.billing_invoice_payment_links, public.billing_advance_event_declarations
  in share row exclusive mode;

alter table public.invoices
  add column billing_event_kind text not null default 'service',
  add column advance_operation_scope text,
  add column advance_recipient_requirement text,
  add column advance_declared_by uuid references public.profiles(id) on delete restrict,
  add column advance_declared_at timestamptz,
  add column operation_total numeric(14,2),
  add column operation_taxable_base numeric(14,2),
  add column operation_tax_total numeric(14,2),
  add column documented_advance_total numeric(14,2),
  add column documented_advance_taxable_base numeric(14,2),
  add column documented_advance_tax_total numeric(14,2),
  add column operation_rounding_base_delta numeric(14,2),
  add column operation_items_snapshot jsonb,
  add constraint invoices_billing_event_kind_valid check (
    billing_event_kind in ('service','advance')
    and (billing_event_kind = 'service' or fiscal_document_type = 'simplified')),
  add constraint invoices_advance_declaration_valid check (
    (billing_event_kind<>'advance' and advance_operation_scope is null
      and advance_recipient_requirement is null and advance_declared_by is null
      and advance_declared_at is null)
    or (billing_event_kind='advance' and document_status='issued'
      and advance_operation_scope='local_laundry_dry_cleaning'
      and advance_recipient_requirement in ('consumer','consumer_identified','business')
      and advance_declared_by is not null and advance_declared_at is not null
      and (advance_recipient_requirement='consumer'
        or recipient_snapshot_mode='identified'))),
  add constraint invoices_advance_final_summary_valid check (
    (operation_total is null and operation_taxable_base is null
      and operation_tax_total is null and documented_advance_total is null
      and documented_advance_taxable_base is null
      and documented_advance_tax_total is null
      and operation_rounding_base_delta is null
      and operation_items_snapshot is null)
    or (fiscal_document_type='simplified' and billing_event_kind='service'
      and document_status='issued' and operation_total>0
      and operation_taxable_base>=0 and operation_tax_total>=0
      and documented_advance_total>0
      and documented_advance_taxable_base>=0
      and documented_advance_tax_total>=0
      and operation_total=documented_advance_total+total
      and operation_total=operation_taxable_base+operation_tax_total
      and operation_rounding_base_delta=
        documented_advance_taxable_base+taxable_base-operation_taxable_base
      and jsonb_typeof(operation_items_snapshot)='array'
      and jsonb_array_length(operation_items_snapshot)>0));

alter table public.invoices drop constraint invoices_service_declaration_valid;
alter table public.invoices add constraint invoices_service_declaration_valid check (
  case
    when fiscal_document_type = 'ordinary' or document_status = 'draft' then
      service_performed_on is null and service_operation_scope is null
      and fiscal_recipient_requirement is null and service_declared_by is null
      and service_declared_at is null
    when billing_event_kind = 'advance' then
      document_status = 'issued' and service_performed_on is null
      and service_operation_scope is null and fiscal_recipient_requirement is null
      and service_declared_by is null and service_declared_at is null
    else
      document_status = 'issued' and service_performed_on is not null
      and service_performed_on <= issue_date
      and coalesce(service_operation_scope='local_laundry_dry_cleaning',false)
      and coalesce(fiscal_recipient_requirement in ('consumer','consumer_identified','business'),false)
      and service_declared_by is not null and service_declared_at is not null
      and (fiscal_recipient_requirement='consumer' or recipient_snapshot_mode='identified')
  end);

create function public.protect_billing_event_kind()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.document_status = 'draft' and old.fiscal_document_type = 'simplified' then
      -- The public delete RPC takes these order locks before the invoice lock,
      -- matching issuance. Direct privileged DELETE is guarded too; any lock
      -- inversion must abort rather than allow an orphaned fiscal advance.
      if current_setting('transaction_isolation') <> 'read committed' then
        raise exception 'billing_final_read_committed_required' using errcode = '25000';
      end if;
      perform o.id from public.orders o join public.invoice_orders l
        on l.organization_id=o.organization_id and l.order_id=o.id
        where l.organization_id=old.organization_id and l.invoice_id=old.id
          and l.billing_link_role='final' order by o.id for update of o;
      if exists (select 1 from public.invoice_orders f
        join public.invoice_orders a on a.organization_id=f.organization_id
          and a.order_id=f.order_id and a.billing_link_role='advance'
        join public.invoices i on i.organization_id=a.organization_id and i.id=a.invoice_id
        where f.organization_id=old.organization_id and f.invoice_id=old.id
          and f.billing_link_role='final' and i.document_status='issued') then
        raise exception 'billing_final_draft_has_issued_advances' using errcode = '55000';
      end if;
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.document_status <> 'draft'
    and (new.billing_event_kind is distinct from old.billing_event_kind
      or new.advance_operation_scope is distinct from old.advance_operation_scope
      or new.advance_recipient_requirement is distinct from old.advance_recipient_requirement
      or new.advance_declared_by is distinct from old.advance_declared_by
      or new.advance_declared_at is distinct from old.advance_declared_at
      or new.operation_total is distinct from old.operation_total
      or new.operation_taxable_base is distinct from old.operation_taxable_base
      or new.operation_tax_total is distinct from old.operation_tax_total
      or new.documented_advance_total is distinct from old.documented_advance_total
      or new.documented_advance_taxable_base is distinct from old.documented_advance_taxable_base
      or new.documented_advance_tax_total is distinct from old.documented_advance_tax_total
      or new.operation_rounding_base_delta is distinct from old.operation_rounding_base_delta
      or new.operation_items_snapshot is distinct from old.operation_items_snapshot) then
    raise exception 'billing_issued_snapshot_immutable' using errcode = '55000';
  end if;
  if new.billing_event_kind = 'advance' and tg_op = 'UPDATE'
    and old.billing_event_kind is distinct from 'advance'
    and current_setting('app.billing_advance_issue',true) is distinct from 'on' then
    raise exception 'billing_advance_issuance_not_enabled' using errcode = '55000';
  end if;
  return new;
end;
$$;
create trigger invoices_billing_event_kind_guard before update or delete on public.invoices
  for each row execute function public.protect_billing_event_kind();
revoke all on function public.protect_billing_event_kind() from public, anon, authenticated;

-- Preserve the delete contract and privileges, serializing simplified deletion
-- against advance issuance on the same order before locking/deleting the draft.
create or replace function public.delete_billing_draft(target_invoice_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  org_id uuid := public.app_current_organization_id();
begin
  if not public.has_organization_role(org_id, array['owner','manager']::public.app_role[]) then
    raise exception 'billing_not_authorized' using errcode = '42501';
  end if;
  if exists (select 1 from public.invoices i where i.organization_id=org_id
    and i.id=target_invoice_id and i.fiscal_document_type='simplified') then
    if current_setting('transaction_isolation') <> 'read committed' then
      raise exception 'billing_final_read_committed_required' using errcode = '25000';
    end if;
    perform o.id from public.orders o join public.invoice_orders l
      on l.organization_id=o.organization_id and l.order_id=o.id
      where l.organization_id=org_id and l.invoice_id=target_invoice_id
        and l.billing_link_role='final' order by o.id for update of o;
  end if;
  perform 1 from public.invoices i where i.organization_id=org_id
    and i.id=target_invoice_id and i.document_status='draft' for update;
  if not found then
    raise exception 'billing_invalid_draft' using errcode = '22023';
  end if;
  perform set_config('app.billing_mutation','on',true);
  delete from public.invoices where organization_id=org_id and id=target_invoice_id
    and document_status='draft';
end;
$$;

-- Keep 001F's ordinary/service checks. Only the new advance writer can use the
-- advance branch, and the 001G-B block remains active for all other paths.
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
  return new;
end;
$$;

create or replace function public.block_billing_advance_issuance()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.document_status = 'issued' and old.document_status = 'draft'
    and exists (select 1 from public.invoice_orders l
      where l.organization_id = new.organization_id and l.invoice_id = new.id
        and l.billing_link_role = 'advance')
    and (current_setting('app.billing_advance_issue',true) is distinct from 'on'
      or new.billing_event_kind <> 'advance') then
    raise exception 'billing_advance_issuance_not_enabled' using errcode = '55000';
  end if;
  return new;
end;
$$;

-- A new pre-service declaration may follow an issued advance, but never a
-- final/ordinary fiscal document. Keep the C1 payment-first lock protocol.
create or replace function public.protect_billing_advance_event_declaration()
returns trigger language plpgsql set search_path = public as $$
declare
  actor_id uuid := auth.uid();
  source_payment public.payments%rowtype;
begin
  if tg_op <> 'INSERT' then
    raise exception 'billing_advance_event_immutable' using errcode = '55000';
  end if;
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'billing_advance_event_read_committed_required' using errcode = '25000';
  end if;
  if current_setting('app.billing_advance_event_mutation', true) is distinct from 'on'
    or actor_id is null or new.organization_id is distinct from public.app_current_organization_id()
    or not public.has_organization_role(new.organization_id,
      array['owner','manager']::public.app_role[])
    or not public.organization_entitlement_is_enabled(
      new.organization_id, 'billing.invoicing', now()) then
    raise exception 'billing_advance_event_not_authorized' using errcode = '42501';
  end if;
  if new.service_not_performed_confirmed is distinct from true then
    raise exception 'billing_advance_event_confirmation_required' using errcode = '22023';
  end if;
  select * into source_payment from public.payments p
    where p.organization_id = new.organization_id and p.order_id = new.order_id
      and p.id = new.payment_id for share;
  perform 1 from public.orders o
    where o.organization_id = new.organization_id and o.id = new.order_id
      and o.is_active and o.production_status <> 'cancelled' for update;
  if not found then
    raise exception 'billing_advance_event_invalid_order' using errcode = '22023';
  end if;
  if source_payment.id is null or source_payment.status <> 'confirmed'
    or source_payment.channel <> 'pos' or source_payment.pos_session_id is null
    or source_payment.refunded_from_payment_id is not null
    or source_payment.paid_at > clock_timestamp()
    or exists (select 1 from public.payments r where r.organization_id = new.organization_id
      and r.refunded_from_payment_id = new.payment_id and r.status = 'refunded') then
    raise exception 'billing_advance_event_invalid_payment' using errcode = '22023';
  end if;
  if exists (select 1 from public.invoice_orders l
    join public.invoices i on i.organization_id = l.organization_id and i.id = l.invoice_id
    where l.organization_id = new.organization_id and l.order_id = new.order_id
      and i.document_status in ('issued','cancelled')
      and (i.billing_event_kind <> 'advance' or i.document_status = 'cancelled')) then
    raise exception 'billing_advance_event_fiscal_history_review_required' using errcode = '55000';
  end if;
  new.payment_amount := source_payment.amount;
  new.payment_paid_at := source_payment.paid_at;
  new.declared_by := actor_id;
  new.declared_at := clock_timestamp();
  return new;
end;
$$;

-- Existing child history remains immutable. The one-time advance -> issued
-- final reference is an explicit 001G-B exception, guarded by its trigger.
create or replace function public.protect_billing_child_mutation()
returns trigger language plpgsql set search_path = public as $$
declare
  parent_invoice_id uuid := case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;
  parent_status public.billing_invoice_document_status;
begin
  if coalesce(current_setting('app.billing_mutation', true), '') <> 'on' then
    raise exception 'billing_rpc_required' using errcode = '42501';
  end if;
  select invoice.document_status into parent_status from public.invoices invoice
    where invoice.id = parent_invoice_id;
  if parent_status is not null and parent_status <> 'draft' then
    if tg_table_name = 'invoice_orders' and tg_op = 'UPDATE' then
      if old.is_active and not new.is_active then return new; end if;
      if current_setting('app.billing_final_link_mutation',true) = 'on'
        and old.billing_link_role = 'advance' and old.final_invoice_id is null
        and new.final_invoice_id is not null
        and (to_jsonb(new)-'final_invoice_id') = (to_jsonb(old)-'final_invoice_id') then
        return new;
      end if;
    end if;
    raise exception 'billing_issued_snapshot_immutable' using errcode = '55000';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- Owner/Manager confirms a POS advance; C1 owns the immutable data copy.
create function public.declare_billing_advance_event(target_order_id uuid,
  target_payment_id uuid, target_confirmed boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  org_id uuid := public.app_current_organization_id();
  existing public.billing_advance_event_declarations%rowtype;
begin
  if org_id is null or auth.uid() is null
    or not public.has_organization_role(org_id,array['owner','manager']::public.app_role[])
    or not public.organization_entitlement_is_enabled(org_id,'billing.invoicing',now()) then
    raise exception 'billing_not_authorized' using errcode = '42501';
  end if;
  if target_confirmed is distinct from true or target_order_id is null or target_payment_id is null then
    raise exception 'billing_advance_event_confirmation_required' using errcode = '22023';
  end if;
  select * into existing from public.billing_advance_event_declarations d
    where d.organization_id = org_id and d.payment_id = target_payment_id;
  if existing.payment_id is not null then
    if existing.order_id is distinct from target_order_id then
      raise exception 'billing_advance_event_conflict' using errcode = '23505';
    end if;
    return existing.payment_id;
  end if;
  perform set_config('app.billing_advance_event_mutation','on',true);
  insert into public.billing_advance_event_declarations
    (organization_id,order_id,payment_id,service_not_performed_confirmed)
    values(org_id,target_order_id,target_payment_id,true);
  return target_payment_id;
end;
$$;
revoke all on function public.declare_billing_advance_event(uuid,uuid,boolean)
  from public, anon, authenticated;
grant execute on function public.declare_billing_advance_event(uuid,uuid,boolean)
  to authenticated;

-- The full simplified draft is the existing canonical order-tax snapshot. An
-- advance is a separate Billing invoice in the same series and for the same
-- order, with one immutable POS payment attribution. The draft stays final.
create function public.issue_billing_advance_invoice(target_final_draft_id uuid,
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
    if prior_link.order_id<>v_order_id or prior_link.billing_link_role<>'advance'
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
    or not order_row.is_active or payment_row.amount>=full_draft.total then
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

-- A full-order draft remains the sole final document. The positive path is
-- restricted to exact, single-rate decomposition of that draft's canonical
-- amounts. Every non-void payment must be represented exactly once.
create function public.issue_billing_final_after_advances(
  target_final_draft_id uuid, target_balance_payment_id uuid,
  target_service_performed_on date, target_operation_scope text,
  target_recipient_requirement text, target_confirmed boolean
) returns table(invoice_id uuid, invoice_number text)
language plpgsql security definer set search_path = public as $$
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
  next_sequence bigint;
  fiscal_number text;
begin
  if org_id is null or actor_id is null
    or not public.has_organization_role(org_id,array['owner','manager']::public.app_role[])
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
  if advance_gross+balance_payment.amount<>final_draft.total
    or advance_base+advance_tax<>advance_gross
    or balance_base+balance_tax<>balance_payment.amount then
    raise exception 'billing_exact_reconciliation_required' using errcode='22023';
  end if;
  -- The commercial operation snapshot retains its original line descriptions,
  -- quantities, prices and canonical full-order taxes. Each fiscal event uses
  -- its own independently rounded components; no issued advance is changed.
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
  delete from public.invoice_items it where it.organization_id=org_id
    and it.invoice_id=target_final_draft_id;
  insert into public.invoice_items(organization_id,invoice_id,description,
    unit_type,quantity,unit_price,line_subtotal,discount_amount,taxable_base,
    tax_rate,tax_amount,line_total,prices_include_tax)
    values(org_id,target_final_draft_id,'Saldo · '||source_order.order_number,
      'service',1,balance_payment.amount,balance_payment.amount,0,
      balance_base,tax_rate,balance_tax,balance_payment.amount,true);
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
  update public.invoices set document_status='issued',invoice_number=fiscal_number,
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
  return query select target_final_draft_id,fiscal_number;
end;
$$;
revoke all on function public.issue_billing_final_after_advances(uuid,uuid,date,text,text,boolean)
  from public,anon,authenticated;
grant execute on function public.issue_billing_final_after_advances(uuid,uuid,date,text,text,boolean)
  to authenticated;

-- Keep existing Billing list/summary semantics for every ordinary and 001F
-- document. Only C2 fiscal events use their own attributed payment, avoiding
-- repetition of the entire order ledger on both advance and final records.
create function public.billing_paid_total_for_invoice(target_invoice_id uuid,
  target_organization_id uuid) returns numeric
language plpgsql stable security definer set search_path=public as $$
declare
  target_invoice public.invoices%rowtype;
  result numeric;
begin
  if target_organization_id is distinct from public.app_current_organization_id() then
    raise exception 'billing_not_authorized' using errcode='42501';
  end if;
  select * into target_invoice from public.invoices i
    where i.organization_id=target_organization_id and i.id=target_invoice_id;
  if target_invoice.id is null then return 0; end if;
  if target_invoice.billing_event_kind='advance'
    or target_invoice.operation_total is not null then
    select coalesce(sum(l.attributed_amount-
      coalesce((select sum(r.amount) from public.payments r
        where r.organization_id=l.organization_id
          and r.refunded_from_payment_id=l.payment_id
          and r.status='refunded'),0)),0) into result
      from public.billing_invoice_payment_links l
      where l.organization_id=target_organization_id
        and l.invoice_id=target_invoice_id;
    return round(result,2);
  end if;
  select coalesce(round(sum(case when p.status='confirmed' then p.amount
    when p.status='refunded' then -p.amount else 0 end),2),0)
    into result from public.payments p
    where p.organization_id=target_organization_id and exists(
      select 1 from public.invoice_orders io
      where io.organization_id=target_organization_id
        and io.invoice_id=target_invoice_id and io.order_id=p.order_id);
  return result;
end;
$$;
revoke all on function public.billing_paid_total_for_invoice(uuid,uuid)
  from public,anon,authenticated;

-- Scoped read-RPC updates reuse the exact existing paging, authorization and
-- customer-history contracts; only paid_total sourcing changes for C2 events.
create or replace function public.list_billing_invoices_page(
  target_query text, target_status text, target_cursor_created_at timestamptz,
  target_cursor_id uuid, target_direction text, target_limit integer
)
returns table (
  id uuid, created_at timestamptz, invoice_number text, customer_name text,
  issue_date date, currency text, total numeric, paid_total numeric,
  outstanding numeric, payment_status text, order_numbers text[]
)
language plpgsql stable security definer set search_path = public
as $$
declare org_id uuid;
begin
  org_id := public.app_current_organization_id();
  if org_id is null
    or not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[])
    or not public.organization_entitlement_is_enabled(org_id, 'billing.invoicing', now()) then
    raise exception 'history_not_authorized' using errcode = '42501';
  end if;
  if target_status is null or target_status not in ('all', 'draft', 'unpaid', 'partially_paid', 'paid', 'cancelled')
    or target_direction is null or target_direction not in ('older', 'newer')
    or (target_cursor_created_at is null) <> (target_cursor_id is null)
    or target_limit is null or target_limit not between 1 and 26 then
    raise exception 'billing_invalid_page' using errcode = '22023';
  end if;
  return query
  with amounts as (
    select i.*, public.billing_paid_total_for_invoice(i.id, org_id) as paid_total
    from public.invoices i where i.organization_id = org_id
  ), entries as (
    select a.*, round(greatest(a.total - a.paid_total, 0), 2) as outstanding,
      case when a.document_status = 'draft' then 'draft'
        when a.document_status = 'cancelled' then 'cancelled'
        when a.paid_total <= 0 then 'unpaid'
        when a.paid_total < a.total then 'partially_paid' else 'paid' end as payment_status,
      coalesce((select array_agg(o.order_number order by io.created_at, io.order_id)
        from public.invoice_orders io join public.orders o on o.organization_id = org_id and o.id = io.order_id
        where io.organization_id = org_id and io.invoice_id = a.id), array[]::text[]) as order_numbers
    from amounts a
  )
  select e.id, e.created_at, e.invoice_number, e.customer_name, e.issue_date, e.currency,
    e.total, e.paid_total, e.outstanding, e.payment_status, e.order_numbers
  from entries e
  where (target_status = 'all' or e.payment_status = target_status)
    -- Literal case-insensitive substring search, including the same concatenated fields as the UI.
    and (coalesce(target_query, '') = '' or strpos(lower(coalesce(e.invoice_number, '') || ' ' ||
      coalesce(e.customer_name, '') || ' ' || array_to_string(e.order_numbers, ' ')), lower(target_query)) > 0)
    and (target_cursor_id is null
      or (target_direction = 'older' and (e.created_at, e.id) < (target_cursor_created_at, target_cursor_id))
      or (target_direction = 'newer' and (e.created_at, e.id) > (target_cursor_created_at, target_cursor_id)))
  order by
    case when target_direction = 'older' then e.created_at end desc,
    case when target_direction = 'older' then e.id end desc,
    case when target_direction = 'newer' then e.created_at end asc,
    case when target_direction = 'newer' then e.id end asc
  limit target_limit;
end;
$$;

create or replace function public.get_billing_history_summary()
returns table (invoice_count bigint, draft_count bigint, currency text, issued_total numeric, outstanding numeric)
language plpgsql stable security definer set search_path = public
as $$
declare org_id uuid;
begin
  org_id := public.app_current_organization_id();
  if org_id is null
    or not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[])
    or not public.organization_entitlement_is_enabled(org_id, 'billing.invoicing', now()) then
    raise exception 'history_not_authorized' using errcode = '42501';
  end if;
  return query
  with amounts as (
    select i.*, public.billing_paid_total_for_invoice(i.id, org_id) as paid_total
    from public.invoices i where i.organization_id = org_id
  ), primary_currency as (
    select coalesce((select i.currency from public.invoices i
      where i.organization_id = org_id and i.document_status = 'issued'
      order by i.created_at desc, i.id desc limit 1),
      (select o.default_currency::text from public.organizations o where o.id = org_id)) as currency
  )
  select count(a.id), count(a.id) filter (where a.document_status = 'draft'), c.currency,
    coalesce(sum(a.total) filter (where a.document_status = 'issued' and a.currency = c.currency), 0),
    coalesce(sum(round(greatest(a.total - a.paid_total, 0), 2))
      filter (where a.document_status = 'issued' and a.currency = c.currency), 0)
  from primary_currency c left join amounts a on true group by c.currency;

end;
$$;

create or replace function public.get_customer_billing_history_summary(target_customer_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare org_id uuid;
begin
  org_id := public.app_current_organization_id();
  if org_id is null
    or not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[])
    or not public.organization_entitlement_is_enabled(org_id, 'billing.invoicing', now()) then
    raise exception 'history_not_authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from public.customers c where c.organization_id = org_id and c.id = target_customer_id) then
    raise exception 'billing_invalid_customer' using errcode = '22023';
  end if;
  return (
    with amounts as (
      select i.*, public.billing_paid_total_for_invoice(i.id, org_id) as paid_total
    from public.invoices i where i.organization_id = org_id and i.customer_id = target_customer_id and i.document_status <> 'cancelled'
    ), summaries as (
      select a.currency, count(*) as "invoiceCount",
        coalesce(sum(a.total) filter (where a.document_status = 'issued'), 0) as "issuedTotal",
        coalesce(sum(a.paid_total) filter (where a.document_status = 'issued'), 0) as "paidTotal",
        coalesce(sum(round(greatest(a.total - a.paid_total, 0), 2))
          filter (where a.document_status = 'issued'), 0) as outstanding
      from amounts a group by a.currency
    )
    select jsonb_build_object(
      'summaries', coalesce((select jsonb_agg(s order by s.currency) from summaries s), '[]'::jsonb),
      'eligibleOrderCount', (select count(*) from public.orders o
        join public.customers c on c.organization_id = org_id and c.id = o.customer_id
        where o.organization_id = org_id and o.customer_id = target_customer_id
          and o.is_active and o.production_status <> 'cancelled'
          and c.customer_code is distinct from 'WALKIN-SHARED'
          and not exists (select 1 from public.invoice_orders io
            where io.organization_id = org_id and io.order_id = o.id and io.is_active))
    )
  );
end;
$$;

commit;
