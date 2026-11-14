-- Controlled POS -> Billing payment attribution. V1 and historical migrations unchanged.
-- Reuses the last advance/final issuers, canonical tax rounding and immutable links.
-- Internal issuers remain non-executable by authenticated users. Default-off, no row rewrite.
begin;
set local lock_timeout='5s';
do $$ begin
 if to_regprocedure('public.issue_billing_advance_invoice(uuid,uuid,text,text,boolean)') is not null
  or to_regprocedure('public.issue_billing_final_after_advances(uuid,uuid,date,text,text,boolean)') is not null
  or to_regprocedure('public.declare_billing_advance_event(uuid,uuid,boolean)') is not null then
  raise exception 'pos_billing_retired_baseline_required' using errcode='55000';
 end if;
end $$;
alter table public.organization_billing_settings add column pos_billing_payment_link_enabled boolean not null default false;
alter table public.invoices add column pos_billing_order_snapshot jsonb,
 add constraint invoices_pos_billing_snapshot_valid check(pos_billing_order_snapshot is null or
 (jsonb_typeof(pos_billing_order_snapshot)='object' and pos_billing_order_snapshot->>'workflow'='pos_billing_payment_link'
  and pos_billing_order_snapshot ? 'order_id' and fiscal_document_type='simplified') is true);

create function public.pos_billing_context_allowed(target_org uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(auth.uid() is not null and target_org=public.app_current_organization_id()
 and current_setting('app.pos_billing_org',true)=target_org::text
 and public.has_pos_capability(target_org)
 and public.organization_entitlement_is_enabled(target_org,'pos',now())
 and public.organization_entitlement_is_enabled(target_org,'shop_terminal',now())
 and public.organization_entitlement_is_enabled(target_org,'billing.invoicing',now())
 and exists(select 1 from public.organization_billing_settings s where s.organization_id=target_org and s.pos_billing_payment_link_enabled)
 and exists(select 1 from public.orders o where o.organization_id=target_org
  and o.id::text=current_setting('app.pos_billing_order',true)),false);
$$;
revoke all on function public.pos_billing_context_allowed(uuid) from public,anon,authenticated,service_role;


create or replace function public.protect_retired_billing_workflow()
returns trigger language plpgsql set search_path = '' as $$
declare
  permitted boolean;
begin

  -- Separate bounded POS exception; the Phase A branch below is unchanged.
  if tg_op<>'DELETE' and public.pos_billing_context_allowed(new.organization_id)
     and new.fiscal_document_type='simplified' then
    if tg_op='INSERT' and new.document_status='draft' and new.billing_event_kind='service' then
      new.pos_billing_order_snapshot:=jsonb_build_object('workflow','pos_billing_payment_link',
        'order_id',current_setting('app.pos_billing_order',true));
      perform set_config('app.pos_billing_invoice_ids',concat_ws(',',nullif(current_setting('app.pos_billing_invoice_ids',true),''),new.id::text),true);
      return new;
    end if;
    if tg_op='UPDATE' and old.document_status='draft' and old.pos_billing_order_snapshot is not null
       and old.pos_billing_order_snapshot->>'order_id'=current_setting('app.pos_billing_order',true)
       and new.id::text=any(string_to_array(current_setting('app.pos_billing_invoice_ids',true),','))
       and new.document_status in ('draft','issued') and new.billing_event_kind in ('advance','service')
       and new.pos_billing_order_snapshot->>'order_id'=old.pos_billing_order_snapshot->>'order_id' then
      return new;
    end if;
  end if;
  if tg_op='INSERT' or (tg_op='UPDATE' and old.document_status='draft') then
    permitted := current_setting('app.fiscal_ticket_phase_a',true)='on'
      and auth.uid() is not null
      and new.organization_id=public.app_current_organization_id()
      and public.has_organization_role(new.organization_id,array['owner','manager']::public.app_role[])
      and public.organization_entitlement_is_enabled(new.organization_id,'billing.invoicing',now())
      and exists(select 1 from public.organization_billing_settings s
        where s.organization_id=new.organization_id and s.fiscal_ticket_phase_a_enabled);
    if permitted and new.fiscal_document_type='simplified' then
      if tg_op='INSERT' and new.document_status='draft'
        and new.billing_event_kind='service' and new.fiscal_ticket_order_snapshot is null then
        perform set_config('app.fiscal_ticket_invoice',new.id::text,true);
        return new;
      end if;
      if tg_op='UPDATE' and old.fiscal_document_type='simplified'
        and old.fiscal_ticket_order_snapshot is null
        and new.id::text=current_setting('app.fiscal_ticket_invoice',true) then
        -- The canonical builder updates its own totals before returning the ID.
        if new.document_status='draft' and new.billing_event_kind='service'
          and new.fiscal_ticket_order_snapshot is null then return new; end if;
        if new.document_status='issued' and new.billing_event_kind='advance'
          and new.fiscal_ticket_order_snapshot is not null then return new; end if;
      end if;
    end if;
  end if;
  if tg_op='INSERT' then
    if new.fiscal_document_type<>'ordinary' or new.billing_event_kind<>'service'
      or new.fiscal_ticket_order_snapshot is not null then
      raise exception 'billing_document_workflow_retired' using errcode='55000';
    end if;
    return new;
  end if;
  if old.fiscal_document_type<>'ordinary' or old.billing_event_kind<>'service' then
    raise exception 'billing_document_workflow_retired' using errcode='55000';
  end if;
  if tg_op='UPDATE' and (new.fiscal_document_type<>'ordinary' or new.billing_event_kind<>'service'
    or new.fiscal_ticket_order_snapshot is not null) then
    raise exception 'billing_document_workflow_retired' using errcode='55000';
  end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;

create or replace function public.create_billing_draft_internal(
  target_order_ids uuid[], target_series text, target_tax_rate numeric, target_notes text,
  target_fiscal_document_type public.billing_fiscal_document_type, target_recipient_snapshot jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  recipient jsonb;
  actor_id uuid := auth.uid();
  org_id uuid := public.app_current_organization_id();
  selected_count integer;
  distinct_customer_count integer;
  distinct_currency_count integer;
  selected_customer_id uuid;
  selected_currency text;
  selected_valid boolean;
  new_invoice_id uuid;
  normalized_series text;
  effective_tax_rate numeric(7,4);
  display_index integer := 0;
  order_row record;
  item_row record;
  item_discount numeric(14,2);
  remaining_discount numeric(14,2);
  item_taxable numeric(14,2);
  item_tax numeric(14,2);
  expected_total numeric(14,2);
  actual_total numeric(14,2);
begin
  if org_id is null or not (public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) or (target_fiscal_document_type='simplified' and cardinality(target_order_ids)=1 and target_order_ids[1]::text=current_setting('app.pos_billing_order',true) and public.pos_billing_context_allowed(org_id)))
    or not public.organization_entitlement_is_enabled(org_id, 'billing.invoicing', now()) then
    raise exception 'billing_not_authorized' using errcode = '42501';
  end if;

  if target_fiscal_document_type is null then
    raise exception 'billing_invalid_document_type' using errcode = '22023';
  end if;
  if target_fiscal_document_type = 'ordinary' then
    if target_recipient_snapshot is not null then
      raise exception 'billing_recipient_invalid' using errcode = '22023';
    end if;
  else
    recipient := public.normalize_billing_recipient_snapshot(target_recipient_snapshot);
    if target_order_ids is null or cardinality(target_order_ids) <> 1 then
      raise exception 'billing_invalid_orders' using errcode = '22023';
    end if;
  end if;

  if target_order_ids is null
    or cardinality(target_order_ids) < 1
    or cardinality(target_order_ids) > 50
    or cardinality(target_order_ids) <> (
      select count(distinct selected_id) from unnest(target_order_ids) selected_id
    )
  then
    raise exception 'billing_invalid_orders' using errcode = '22023';
  end if;

  -- Serialize competing preparations on canonical order rows in stable order.
  -- The unchanged active-link unique index is still the final authority.
  perform customer_order.id from public.orders customer_order
  where customer_order.organization_id = org_id and customer_order.id = any(target_order_ids)
  order by customer_order.id for update;
  if target_fiscal_document_type = 'simplified' and exists (
    select 1 from public.orders o where o.organization_id = org_id
      and o.id = any(target_order_ids) and o.production_status in ('draft','cancelled')
  ) then
    raise exception 'billing_invalid_orders' using errcode = '22023';
  end if;

  select
    count(*),
    count(distinct customer_order.customer_id),
    count(distinct customer_order.currency),
    min(customer_order.customer_id::text)::uuid,
    min(customer_order.currency),
    bool_and(customer_order.is_active and customer_order.production_status <> 'cancelled')
  into
    selected_count,
    distinct_customer_count,
    distinct_currency_count,
    selected_customer_id,
    selected_currency,
    selected_valid
  from public.orders customer_order
  where customer_order.organization_id = org_id
    and customer_order.id = any(target_order_ids);

  if selected_count <> cardinality(target_order_ids)
    or distinct_customer_count <> 1
    or distinct_currency_count <> 1
    or not coalesce(selected_valid, false)
  then
    raise exception 'billing_invalid_orders' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.invoice_orders invoice_order
    where invoice_order.order_id = any(target_order_ids)
      and invoice_order.is_active
  ) then
    raise exception 'billing_order_already_invoiced' using errcode = '55000';
  end if;

  if target_fiscal_document_type = 'ordinary' then
  select
    upper(btrim(coalesce(target_series, settings.default_series, 'A'))),
    round(coalesce(target_tax_rate, settings.default_tax_rate, 0), 4)
  into normalized_series, effective_tax_rate
  from (select 1) seed
  left join public.organization_billing_settings settings
    on settings.organization_id = org_id;

  else
    -- Persist a preparation only, despite the disabled issuance flag. Never
    -- infer or allocate a series; Owner must have reserved it through 001D.
    select settings.simplified_series, round(settings.default_tax_rate,4)
    into normalized_series, effective_tax_rate
    from public.organization_billing_settings settings
    where settings.organization_id = org_id for share;
    if normalized_series is null or effective_tax_rate is null then
      raise exception 'billing_simplified_series_required' using errcode = '22023';
    end if;
    if (target_series is not null and upper(btrim(target_series)) <> normalized_series)
      or (target_tax_rate is not null and round(target_tax_rate,4) <> effective_tax_rate) then
      raise exception 'billing_invalid_tax_or_series' using errcode = '22023';
    end if;
  end if;

  if normalized_series !~ '^[A-Z0-9-]{1,12}$'
    or effective_tax_rate < 0
    or effective_tax_rate > 100
  then
    raise exception 'billing_invalid_tax_or_series' using errcode = '22023';
  end if;

  perform set_config('app.billing_mutation', 'on', true);

  insert into public.invoices (
    organization_id,
    fiscal_document_type,
    recipient_snapshot_mode,
    customer_id,
    series,
    currency,
    prices_include_tax,
    notes,
    issuer_legal_name,
    issuer_tax_id,
    issuer_address_line1,
    issuer_address_line2,
    issuer_city,
    issuer_region,
    issuer_postal_code,
    issuer_country_code,
    issuer_email,
    issuer_phone,
    issuer_logo_path,
    customer_name,
    customer_tax_id,
    customer_address_line1,
    customer_address_line2,
    customer_city,
    customer_postal_code,
    customer_country_code,
    customer_email,
    created_by,
    updated_by
  )
  select
    org_id,
    target_fiscal_document_type,
    case when target_fiscal_document_type = 'ordinary' then 'registered' else recipient ->> 'recipient_snapshot_mode' end,
    case when target_fiscal_document_type = 'ordinary' then customer.id
      when recipient ->> 'recipient_snapshot_mode' = 'identified'
        and customer.customer_code is distinct from 'WALKIN-SHARED' then customer.id
      else null end,
    normalized_series,
    selected_currency,
    true,
    nullif(btrim(target_notes), ''),
    coalesce(settings.issuer_legal_name, branding.commercial_name, organization.name),
    settings.issuer_tax_id,
    coalesce(settings.issuer_address_line1, branding.business_address),
    settings.issuer_address_line2,
    settings.issuer_city,
    settings.issuer_region,
    settings.issuer_postal_code,
    settings.issuer_country_code,
    coalesce(settings.issuer_email, branding.support_email),
    coalesce(settings.issuer_phone, branding.support_phone),
    branding.logo_path,
    case when target_fiscal_document_type = 'ordinary' then
      case when customer.customer_type = 'business'
        then coalesce(nullif(customer.company_name, ''), customer.display_name) else customer.display_name end
      else recipient ->> 'customer_name' end,
    case when target_fiscal_document_type = 'ordinary' then customer.tax_id else recipient ->> 'customer_tax_id' end,
    case when target_fiscal_document_type = 'ordinary' then customer.billing_address_line1 else recipient ->> 'customer_address_line1' end,
    case when target_fiscal_document_type = 'ordinary' then customer.billing_address_line2 else recipient ->> 'customer_address_line2' end,
    case when target_fiscal_document_type = 'ordinary' then customer.billing_city else recipient ->> 'customer_city' end,
    case when target_fiscal_document_type = 'ordinary' then customer.billing_postal_code else recipient ->> 'customer_postal_code' end,
    case when target_fiscal_document_type = 'ordinary' then customer.billing_country_code else recipient ->> 'customer_country_code' end,
    case when target_fiscal_document_type = 'ordinary' then customer.email else recipient ->> 'customer_email' end,
    actor_id,
    actor_id
  from public.customers customer
  join public.organizations organization on organization.id = org_id
  left join public.organization_billing_settings settings on settings.organization_id = org_id
  left join public.organization_branding branding on branding.organization_id = org_id
  where customer.organization_id = org_id
    and customer.id = selected_customer_id
  returning id into new_invoice_id;

  if new_invoice_id is null then
    raise exception 'billing_invalid_customer' using errcode = '22023';
  end if;

  insert into public.invoice_orders (organization_id, invoice_id, order_id)
  select org_id, new_invoice_id, customer_order.id
  from public.orders customer_order
  where customer_order.organization_id = org_id
    and customer_order.id = any(target_order_ids);

  for order_row in
    select customer_order.id, customer_order.discount_amount, customer_order.subtotal
    from public.orders customer_order
    where customer_order.organization_id = org_id
      and customer_order.id = any(target_order_ids)
    order by customer_order.created_at, customer_order.id
  loop
    if not exists (
      select 1 from public.order_items source_item
      where source_item.organization_id = org_id
        and source_item.order_id = order_row.id
        and source_item.is_active
    ) then
      raise exception 'billing_order_without_items' using errcode = '22023';
    end if;

    remaining_discount := order_row.discount_amount;

    for item_row in
      select
        source_item.*,
        row_number() over (order by source_item.sort_order, source_item.created_at, source_item.id) as item_position,
        count(*) over () as item_count
      from public.order_items source_item
      where source_item.organization_id = org_id
        and source_item.order_id = order_row.id
        and source_item.is_active
      order by source_item.sort_order, source_item.created_at, source_item.id
    loop
      display_index := display_index + 1;
      item_discount := case
        when item_row.item_position = item_row.item_count then remaining_discount
        when order_row.subtotal = 0 then 0
        else least(
          remaining_discount,
          round(order_row.discount_amount * item_row.line_total / order_row.subtotal, 2)
        )
      end;
      remaining_discount := round(remaining_discount - item_discount, 2);
      item_taxable := round((item_row.line_total - item_discount) / (1 + effective_tax_rate / 100), 2);
      item_tax := item_row.line_total - item_discount - item_taxable;

      insert into public.invoice_items (
        organization_id,
        invoice_id,
        source_order_id,
        source_order_item_id,
        description,
        unit_type,
        quantity,
        unit_price,
        line_subtotal,
        discount_amount,
        taxable_base,
        tax_rate,
        tax_amount,
        line_total,
        prices_include_tax,
        display_order
      ) values (
        org_id,
        new_invoice_id,
        order_row.id,
        item_row.id,
        item_row.description,
        item_row.unit_type,
        item_row.quantity,
        item_row.unit_price,
        item_row.line_total,
        item_discount,
        item_taxable,
        effective_tax_rate,
        item_tax,
        item_row.line_total - item_discount,
        true,
        display_index
      );
    end loop;
  end loop;

  update public.invoices invoice
  set subtotal = totals.subtotal,
      discount_total = totals.discount_total,
      taxable_base = totals.taxable_base,
      tax_total = totals.tax_total,
      total = totals.total
  from (
    select
      round(sum(item.line_subtotal), 2) as subtotal,
      round(sum(item.discount_amount), 2) as discount_total,
      round(sum(item.taxable_base), 2) as taxable_base,
      round(sum(item.tax_amount), 2) as tax_total,
      round(sum(item.line_total), 2) as total
    from public.invoice_items item
    where item.organization_id = org_id
      and item.invoice_id = new_invoice_id
  ) totals
  where invoice.organization_id = org_id
    and invoice.id = new_invoice_id;

  select round(sum(customer_order.total), 2)
  into expected_total
  from public.orders customer_order
  where customer_order.organization_id = org_id
    and customer_order.id = any(target_order_ids);

  select invoice.total into actual_total
  from public.invoices invoice
  where invoice.organization_id = org_id and invoice.id = new_invoice_id;

  if actual_total is distinct from expected_total then
    raise exception 'billing_order_total_mismatch' using errcode = '22023';
  end if;

  return new_invoice_id;
exception when unique_violation then
  raise exception 'billing_order_already_invoiced' using errcode = '55000';
end;
$$;

create or replace function public.protect_billing_invoice_payment_link()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  source_payment public.payments%rowtype;
  target_invoice public.invoices%rowtype;
  target_active boolean;
  already_attributed numeric(12,2);
begin
  if tg_op <> 'INSERT' then
    raise exception 'billing_payment_link_immutable' using errcode = '55000';
  end if;
  if current_setting('app.billing_advance_link_mutation', true) is distinct from 'on'
    or new.organization_id is distinct from public.app_current_organization_id()
    or not (public.has_organization_role(new.organization_id,
      array['owner','manager']::public.app_role[]) or (new.order_id::text=current_setting('app.pos_billing_order',true) and public.pos_billing_context_allowed(new.organization_id)))
    or not public.organization_entitlement_is_enabled(
      new.organization_id, 'billing.invoicing', now()) then
    raise exception 'billing_payment_link_not_authorized' using errcode = '42501';
  end if;
  select * into source_payment from public.payments p
    where p.organization_id = new.organization_id and p.order_id = new.order_id
      and p.id = new.payment_id for share;
  if source_payment.id is null or source_payment.status <> 'confirmed'
    or source_payment.channel <> 'pos' or source_payment.pos_session_id is null
    or new.attributed_amount is distinct from source_payment.amount then
    raise exception 'billing_payment_link_invalid_payment' using errcode = '22023';
  end if;
  select i.* into target_invoice from public.invoices i
    where i.organization_id = new.organization_id and i.id = new.invoice_id
    for update;
  select l.is_active into target_active from public.invoice_orders l
    where l.organization_id = new.organization_id and l.invoice_id = new.invoice_id
      and l.order_id = new.order_id and l.billing_link_role = new.billing_link_role;
  if target_invoice.id is null or target_invoice.document_status = 'cancelled'
    or target_active is distinct from true then
    raise exception 'billing_payment_link_invalid_invoice' using errcode = '22023';
  end if;
  select coalesce(sum(l.attributed_amount),0) into already_attributed
    from public.billing_invoice_payment_links l
    where l.organization_id = new.organization_id and l.invoice_id = new.invoice_id;
  if already_attributed + new.attributed_amount > target_invoice.total then
    raise exception 'billing_payment_link_exceeds_invoice' using errcode = '22023';
  end if;
  return new;
end;
$$;

create or replace function public.protect_billing_advance_event_declaration()
returns trigger language plpgsql set search_path = public, pg_temp as $$
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
    or not (public.has_organization_role(new.organization_id,
      array['owner','manager']::public.app_role[]) or (new.order_id::text=current_setting('app.pos_billing_order',true) and public.pos_billing_context_allowed(new.organization_id)))
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

create or replace function public.protect_billing_service_declaration()
returns trigger language plpgsql set search_path = public, pg_temp as $$
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
      or not (public.has_organization_role(new.organization_id,
        array['owner','manager']::public.app_role[]) or (new.pos_billing_order_snapshot->>'order_id'=current_setting('app.pos_billing_order',true) and public.pos_billing_context_allowed(new.organization_id)))
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

create or replace function public.pos_billing_declare_advance_internal(target_order_id uuid,
  target_payment_id uuid, target_confirmed boolean)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  org_id uuid := public.app_current_organization_id();
  existing public.billing_advance_event_declarations%rowtype;
begin
  if org_id is null or auth.uid() is null
    or not (public.has_organization_role(org_id,array['owner','manager']::public.app_role[]) or public.pos_billing_context_allowed(org_id))
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

revoke all on function public.pos_billing_declare_advance_internal(uuid,uuid,boolean) from public,anon,authenticated,service_role;

create or replace function public.pos_billing_issue_advance_internal(target_final_draft_id uuid,
  target_payment_id uuid, target_operation_scope text,
  target_recipient_requirement text, target_confirmed boolean)
returns table(invoice_id uuid, invoice_number text)
language plpgsql security definer set search_path = public, pg_temp as $$
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
    or not (public.has_organization_role(org_id,array['owner','manager']::public.app_role[]) or public.pos_billing_context_allowed(org_id))
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
    update public.invoices set pos_billing_order_snapshot=current_setting('app.pos_billing_snapshot',true)::jsonb,
      notes=full_draft.notes, document_status='issued',billing_event_kind='advance',
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
  update public.invoices set pos_billing_order_snapshot=current_setting('app.pos_billing_snapshot',true)::jsonb,
      notes=full_draft.notes, document_status='issued',billing_event_kind='advance',
    issue_date=local_today,issued_at=now(),invoice_number=fiscal_number,
    sequence_number=next_sequence,updated_by=actor_id,
    advance_operation_scope=target_operation_scope,
    advance_recipient_requirement=target_recipient_requirement,
    advance_declared_by=actor_id,advance_declared_at=now()
    where organization_id=org_id and id=advance_id;
  return query select advance_id,fiscal_number;
end;
$$;

revoke all on function public.pos_billing_issue_advance_internal(uuid,uuid,text,text,boolean) from public,anon,authenticated,service_role;

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
  return query select target_final_draft_id,fiscal_number;
end;
$$;

revoke all on function public.pos_billing_issue_final_internal(uuid,uuid,date,text,text,boolean) from public,anon,authenticated,service_role;


create function public.issue_pos_billing_payment_document(target_order_id uuid,target_payment_id uuid,
 target_event text,target_recipient text,target_confirmed boolean,target_laundry_scope boolean,
 target_service_performed_on date default null)
returns table(invoice_id uuid,invoice_number text)
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 org uuid:=public.app_current_organization_id(); actor uuid:=auth.uid();
 ord public.orders%rowtype; pay public.payments%rowtype; prior public.billing_invoice_payment_links%rowtype;
 doc public.invoices%rowtype; settings public.organization_billing_settings%rowtype;
 customer public.customers%rowtype; draft_id uuid; recipient jsonb; snapshot jsonb;
 item_snapshot jsonb; issued record; p record;
begin
 perform public.require_shop_terminal_access(org);
 if actor is null or not public.organization_entitlement_is_enabled(org,'billing.invoicing',now()) then
  raise exception 'pos_billing_not_authorized' using errcode='42501'; end if;
 if current_setting('transaction_isolation')<>'read committed' then
  raise exception 'pos_billing_read_committed_required' using errcode='25000'; end if;
 if target_confirmed is distinct from true or target_laundry_scope is distinct from true
   or target_event is null or target_event not in ('advance','final')
   or target_recipient is null or target_recipient not in ('consumer','consumer_identified','business')
   or (target_event='final' and target_service_performed_on is null) then
  raise exception 'pos_billing_confirmation_required' using errcode='22023'; end if;
 -- Same payment -> order -> invoice protocol as refunds and recovered issuers.
 for p in select id from public.payments where organization_id=org and order_id=target_order_id order by id for share loop null; end loop;
 select * into ord from public.orders where organization_id=org and id=target_order_id for update;
 select * into pay from public.payments where organization_id=org and order_id=target_order_id and id=target_payment_id;
 if ord.id is null or pay.id is null then raise exception 'pos_billing_invalid_payment' using errcode='22023'; end if;
 select * into prior from public.billing_invoice_payment_links where organization_id=org and payment_id=target_payment_id;
 if prior.payment_id is not null then
  select * into doc from public.invoices where organization_id=org and id=prior.invoice_id;
  if prior.order_id is distinct from target_order_id or doc.document_status<>'issued'
    or (target_event='advance' and (doc.billing_event_kind<>'advance' or doc.advance_recipient_requirement is distinct from target_recipient))
    or (target_event='final' and (doc.billing_event_kind<>'service' or doc.fiscal_recipient_requirement is distinct from target_recipient
      or doc.service_performed_on is distinct from target_service_performed_on)) then
   raise exception 'pos_billing_request_conflict' using errcode='23505'; end if;
  return query select doc.id,doc.invoice_number; return;
 end if;
 select * into settings from public.organization_billing_settings where organization_id=org for share;
 if settings.pos_billing_payment_link_enabled is distinct from true then
  raise exception 'pos_billing_disabled' using errcode='55000'; end if;
 if not ord.is_active or ord.production_status in ('draft','cancelled') or ord.currency<>'EUR'
   or pay.status<>'confirmed' or pay.channel<>'pos' or pay.pos_session_id is null
   or pay.refunded_from_payment_id is not null then raise exception 'pos_billing_invalid_payment' using errcode='22023'; end if;
 -- An advance needs explicit confirmation of an unperformed service, plus the
 -- same recorded chronology as Phase A. Settlement alone never declares service.
 if target_event='advance' and (ord.received_at is null or pay.paid_at<ord.received_at
   or ord.production_status<>'received' or ord.completed_at is not null
   or exists(select 1 from public.order_status_history h where h.organization_id=org and h.order_id=ord.id
      and h.to_status not in ('draft','received'))) then
  raise exception 'pos_billing_service_review_required' using errcode='55000'; end if;
 select * into customer from public.customers where organization_id=org and id=ord.customer_id;
 if customer.id is null or (customer.customer_type='business' and target_recipient<>'business')
   or (customer.customer_type<>'business' and target_recipient='business') then
  raise exception 'billing_customer_configuration_required' using errcode='22023'; end if;
 recipient:=jsonb_build_object('recipient_snapshot_mode','anonymous','customer_id',null,
  'customer_name',null,'customer_tax_id',null,'customer_address_line1',null,'customer_address_line2',null,
  'customer_city',null,'customer_postal_code',null,'customer_country_code',null,'customer_email',null);
 if target_recipient<>'consumer' then
  recipient:=recipient||jsonb_build_object('recipient_snapshot_mode','identified',
   'customer_name',coalesce(nullif(customer.company_name,''),customer.display_name),'customer_tax_id',customer.tax_id,
   'customer_address_line1',customer.billing_address_line1,'customer_city',customer.billing_city,
   'customer_postal_code',customer.billing_postal_code,'customer_country_code',customer.billing_country_code);
 end if;
 recipient:=public.normalize_billing_recipient_snapshot(recipient);
 perform set_config('app.pos_billing_org',org::text,true);
 perform set_config('app.pos_billing_order',ord.id::text,true);
 perform set_config('app.pos_billing_invoice_ids','',true);
 select i.* into doc from public.invoice_orders l join public.invoices i on i.organization_id=l.organization_id and i.id=l.invoice_id
  where l.organization_id=org and l.order_id=ord.id and l.billing_link_role='final' and l.is_active for update of i;
 if doc.id is null then
  if target_event='final' then raise exception 'pos_billing_advance_required' using errcode='55000'; end if;
  draft_id:=public.create_billing_draft_internal(array[ord.id],settings.simplified_series,settings.default_tax_rate,
   ord.customer_notes,'simplified',recipient);
  select * into doc from public.invoices where organization_id=org and id=draft_id;
  select jsonb_agg(jsonb_build_object('id',it.id,'description',it.description,'quantity',it.quantity,'unitType',it.unit_type,
    'unitPrice',it.unit_price,'lineTotal',it.line_total) order by it.display_order,it.id) into item_snapshot
    from public.invoice_items it where it.organization_id=org and it.invoice_id=draft_id;
  snapshot:=jsonb_build_object('workflow','pos_billing_payment_link','order_id',ord.id,'order_number',ord.order_number,
   'created_at',ord.created_at,'due_at',ord.due_at,'customer_name',coalesce(doc.customer_name,customer.display_name),
   'customer_notes',ord.customer_notes,'currency',ord.currency,'subtotal',doc.subtotal,'discount',doc.discount_total,'total',doc.total,'items',item_snapshot);
  perform set_config('app.billing_mutation','on',true);
  update public.invoices set pos_billing_order_snapshot=snapshot where organization_id=org and id=draft_id;
 else
  draft_id:=doc.id;
  if doc.document_status<>'draft' or doc.fiscal_document_type<>'simplified' or doc.pos_billing_order_snapshot is null
    or doc.pos_billing_order_snapshot->>'order_id'<>ord.id::text then
   raise exception 'billing_fiscal_history_review_required' using errcode='55000'; end if;
  if doc.recipient_snapshot_mode is distinct from recipient->>'recipient_snapshot_mode'
    or (target_recipient<>'consumer' and (doc.customer_name is distinct from recipient->>'customer_name'
      or doc.customer_tax_id is distinct from recipient->>'customer_tax_id')) then
   raise exception 'pos_billing_recipient_conflict' using errcode='23505'; end if;
  perform set_config('app.pos_billing_invoice_ids',draft_id::text,true);
  snapshot:=doc.pos_billing_order_snapshot;
 end if;
 perform set_config('app.pos_billing_snapshot',snapshot::text,true);
 if target_event='advance' then
  perform public.pos_billing_declare_advance_internal(ord.id,pay.id,true);
  select * into issued from public.pos_billing_issue_advance_internal(draft_id,pay.id,'local_laundry_dry_cleaning',target_recipient,true);
 else
  select * into issued from public.pos_billing_issue_final_internal(draft_id,pay.id,target_service_performed_on,'local_laundry_dry_cleaning',target_recipient,true);
 end if;
 perform set_config('app.pos_billing_org','',true); perform set_config('app.pos_billing_order','',true);
 perform set_config('app.pos_billing_invoice_ids','',true); perform set_config('app.pos_billing_snapshot','',true);
 perform set_config('app.billing_mutation','off',true); perform set_config('app.billing_advance_issue','off',true);
 perform set_config('app.billing_advance_link_mutation','off',true); perform set_config('app.billing_advance_event_mutation','off',true);
 perform set_config('app.billing_simplified_service_issue','off',true); perform set_config('app.billing_final_link_mutation','off',true);
 return query select issued.invoice_id,issued.invoice_number;
end;
$$;
revoke all on function public.issue_pos_billing_payment_document(uuid,uuid,text,text,boolean,boolean,date) from public,anon,authenticated,service_role;
grant execute on function public.issue_pos_billing_payment_document(uuid,uuid,text,text,boolean,boolean,date) to authenticated;

-- Order-scoped read, not a Billing management grant. Reprint survives disabling issuance.
create function public.get_pos_billing_payment_documents(target_order_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare org uuid:=public.app_current_organization_id(); result jsonb;
begin
 perform public.require_shop_terminal_access(org);
 if auth.uid() is null or not public.organization_entitlement_is_enabled(org,'billing.invoicing',now())
  or not public.organization_entitlement_is_enabled(org,'printing',now()) then
  raise exception 'pos_billing_not_authorized' using errcode='42501'; end if;
 if not exists(select 1 from public.orders where organization_id=org and id=target_order_id) then
  raise exception 'pos_billing_order_not_found' using errcode='22023'; end if;
 select jsonb_build_object('enabled',coalesce((select pos_billing_payment_link_enabled from public.organization_billing_settings where organization_id=org),false),
  'documents',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'number',i.invoice_number,'issuedAt',i.issued_at,
    'paymentId',l.payment_id,'role',l.billing_link_role,'event',i.billing_event_kind,'total',i.total,'base',i.taxable_base,'tax',i.tax_total,
    'roundingDelta',i.operation_rounding_base_delta,'snapshot',i.pos_billing_order_snapshot,
    'issuer',jsonb_build_object('name',i.issuer_legal_name,'taxId',i.issuer_tax_id,'address',concat_ws(' · ',i.issuer_address_line1,i.issuer_address_line2,i.issuer_city,i.issuer_postal_code,i.issuer_country_code)))
     order by i.issued_at,i.id) from public.billing_invoice_payment_links l join public.invoices i on i.organization_id=l.organization_id and i.id=l.invoice_id
    where l.organization_id=org and l.order_id=target_order_id and i.document_status='issued'),'[]'::jsonb)) into result;
 return result;
end;
$$;
revoke all on function public.get_pos_billing_payment_documents(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_pos_billing_payment_documents(uuid) to authenticated;
commit;
