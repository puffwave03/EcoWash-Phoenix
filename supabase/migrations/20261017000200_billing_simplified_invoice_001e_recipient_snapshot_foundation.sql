-- 001E LOCAL PROPOSAL ONLY / NOT APPLIED / DRAFT PERSISTENCE, NOT ISSUANCE.
-- Prepare anonymous/explicitly identified recipients in canonical invoices.
-- No new customer, invoice register, numbering, payment allocation or emission.
-- Replace the ordinary-only constraint atomically with draft-only simplified
-- persistence. The settings disabled constraint and counter protections remain.
begin;
set local lock_timeout = '5s';
lock table public.organization_billing_settings, public.invoices, public.invoice_items,
  public.invoice_orders in share row exclusive mode;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.invoices'::regclass
      and conname = 'invoices_fiscal_document_type_ordinary_only' and convalidated)
    or not exists (select 1 from pg_catalog.pg_constraint
      where conrelid = 'public.organization_billing_settings'::regclass
        and conname = 'organization_billing_settings_simplified_disabled' and convalidated) then
    raise exception 'billing_simplified_guards_required' using errcode = '55000';
  end if;
end;
$$;

alter table public.invoices
  drop constraint invoices_fiscal_document_type_ordinary_only,
  add constraint invoices_simplified_draft_only check (
    fiscal_document_type = 'ordinary' or document_status = 'draft'
  ),
  add column recipient_snapshot_mode text not null default 'registered',
  alter column customer_id drop not null,
  alter column customer_name drop not null,
  add constraint invoices_recipient_snapshot_mode_valid check (
    recipient_snapshot_mode in ('registered', 'anonymous', 'identified')
  ),
  add constraint invoices_recipient_snapshot_valid check (
    case when fiscal_document_type = 'ordinary' then
      -- Exactly preserve ordinary NOT NULL requirements, not new fiscal rules.
      recipient_snapshot_mode = 'registered' and customer_id is not null and customer_name is not null
    when recipient_snapshot_mode = 'registered' then
      customer_id is not null and customer_name is not null
    when recipient_snapshot_mode = 'anonymous' then
      customer_id is null and customer_name is null and customer_tax_id is null
      and customer_address_line1 is null and customer_address_line2 is null
      and customer_city is null and customer_postal_code is null
      and customer_country_code is null and customer_email is null
    when recipient_snapshot_mode = 'identified' then
      -- Explicit per-document identity does not require a permanent customer.
      -- NULL must fail, not make a CHECK expression unknown/permissive.
      coalesce(length(btrim(customer_name)), 0) > 0
      and coalesce(length(btrim(customer_tax_id)), 0) > 0
      and coalesce(length(btrim(customer_address_line1)), 0) > 0
      and coalesce(length(btrim(customer_city)), 0) > 0
      and coalesce(length(btrim(customer_postal_code)), 0) > 0
      and coalesce(customer_country_code::text ~ '^[A-Z]{2}$', false)
    else false end
  );

-- Retain the same-organization customer FK and WALKIN-SHARED trigger unchanged.
-- This additive column must not escape the existing historical snapshot guard.
create function public.protect_billing_recipient_snapshot_mode()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.document_status <> 'draft'
    and (new.recipient_snapshot_mode is distinct from old.recipient_snapshot_mode
      or (old.fiscal_document_type = 'simplified'
        and new.customer_email is distinct from old.customer_email)) then
    raise exception 'billing_issued_snapshot_immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;
create trigger invoices_recipient_snapshot_immutable
before update on public.invoices
for each row execute function public.protect_billing_recipient_snapshot_mode();
revoke all on function public.protect_billing_recipient_snapshot_mode() from public, anon, authenticated;


-- Internal parser: identical persisted field contract to the server snapshot.
create function public.normalize_billing_recipient_snapshot(target_snapshot jsonb)
returns jsonb language plpgsql immutable set search_path = public as $$
declare
  field_name text;
  maximum integer;
  normalized jsonb := target_snapshot;
  required_keys text[] := array['recipient_snapshot_mode','customer_id','customer_name',
    'customer_tax_id','customer_address_line1','customer_address_line2','customer_city',
    'customer_postal_code','customer_country_code','customer_email'];
begin
  if target_snapshot is null or jsonb_typeof(target_snapshot) <> 'object' then
    raise exception 'billing_recipient_invalid' using errcode = '22023';
  end if;
  if not (target_snapshot ?& required_keys) or target_snapshot - required_keys <> '{}'::jsonb
    or target_snapshot -> 'customer_id' is distinct from 'null'::jsonb
    or target_snapshot -> 'customer_address_line2' is distinct from 'null'::jsonb
    or target_snapshot -> 'customer_email' is distinct from 'null'::jsonb then
    raise exception 'billing_recipient_invalid' using errcode = '22023';
  end if;
  if target_snapshot ->> 'recipient_snapshot_mode' = 'anonymous' then
    if exists (select 1 from jsonb_each(target_snapshot - 'recipient_snapshot_mode') e where e.value <> 'null'::jsonb) then
      raise exception 'billing_recipient_invalid' using errcode = '22023';
    end if;
    return target_snapshot;
  end if;
  if (target_snapshot ->> 'recipient_snapshot_mode') is distinct from 'identified' then
    raise exception 'billing_recipient_invalid' using errcode = '22023';
  end if;
  for field_name, maximum in select * from (values
    ('customer_name',180),('customer_tax_id',80),('customer_address_line1',180),
    ('customer_city',100),('customer_postal_code',24),('customer_country_code',2)) limits(field_name, maximum)
  loop
    if jsonb_typeof(target_snapshot -> field_name) is distinct from 'string'
      or coalesce(length(btrim(target_snapshot ->> field_name)),0) not between 1 and maximum then
      raise exception 'billing_recipient_invalid' using errcode = '22023';
    end if;
    normalized := jsonb_set(normalized, array[field_name], to_jsonb(btrim(target_snapshot ->> field_name)));
  end loop;
  normalized := jsonb_set(normalized, array['customer_country_code'], to_jsonb(upper(normalized ->> 'customer_country_code')));
  if (normalized ->> 'customer_country_code') !~ '^[A-Z]{2}$' then
    raise exception 'billing_recipient_invalid' using errcode = '22023';
  end if;
  return normalized;
end;
$$;
revoke all on function public.normalize_billing_recipient_snapshot(jsonb) from public, anon, authenticated;

-- One canonical item/discount/tax engine for both public signatures. The item
-- allocation/reconciliation section below is unchanged from inclusive pricing.
create function public.create_billing_draft_internal(
  target_order_ids uuid[], target_series text, target_tax_rate numeric, target_notes text,
  target_fiscal_document_type public.billing_fiscal_document_type, target_recipient_snapshot jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
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
  if org_id is null or not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[])
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
revoke all on function public.create_billing_draft_internal(uuid[], text, numeric, text, public.billing_fiscal_document_type, jsonb) from public, anon, authenticated;


-- Preserve the four-argument RPC (including defaults and payload names).
create or replace function public.create_billing_draft(
  target_order_ids uuid[], target_series text default null,
  target_tax_rate numeric default null, target_notes text default null
) returns uuid language sql security definer set search_path = public as $$
  select public.create_billing_draft_internal(target_order_ids, target_series,
    target_tax_rate, target_notes, 'ordinary'::public.billing_fiscal_document_type, null::jsonb);
$$;

-- All six arguments are explicit, so PostgREST cannot confuse the legacy call.
create function public.create_billing_draft(
  target_order_ids uuid[], target_series text, target_tax_rate numeric, target_notes text,
  target_fiscal_document_type public.billing_fiscal_document_type, target_recipient_snapshot jsonb
) returns uuid language sql security definer set search_path = public as $$
  select public.create_billing_draft_internal(target_order_ids, target_series,
    target_tax_rate, target_notes, target_fiscal_document_type, target_recipient_snapshot);
$$;
revoke all on function public.create_billing_draft(uuid[], text, numeric, text, public.billing_fiscal_document_type, jsonb) from public, anon, authenticated;
grant execute on function public.create_billing_draft(uuid[], text, numeric, text, public.billing_fiscal_document_type, jsonb) to authenticated;

create or replace function public.update_billing_draft(
  target_invoice_id uuid,
  target_issue_date date,
  target_due_date date,
  target_series text,
  target_tax_rate numeric,
  target_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_invoice public.invoices%rowtype;
  stored_tax_rate numeric(7,4);
  stored_rate_count integer;
  actor_id uuid := auth.uid();
  org_id uuid := public.app_current_organization_id();
  normalized_series text := upper(btrim(coalesce(target_series, '')));
  effective_tax_rate numeric(7,4) := round(target_tax_rate, 4);
begin
  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'billing_not_authorized' using errcode = '42501';
  end if;

  -- Parent before child locks: recipient and financial edits form one draft edit.
  select * into locked_invoice from public.invoices i
  where i.organization_id = org_id and i.id = target_invoice_id for update;
  if locked_invoice.id is null or locked_invoice.document_status <> 'draft' then
    raise exception 'billing_invalid_draft' using errcode = '22023';
  end if;
  if locked_invoice.fiscal_document_type = 'simplified' then
    -- Recipient/note edits preserve this draft's economic snapshot, including
    -- after a later settings change. Rates/series are not edited by this path.
    select min(item.tax_rate), count(distinct item.tax_rate)
    into stored_tax_rate, stored_rate_count from public.invoice_items item
    where item.organization_id = org_id and item.invoice_id = target_invoice_id;
    if normalized_series is distinct from locked_invoice.series
      or stored_rate_count <> 1 or stored_tax_rate is null
      or effective_tax_rate is distinct from stored_tax_rate then
      raise exception 'billing_invalid_tax_or_series' using errcode = '22023';
    end if;
  end if;

  if target_issue_date is null
    or (target_due_date is not null and target_due_date < target_issue_date)
    or normalized_series !~ '^[A-Z0-9-]{1,12}$'
    or target_tax_rate is null
    or effective_tax_rate < 0
    or effective_tax_rate > 100
  then
    raise exception 'billing_invalid_draft' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.invoices invoice
    where invoice.organization_id = org_id
      and invoice.id = target_invoice_id
      and invoice.document_status = 'draft'
      and invoice.prices_include_tax
  ) then
    raise exception 'billing_invalid_draft' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.invoice_items item
    where item.organization_id = org_id
      and item.invoice_id = target_invoice_id
      and not item.prices_include_tax
  ) then
    raise exception 'billing_invalid_draft' using errcode = '22023';
  end if;

  perform set_config('app.billing_mutation', 'on', true);

  update public.invoice_items item
  set taxable_base = round(item.line_total / (1 + effective_tax_rate / 100), 2),
      tax_rate = effective_tax_rate,
      tax_amount = item.line_total - round(item.line_total / (1 + effective_tax_rate / 100), 2)
  where item.organization_id = org_id
    and item.invoice_id = target_invoice_id;

  update public.invoices invoice
  set issue_date = target_issue_date,
      due_date = target_due_date,
      series = normalized_series,
      taxable_base = totals.taxable_base,
      tax_total = totals.tax_total,
      notes = nullif(btrim(target_notes), ''),
      updated_by = actor_id
  from (
    select round(sum(item.taxable_base), 2) as taxable_base,
           round(sum(item.tax_amount), 2) as tax_total
    from public.invoice_items item
    where item.organization_id = org_id
      and item.invoice_id = target_invoice_id
  ) totals
  where invoice.organization_id = org_id
    and invoice.id = target_invoice_id;
end;
$$;

-- Optional recipient edit is a separate, unambiguous overload of the same RPC.
-- Ordinary callers retain their six-argument update contract unchanged.
create function public.update_billing_draft(
  target_invoice_id uuid, target_issue_date date, target_due_date date,
  target_series text, target_tax_rate numeric, target_notes text,
  target_recipient_snapshot jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare
  org_id uuid := public.app_current_organization_id();
  locked_invoice public.invoices%rowtype;
  recipient jsonb;
  source_customer_id uuid;
  source_count integer;
begin
  if org_id is null or not public.has_organization_role(org_id, array['owner','manager']::public.app_role[])
    or not public.organization_entitlement_is_enabled(org_id, 'billing.invoicing', now()) then
    raise exception 'billing_not_authorized' using errcode = '42501';
  end if;
  select * into locked_invoice from public.invoices i
  where i.organization_id = org_id and i.id = target_invoice_id for update;
  if locked_invoice.id is null or locked_invoice.document_status <> 'draft'
    or locked_invoice.fiscal_document_type <> 'simplified' then
    raise exception 'billing_invalid_draft' using errcode = '22023';
  end if;
  recipient := public.normalize_billing_recipient_snapshot(target_recipient_snapshot);
  select count(*), min(c.id::text)::uuid into source_count, source_customer_id
  from public.invoice_orders link
  join public.orders o on o.organization_id = org_id and o.id = link.order_id
  join public.customers c on c.organization_id = org_id and c.id = o.customer_id
  where link.organization_id = org_id and link.invoice_id = target_invoice_id and link.is_active
    and c.customer_code is distinct from 'WALKIN-SHARED';
  if source_count > 1 then
    raise exception 'billing_invalid_orders' using errcode = '22023';
  end if;

  perform public.update_billing_draft(target_invoice_id, target_issue_date, target_due_date,
    target_series, target_tax_rate, target_notes);
  update public.invoices set
    recipient_snapshot_mode = recipient ->> 'recipient_snapshot_mode',
    customer_id = case when recipient ->> 'recipient_snapshot_mode' = 'identified' then source_customer_id else null end,
    customer_name = recipient ->> 'customer_name',
    customer_tax_id = recipient ->> 'customer_tax_id',
    customer_address_line1 = recipient ->> 'customer_address_line1',
    customer_address_line2 = recipient ->> 'customer_address_line2',
    customer_city = recipient ->> 'customer_city',
    customer_postal_code = recipient ->> 'customer_postal_code',
    customer_country_code = recipient ->> 'customer_country_code',
    customer_email = recipient ->> 'customer_email'
  where organization_id = org_id and id = target_invoice_id;
end;
$$;
revoke all on function public.update_billing_draft(uuid, date, date, text, numeric, text, jsonb) from public, anon, authenticated;
grant execute on function public.update_billing_draft(uuid, date, date, text, numeric, text, jsonb) to authenticated;

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
    raise exception 'billing_simplified_issuance_disabled' using errcode = '55000';
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
    select i.*, coalesce((select round(sum(case when p.status = 'confirmed' then p.amount
          when p.status = 'refunded' then -p.amount else 0 end), 2)
        from public.payments p
        where p.organization_id = org_id and exists (
          select 1 from public.invoice_orders io
          where io.organization_id = org_id and io.invoice_id = i.id and io.order_id = p.order_id
        )), 0) as paid_total
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

-- No issuance counters, invoices or payments are inserted by this migration.
-- New RPCs persist UNNUMBERED DRAFTS only; the settings false CHECK stays active.
-- Existing RLS, same-tenant FKs, WALKIN trigger and active-link uniqueness remain.
commit;
