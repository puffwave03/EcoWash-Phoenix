-- BILLING-TAX-INCLUSIVE-PRICING-001: correct current Billing snapshots without changing Orders or payments.
-- Refuse draft conversion if persisted gross lines cannot reconcile to each linked Order.
-- Hold source amounts stable while the preflight and conversion run in this migration transaction.
begin;

lock table public.invoices, public.invoice_items, public.invoice_orders, public.orders in share mode;

do $$
begin
  if exists (
    select 1
    from public.invoices invoice
    cross join lateral (
      select count(*) as item_count,
        round(sum(item.line_subtotal), 2) as subtotal,
        round(sum(item.discount_amount), 2) as discount_total,
        round(sum(item.line_subtotal - item.discount_amount), 2) as gross_total
      from public.invoice_items item
      where item.organization_id = invoice.organization_id
        and item.invoice_id = invoice.id
    ) items
    cross join lateral (
      select count(*) as link_count,
        count(*) filter (where link.is_active) as active_count,
        round(sum(source_order.total) filter (where link.is_active), 2) as order_total
      from public.invoice_orders link
      join public.orders source_order
        on source_order.organization_id = link.organization_id
       and source_order.id = link.order_id
      where link.organization_id = invoice.organization_id
        and link.invoice_id = invoice.id
    ) links
    where invoice.document_status = 'draft'
      and (
        items.item_count = 0 or links.link_count = 0
        or links.active_count <> links.link_count
        or items.subtotal <> invoice.subtotal
        or items.discount_total <> invoice.discount_total
        or items.gross_total <> links.order_total
        or exists (
          select 1 from public.invoice_items item
          where item.organization_id = invoice.organization_id
            and item.invoice_id = invoice.id
            and not exists (
              select 1 from public.invoice_orders link
              where link.organization_id = invoice.organization_id
                and link.invoice_id = invoice.id
                and link.order_id = item.source_order_id
                and link.is_active
            )
        )
        or exists (
          select 1
          from public.invoice_orders link
          join public.orders source_order
            on source_order.organization_id = link.organization_id
           and source_order.id = link.order_id
          where link.organization_id = invoice.organization_id
            and link.invoice_id = invoice.id
            and link.is_active
            and source_order.total <> (
              select coalesce(round(sum(item.line_subtotal - item.discount_amount), 2), 0)
              from public.invoice_items item
              where item.organization_id = invoice.organization_id
                and item.invoice_id = invoice.id
                and item.source_order_id = link.order_id
            )
        )
      )
  ) then
    raise exception 'billing_draft_conversion_unsafe' using errcode = '22023';
  end if;
end;
$$;

alter table public.invoices
  add column prices_include_tax boolean not null default false;
alter table public.invoice_items
  add column prices_include_tax boolean not null default false;

alter table public.invoices drop constraint invoices_amounts_valid;
alter table public.invoice_items drop constraint invoice_items_amounts_valid;

-- Only drafts are mutable. Existing issued/cancelled amounts and item snapshots stay unchanged.
do $$
begin
  perform set_config('app.billing_mutation', 'on', true);

  update public.invoice_items item
  set prices_include_tax = true,
      taxable_base = round((item.line_subtotal - item.discount_amount) / (1 + item.tax_rate / 100), 2),
      tax_amount = item.line_subtotal - item.discount_amount
        - round((item.line_subtotal - item.discount_amount) / (1 + item.tax_rate / 100), 2),
      line_total = item.line_subtotal - item.discount_amount
  from public.invoices invoice
  where invoice.organization_id = item.organization_id
    and invoice.id = item.invoice_id
    and invoice.document_status = 'draft';

  update public.invoices invoice
  set prices_include_tax = true,
      taxable_base = totals.taxable_base,
      tax_total = totals.tax_total,
      total = totals.total
  from (
    select item.organization_id, item.invoice_id,
      round(sum(item.taxable_base), 2) as taxable_base,
      round(sum(item.tax_amount), 2) as tax_total,
      round(sum(item.line_total), 2) as total
    from public.invoice_items item
    group by item.organization_id, item.invoice_id
  ) totals
  where invoice.organization_id = totals.organization_id
    and invoice.id = totals.invoice_id
    and invoice.document_status = 'draft';
end;
$$;

alter table public.invoices alter column prices_include_tax set default true;
alter table public.invoice_items alter column prices_include_tax set default true;

alter table public.invoices add constraint invoices_amounts_valid check (
  subtotal >= 0 and discount_total >= 0 and discount_total <= subtotal
  and taxable_base >= 0 and tax_total >= 0 and total >= 0
  and (
    (not prices_include_tax and taxable_base = subtotal - discount_total
      and total = taxable_base + tax_total)
    or (prices_include_tax and total = subtotal - discount_total
      and total = taxable_base + tax_total)
  )
);

alter table public.invoice_items add constraint invoice_items_amounts_valid check (
  quantity > 0 and unit_price >= 0
  and line_subtotal = round(quantity * unit_price, 2)
  and discount_amount >= 0 and discount_amount <= line_subtotal
  and tax_rate between 0 and 100 and tax_amount >= 0 and line_total >= 0
  and (
    (not prices_include_tax and taxable_base = line_subtotal - discount_amount
      and tax_amount = round(taxable_base * tax_rate / 100, 2)
      and line_total = taxable_base + tax_amount)
    or (prices_include_tax and line_total = line_subtotal - discount_amount
      and taxable_base = round(line_total / (1 + tax_rate / 100), 2)
      and tax_amount = line_total - taxable_base
      and line_total = taxable_base + tax_amount)
  )
);

create or replace function public.protect_billing_invoice_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('app.billing_mutation', true), '') <> 'on' then
    raise exception 'billing_rpc_required' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    if old.document_status <> 'draft' then
      raise exception 'billing_issued_delete_forbidden' using errcode = '55000';
    end if;
    return old;
  end if;

  if old.document_status <> 'draft' and (
    new.organization_id is distinct from old.organization_id
    or new.customer_id is distinct from old.customer_id
    or new.invoice_number is distinct from old.invoice_number
    or new.series is distinct from old.series
    or new.sequence_number is distinct from old.sequence_number
    or new.issue_date is distinct from old.issue_date
    or new.due_date is distinct from old.due_date
    or new.currency is distinct from old.currency
    or new.subtotal is distinct from old.subtotal
    or new.discount_total is distinct from old.discount_total
    or new.taxable_base is distinct from old.taxable_base
    or new.tax_total is distinct from old.tax_total
    or new.total is distinct from old.total
    or new.prices_include_tax is distinct from old.prices_include_tax
    or new.issuer_legal_name is distinct from old.issuer_legal_name
    or new.issuer_tax_id is distinct from old.issuer_tax_id
    or new.issuer_address_line1 is distinct from old.issuer_address_line1
    or new.issuer_address_line2 is distinct from old.issuer_address_line2
    or new.issuer_city is distinct from old.issuer_city
    or new.issuer_region is distinct from old.issuer_region
    or new.issuer_postal_code is distinct from old.issuer_postal_code
    or new.issuer_country_code is distinct from old.issuer_country_code
    or new.customer_name is distinct from old.customer_name
    or new.customer_tax_id is distinct from old.customer_tax_id
    or new.customer_address_line1 is distinct from old.customer_address_line1
    or new.customer_address_line2 is distinct from old.customer_address_line2
    or new.customer_city is distinct from old.customer_city
    or new.customer_postal_code is distinct from old.customer_postal_code
    or new.customer_country_code is distinct from old.customer_country_code
  ) then
    raise exception 'billing_issued_snapshot_immutable' using errcode = '55000';
  end if;

  return new;
end;
$$;

create or replace function public.create_billing_draft(
  target_order_ids uuid[],
  target_series text default null,
  target_tax_rate numeric default null,
  target_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
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
  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'billing_not_authorized' using errcode = '42501';
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

  select
    upper(btrim(coalesce(target_series, settings.default_series, 'A'))),
    round(coalesce(target_tax_rate, settings.default_tax_rate, 0), 4)
  into normalized_series, effective_tax_rate
  from (select 1) seed
  left join public.organization_billing_settings settings
    on settings.organization_id = org_id;

  if normalized_series !~ '^[A-Z0-9-]{1,12}$'
    or effective_tax_rate < 0
    or effective_tax_rate > 100
  then
    raise exception 'billing_invalid_tax_or_series' using errcode = '22023';
  end if;

  perform set_config('app.billing_mutation', 'on', true);

  insert into public.invoices (
    organization_id,
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
    customer.id,
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
    case when customer.customer_type = 'business'
      then coalesce(nullif(customer.company_name, ''), customer.display_name)
      else customer.display_name
    end,
    customer.tax_id,
    customer.billing_address_line1,
    customer.billing_address_line2,
    customer.billing_city,
    customer.billing_postal_code,
    customer.billing_country_code,
    customer.email,
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
  actor_id uuid := auth.uid();
  org_id uuid := public.app_current_organization_id();
  normalized_series text := upper(btrim(coalesce(target_series, '')));
  effective_tax_rate numeric(7,4) := round(target_tax_rate, 4);
begin
  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'billing_not_authorized' using errcode = '42501';
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

revoke all on function public.protect_billing_invoice_mutation() from public, anon, authenticated;
revoke all on function public.create_billing_draft(uuid[], text, numeric, text) from public, anon, authenticated;
revoke all on function public.update_billing_draft(uuid, date, date, text, numeric, text) from public, anon, authenticated;
revoke all on function public.issue_billing_invoice(uuid) from public, anon, authenticated;
grant execute on function public.create_billing_draft(uuid[], text, numeric, text) to authenticated;
grant execute on function public.update_billing_draft(uuid, date, date, text, numeric, text) to authenticated;
grant execute on function public.issue_billing_invoice(uuid) to authenticated;

commit;
