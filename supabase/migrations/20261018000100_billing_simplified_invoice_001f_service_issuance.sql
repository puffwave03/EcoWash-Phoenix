-- 001F LOCAL PROPOSAL ONLY. Never apply/enable without a separate release gate.
-- RD 1619/2012 arts. 4.2(m), 7, 11 and additional provision 2; Ley 20/1991 art.18.
-- PO: service date is explicitly confirmed by Owner/Manager, never inferred.
-- Supports local laundry/dry-cleaning service invoices WITHOUT payment history.
-- Advance/final reconciliation is not represented by the active-order uniqueness
-- model yet. Paid/refunded/pending operations are conservatively blocked here.
begin;
set local lock_timeout = '5s';
lock table public.organization_billing_settings, public.invoices, public.invoice_orders,
  public.invoice_items in share row exclusive mode;

alter table public.invoices
  add column service_performed_on date,
  add column service_operation_scope text,
  add column fiscal_recipient_requirement text,
  add column service_declared_by uuid references public.profiles(id) on delete restrict,
  add column service_declared_at timestamptz;

-- Immutable fiscal declaration: historical ordinary documents remain NULL.
create function public.protect_billing_service_declaration()
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
    if current_setting('app.billing_simplified_service_issue', true) is distinct from 'on'
      or new.service_declared_by is distinct from auth.uid()
      or not public.has_organization_role(new.organization_id, array['owner','manager']::public.app_role[])
      or not public.organization_entitlement_is_enabled(new.organization_id,'billing.invoicing',now())
      or not exists (select 1 from public.organization_billing_settings s
        where s.organization_id = new.organization_id and s.simplified_invoicing_enabled
          and s.fiscal_territory_code='ES-CN' and s.declared_tax_regime_code='IGIC-GENERAL'
          and s.issuer_country_code='ES' and s.simplified_series=new.series) then
      raise exception 'billing_simplified_issuance_disabled' using errcode = '55000';
    end if;
  end if;
  return new;
end;
$$;
create trigger invoices_service_declaration_guard before insert or update on public.invoices
for each row execute function public.protect_billing_service_declaration();
revoke all on function public.protect_billing_service_declaration() from public,anon,authenticated;

-- Both old blocks are relaxed ONLY in this transaction together with the writer
-- and row guards. Defaults stay false; NO tenant or series is configured/enabled.
alter table public.organization_billing_settings
  drop constraint organization_billing_settings_simplified_disabled,
  add constraint organization_billing_settings_simplified_profile_valid check (
    not simplified_invoicing_enabled or coalesce(
      fiscal_territory_code='ES-CN' and declared_tax_regime_code='IGIC-GENERAL'
      and issuer_country_code='ES' and simplified_series is not null
      and simplified_series <> default_series, false));
alter table public.invoices
  drop constraint invoices_simplified_draft_only,
  add constraint invoices_service_declaration_valid check (
    case when fiscal_document_type='ordinary' or document_status='draft' then
      service_performed_on is null and service_operation_scope is null
      and fiscal_recipient_requirement is null and service_declared_by is null and service_declared_at is null
    else
      document_status='issued' and service_performed_on is not null
      and service_performed_on <= issue_date
      and coalesce(service_operation_scope='local_laundry_dry_cleaning',false)
      and coalesce(fiscal_recipient_requirement in ('consumer','consumer_identified','business'),false)
      and service_declared_by is not null and service_declared_at is not null
      and (fiscal_recipient_requirement='consumer' or recipient_snapshot_mode='identified')
    end);

create or replace function public.issue_billing_invoice(target_invoice_id uuid)
returns table (invoice_id uuid, invoice_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  org_id uuid := public.app_current_organization_id();
  invoice_row public.invoices%rowtype;
  customer_row public.customers%rowtype;
  settings_row public.organization_billing_settings%rowtype;
  allocated_sequence bigint;
  allocated_number text;
  item_totals record;
begin
  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'billing_not_authorized' using errcode = '42501';
  end if;

  select * into invoice_row
  from public.invoices invoice
  where invoice.organization_id = org_id
    and invoice.id = target_invoice_id
  for update;

  if invoice_row.fiscal_document_type = 'simplified' then
    if not public.organization_entitlement_is_enabled(org_id,'billing.invoicing',now()) then
      raise exception 'billing_not_authorized' using errcode = '42501';
    end if;
    if invoice_row.document_status = 'issued' then
      return query select invoice_row.id, invoice_row.invoice_number;
      return;
    end if;
    raise exception 'billing_simplified_declaration_required' using errcode = '22023';
  end if;

  if invoice_row.id is null or invoice_row.document_status <> 'draft' then
    raise exception 'billing_invalid_draft' using errcode = '22023';
  end if;

  select * into settings_row
  from public.organization_billing_settings settings
  where settings.organization_id = org_id;

  if settings_row.organization_id is null
    or nullif(btrim(settings_row.issuer_legal_name), '') is null
    or nullif(btrim(settings_row.issuer_tax_id), '') is null
    or nullif(btrim(settings_row.issuer_address_line1), '') is null
    or nullif(btrim(settings_row.issuer_city), '') is null
    or nullif(btrim(settings_row.issuer_postal_code), '') is null
    or settings_row.issuer_country_code is null
  then
    raise exception 'billing_issuer_configuration_required' using errcode = '22023';
  end if;

  select * into customer_row
  from public.customers customer
  where customer.organization_id = org_id
    and customer.id = invoice_row.customer_id;

  if customer_row.id is null
    or nullif(btrim(customer_row.display_name), '') is null
    or nullif(btrim(customer_row.billing_address_line1), '') is null
    or nullif(btrim(customer_row.billing_city), '') is null
    or nullif(btrim(customer_row.billing_postal_code), '') is null
    or customer_row.billing_country_code is null
    or (
      customer_row.customer_type = 'business'
      and (
        nullif(btrim(coalesce(customer_row.company_name, customer_row.display_name)), '') is null
        or nullif(btrim(customer_row.tax_id), '') is null
      )
    )
  then
    raise exception 'billing_customer_configuration_required' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.invoice_orders invoice_order
    where invoice_order.organization_id = org_id
      and invoice_order.invoice_id = target_invoice_id
      and invoice_order.is_active
  ) or exists (
    select 1
    from public.invoice_orders invoice_order
    join public.orders customer_order
      on customer_order.organization_id = invoice_order.organization_id
     and customer_order.id = invoice_order.order_id
    where invoice_order.organization_id = org_id
      and invoice_order.invoice_id = target_invoice_id
      and (
        not invoice_order.is_active
        or customer_order.customer_id <> invoice_row.customer_id
        or customer_order.currency <> invoice_row.currency
        or not customer_order.is_active
        or customer_order.production_status = 'cancelled'
      )
  ) then
    raise exception 'billing_invalid_orders' using errcode = '22023';
  end if;

  select
    count(*) as item_count,
    count(*) filter (where item.prices_include_tax is distinct from invoice_row.prices_include_tax) as mode_mismatch_count,
    round(sum(item.line_subtotal), 2) as subtotal,
    round(sum(item.discount_amount), 2) as discount_total,
    round(sum(item.taxable_base), 2) as taxable_base,
    round(sum(item.tax_amount), 2) as tax_total,
    round(sum(item.line_total), 2) as total
  into item_totals
  from public.invoice_items item
  where item.organization_id = org_id
    and item.invoice_id = target_invoice_id;

  if item_totals.item_count < 1
    or item_totals.mode_mismatch_count > 0
    or (invoice_row.prices_include_tax and (
      invoice_row.total <> invoice_row.subtotal - invoice_row.discount_total
      or invoice_row.total <> invoice_row.taxable_base + invoice_row.tax_total
    ))
    or item_totals.subtotal <> invoice_row.subtotal
    or item_totals.discount_total <> invoice_row.discount_total
    or item_totals.taxable_base <> invoice_row.taxable_base
    or item_totals.tax_total <> invoice_row.tax_total
    or item_totals.total <> invoice_row.total
  then
    raise exception 'billing_totals_invalid' using errcode = '22023';
  end if;

  insert into public.billing_invoice_number_counters (
    organization_id,
    series,
    next_value
  ) values (
    org_id,
    invoice_row.series,
    2
  )
  on conflict (organization_id, series)
  do update set
    next_value = public.billing_invoice_number_counters.next_value + 1,
    updated_at = now()
  returning next_value - 1 into allocated_sequence;

  allocated_number := extract(year from invoice_row.issue_date)::integer::text
    || '-' || invoice_row.series
    || '-' || lpad(allocated_sequence::text, 6, '0');

  perform set_config('app.billing_mutation', 'on', true);

  update public.invoices invoice
  set invoice_number = allocated_number,
      sequence_number = allocated_sequence,
      document_status = 'issued',
      issuer_legal_name = settings_row.issuer_legal_name,
      issuer_tax_id = settings_row.issuer_tax_id,
      issuer_address_line1 = settings_row.issuer_address_line1,
      issuer_address_line2 = settings_row.issuer_address_line2,
      issuer_city = settings_row.issuer_city,
      issuer_region = settings_row.issuer_region,
      issuer_postal_code = settings_row.issuer_postal_code,
      issuer_country_code = settings_row.issuer_country_code,
      issuer_email = settings_row.issuer_email,
      issuer_phone = settings_row.issuer_phone,
      issuer_logo_path = branding.logo_path,
      customer_name = case when customer_row.customer_type = 'business'
        then coalesce(nullif(customer_row.company_name, ''), customer_row.display_name)
        else customer_row.display_name
      end,
      customer_tax_id = customer_row.tax_id,
      customer_address_line1 = customer_row.billing_address_line1,
      customer_address_line2 = customer_row.billing_address_line2,
      customer_city = customer_row.billing_city,
      customer_postal_code = customer_row.billing_postal_code,
      customer_country_code = customer_row.billing_country_code,
      customer_email = customer_row.email,
      issued_at = now(),
      updated_by = actor_id
  from public.organization_branding branding
  where invoice.organization_id = org_id
    and invoice.id = target_invoice_id
    and branding.organization_id = org_id;

  if not found then
    update public.invoices invoice
    set invoice_number = allocated_number,
        sequence_number = allocated_sequence,
        document_status = 'issued',
        issuer_legal_name = settings_row.issuer_legal_name,
        issuer_tax_id = settings_row.issuer_tax_id,
        issuer_address_line1 = settings_row.issuer_address_line1,
        issuer_address_line2 = settings_row.issuer_address_line2,
        issuer_city = settings_row.issuer_city,
        issuer_region = settings_row.issuer_region,
        issuer_postal_code = settings_row.issuer_postal_code,
        issuer_country_code = settings_row.issuer_country_code,
        issuer_email = settings_row.issuer_email,
        issuer_phone = settings_row.issuer_phone,
        customer_name = case when customer_row.customer_type = 'business'
          then coalesce(nullif(customer_row.company_name, ''), customer_row.display_name)
          else customer_row.display_name
        end,
        customer_tax_id = customer_row.tax_id,
        customer_address_line1 = customer_row.billing_address_line1,
        customer_address_line2 = customer_row.billing_address_line2,
        customer_city = customer_row.billing_city,
        customer_postal_code = customer_row.billing_postal_code,
        customer_country_code = customer_row.billing_country_code,
        customer_email = customer_row.email,
        issued_at = now(),
        updated_by = actor_id
    where invoice.organization_id = org_id
      and invoice.id = target_invoice_id;
  end if;

  return query select target_invoice_id, allocated_number;
end;
$$;

-- Explicit confirmation overload. Legacy ordinary payload/signature is retained.
create function public.issue_billing_invoice(
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
  next_sequence bigint;
  fiscal_number text;
begin
  if org_id is null or actor_id is null
    or not public.has_organization_role(org_id,array['owner','manager']::public.app_role[])
    or not public.organization_entitlement_is_enabled(org_id,'billing.invoicing',now()) then
    raise exception 'billing_not_authorized' using errcode = '42501';
  end if;
  select * into inv from public.invoices i
  where i.organization_id=org_id and i.id=target_invoice_id for update;
  if inv.id is null or inv.fiscal_document_type <> 'simplified' then
    raise exception 'billing_invalid_draft' using errcode = '22023';
  end if;
  -- An already committed success is the same result, even after settings/date
  -- change. Never re-snapshot, advance counters or accept new declaration data.
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
    or not exists(select 1 from public.invoice_orders l where l.organization_id=org_id and l.invoice_id=inv.id and l.is_active) then
    raise exception 'billing_invalid_orders' using errcode = '22023';
  end if;
  -- Same parent row as canonical POS/payment writers. A payment racing issuance
  -- either commits first and blocks issuance, or follows the completed service.
  select o.* into source_order from public.orders o join public.invoice_orders l
    on l.organization_id=org_id and l.order_id=o.id and l.invoice_id=inv.id and l.is_active
  where o.organization_id=org_id for update of o;
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
  -- Do not net payment/refund rows or infer an advance's fiscal date. Until a
  -- canonical advance/final linkage exists, all non-void payment history blocks.
  if exists(select 1 from public.payments p where p.organization_id=org_id
    and p.order_id=source_order.id and p.status<>'void') then
    raise exception 'billing_advance_workflow_required' using errcode = '55000';
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
revoke all on function public.issue_billing_invoice(uuid,date,text,text,boolean) from public,anon,authenticated;
grant execute on function public.issue_billing_invoice(uuid,date,text,text,boolean) to authenticated;
-- Existing ACL of the ordinary one-argument RPC is retained by OR REPLACE.
commit;
