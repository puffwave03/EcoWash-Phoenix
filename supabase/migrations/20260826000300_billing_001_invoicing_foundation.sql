-- BILLING-001: additive, tenant-scoped invoicing foundation.
-- Orders, order items and payments remain the source of operational and payment truth.

create type public.billing_invoice_document_status as enum ('draft', 'issued', 'cancelled');

create table public.organization_billing_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  issuer_legal_name text,
  issuer_tax_id text,
  issuer_address_line1 text,
  issuer_address_line2 text,
  issuer_city text,
  issuer_region text,
  issuer_postal_code text,
  issuer_country_code char(2),
  issuer_email text,
  issuer_phone text,
  default_series text not null default 'A',
  default_tax_rate numeric(7,4) not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_billing_settings_series_valid check (default_series ~ '^[A-Z0-9-]{1,12}$'),
  constraint organization_billing_settings_tax_valid check (default_tax_rate between 0 and 100),
  constraint organization_billing_settings_country_valid check (
    issuer_country_code is null
    or (issuer_country_code = upper(issuer_country_code) and length(issuer_country_code) = 2)
  )
);

create table public.billing_invoice_number_counters (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  series text not null,
  next_value bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (organization_id, series),
  constraint billing_invoice_number_counters_series_valid check (series ~ '^[A-Z0-9-]{1,12}$'),
  constraint billing_invoice_number_counters_next_valid check (next_value >= 1)
);

create table public.invoices (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  customer_id uuid not null,
  invoice_number text,
  series text not null,
  sequence_number bigint,
  document_status public.billing_invoice_document_status not null default 'draft',
  issue_date date not null default current_date,
  due_date date,
  currency text not null,
  subtotal numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  taxable_base numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  notes text,
  cancellation_reason text,
  issuer_legal_name text,
  issuer_tax_id text,
  issuer_address_line1 text,
  issuer_address_line2 text,
  issuer_city text,
  issuer_region text,
  issuer_postal_code text,
  issuer_country_code char(2),
  issuer_email text,
  issuer_phone text,
  issuer_logo_path text,
  customer_name text not null,
  customer_tax_id text,
  customer_address_line1 text,
  customer_address_line2 text,
  customer_city text,
  customer_postal_code text,
  customer_country_code char(2),
  customer_email text,
  issued_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_customer_same_organization foreign key (
    organization_id,
    customer_id
  ) references public.customers (organization_id, id) on delete restrict,
  constraint invoices_organization_id_id_unique unique (organization_id, id),
  constraint invoices_currency_valid check (currency = upper(currency) and length(currency) = 3),
  constraint invoices_series_valid check (series ~ '^[A-Z0-9-]{1,12}$'),
  constraint invoices_dates_valid check (due_date is null or due_date >= issue_date),
  constraint invoices_amounts_valid check (
    subtotal >= 0
    and discount_total >= 0
    and discount_total <= subtotal
    and taxable_base = subtotal - discount_total
    and tax_total >= 0
    and total = taxable_base + tax_total
  ),
  constraint invoices_number_state_valid check (
    (
      document_status = 'draft'
      and invoice_number is null
      and sequence_number is null
      and issued_at is null
      and cancelled_at is null
      and cancellation_reason is null
    )
    or (
      document_status = 'issued'
      and invoice_number is not null
      and sequence_number is not null
      and issued_at is not null
      and cancelled_at is null
      and cancellation_reason is null
    )
    or (
      document_status = 'cancelled'
      and invoice_number is not null
      and sequence_number is not null
      and issued_at is not null
      and cancelled_at is not null
      and length(btrim(cancellation_reason)) > 0
    )
  )
);

create unique index invoices_number_unique_per_organization
on public.invoices (organization_id, invoice_number)
where invoice_number is not null;

create unique index invoices_sequence_unique_per_organization_series
on public.invoices (organization_id, series, sequence_number)
where sequence_number is not null;

create index invoices_customer_created_idx
on public.invoices (organization_id, customer_id, created_at desc);

create index invoices_status_issue_idx
on public.invoices (organization_id, document_status, issue_date desc);

create unique index order_items_organization_order_id_id_unique
on public.order_items (organization_id, order_id, id);

create table public.invoice_items (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null,
  invoice_id uuid not null,
  source_order_id uuid,
  source_order_item_id uuid,
  description text not null,
  unit_type public.service_unit_type not null,
  quantity numeric(12,3) not null,
  unit_price numeric(14,2) not null,
  line_subtotal numeric(14,2) not null,
  discount_amount numeric(14,2) not null default 0,
  taxable_base numeric(14,2) not null,
  tax_rate numeric(7,4) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  line_total numeric(14,2) not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint invoice_items_invoice_same_organization foreign key (
    organization_id,
    invoice_id
  ) references public.invoices (organization_id, id) on delete cascade,
  constraint invoice_items_source_order_item_consistent check (
    (source_order_id is null and source_order_item_id is null)
    or (source_order_id is not null and source_order_item_id is not null)
  ),
  constraint invoice_items_source_order_item_same_organization foreign key (
    organization_id,
    source_order_id,
    source_order_item_id
  ) references public.order_items (organization_id, order_id, id) on delete restrict,
  constraint invoice_items_description_valid check (length(btrim(description)) > 0),
  constraint invoice_items_amounts_valid check (
    quantity > 0
    and unit_price >= 0
    and line_subtotal = round(quantity * unit_price, 2)
    and discount_amount >= 0
    and discount_amount <= line_subtotal
    and taxable_base = line_subtotal - discount_amount
    and tax_rate between 0 and 100
    and tax_amount = round(taxable_base * tax_rate / 100, 2)
    and line_total = taxable_base + tax_amount
  ),
  constraint invoice_items_piece_quantity_integer check (
    unit_type <> 'piece' or quantity = trunc(quantity)
  )
);

create index invoice_items_invoice_idx
on public.invoice_items (organization_id, invoice_id, display_order, id);

create table public.invoice_orders (
  organization_id uuid not null,
  invoice_id uuid not null,
  order_id uuid not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (invoice_id, order_id),
  constraint invoice_orders_invoice_same_organization foreign key (
    organization_id,
    invoice_id
  ) references public.invoices (organization_id, id) on delete cascade,
  constraint invoice_orders_order_same_organization foreign key (
    organization_id,
    order_id
  ) references public.orders (organization_id, id) on delete restrict
);

create unique index invoice_orders_one_active_invoice_per_order
on public.invoice_orders (order_id)
where is_active;

create index invoice_orders_invoice_idx
on public.invoice_orders (organization_id, invoice_id, is_active);

create trigger organization_billing_settings_set_updated_at
before update on public.organization_billing_settings
for each row execute function public.set_updated_at();

create trigger invoices_set_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

create function public.protect_billing_invoice_mutation()
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

create trigger invoices_controlled_mutation
before update or delete on public.invoices
for each row execute function public.protect_billing_invoice_mutation();

create function public.protect_billing_child_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_invoice_id uuid := case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;
  parent_status public.billing_invoice_document_status;
begin
  if coalesce(current_setting('app.billing_mutation', true), '') <> 'on' then
    raise exception 'billing_rpc_required' using errcode = '42501';
  end if;

  select invoice.document_status
  into parent_status
  from public.invoices invoice
  where invoice.id = parent_invoice_id;

  if parent_status is not null and parent_status <> 'draft' then
    if tg_table_name = 'invoice_orders' and tg_op = 'UPDATE' then
      if old.is_active and not new.is_active then
        return new;
      end if;
    end if;

    raise exception 'billing_issued_snapshot_immutable' using errcode = '55000';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger invoice_items_controlled_mutation
before insert or update or delete on public.invoice_items
for each row execute function public.protect_billing_child_mutation();

create trigger invoice_orders_controlled_mutation
before insert or update or delete on public.invoice_orders
for each row execute function public.protect_billing_child_mutation();

create function public.upsert_organization_billing_settings(
  target_issuer_legal_name text,
  target_issuer_tax_id text,
  target_issuer_address_line1 text,
  target_issuer_address_line2 text,
  target_issuer_city text,
  target_issuer_region text,
  target_issuer_postal_code text,
  target_issuer_country_code text,
  target_issuer_email text,
  target_issuer_phone text,
  target_default_series text,
  target_default_tax_rate numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  org_id uuid := public.app_current_organization_id();
  normalized_series text := upper(btrim(coalesce(target_default_series, 'A')));
  normalized_country text := upper(nullif(btrim(target_issuer_country_code), ''));
begin
  if not public.has_organization_role(org_id, array['owner']::public.app_role[]) then
    raise exception 'billing_settings_not_authorized' using errcode = '42501';
  end if;

  if normalized_series !~ '^[A-Z0-9-]{1,12}$'
    or target_default_tax_rate is null
    or target_default_tax_rate < 0
    or target_default_tax_rate > 100
    or (normalized_country is not null and length(normalized_country) <> 2)
  then
    raise exception 'billing_settings_invalid' using errcode = '22023';
  end if;

  insert into public.organization_billing_settings (
    organization_id,
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
    default_series,
    default_tax_rate,
    created_by,
    updated_by
  ) values (
    org_id,
    nullif(btrim(target_issuer_legal_name), ''),
    nullif(btrim(target_issuer_tax_id), ''),
    nullif(btrim(target_issuer_address_line1), ''),
    nullif(btrim(target_issuer_address_line2), ''),
    nullif(btrim(target_issuer_city), ''),
    nullif(btrim(target_issuer_region), ''),
    nullif(btrim(target_issuer_postal_code), ''),
    normalized_country,
    lower(nullif(btrim(target_issuer_email), '')),
    nullif(btrim(target_issuer_phone), ''),
    normalized_series,
    round(target_default_tax_rate, 4),
    actor_id,
    actor_id
  )
  on conflict (organization_id)
  do update set
    issuer_legal_name = excluded.issuer_legal_name,
    issuer_tax_id = excluded.issuer_tax_id,
    issuer_address_line1 = excluded.issuer_address_line1,
    issuer_address_line2 = excluded.issuer_address_line2,
    issuer_city = excluded.issuer_city,
    issuer_region = excluded.issuer_region,
    issuer_postal_code = excluded.issuer_postal_code,
    issuer_country_code = excluded.issuer_country_code,
    issuer_email = excluded.issuer_email,
    issuer_phone = excluded.issuer_phone,
    default_series = excluded.default_series,
    default_tax_rate = excluded.default_tax_rate,
    updated_by = actor_id;
end;
$$;

create function public.create_billing_draft(
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
      item_taxable := round(item_row.line_total - item_discount, 2);
      item_tax := round(item_taxable * effective_tax_rate / 100, 2);

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
        item_taxable + item_tax,
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

  return new_invoice_id;
exception when unique_violation then
  raise exception 'billing_order_already_invoiced' using errcode = '55000';
end;
$$;

create function public.update_billing_draft(
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
  ) then
    raise exception 'billing_invalid_draft' using errcode = '22023';
  end if;

  perform set_config('app.billing_mutation', 'on', true);

  update public.invoice_items item
  set tax_rate = effective_tax_rate,
      tax_amount = round(item.taxable_base * effective_tax_rate / 100, 2),
      line_total = item.taxable_base + round(item.taxable_base * effective_tax_rate / 100, 2)
  where item.organization_id = org_id
    and item.invoice_id = target_invoice_id;

  update public.invoices invoice
  set issue_date = target_issue_date,
      due_date = target_due_date,
      series = normalized_series,
      tax_total = totals.tax_total,
      total = invoice.taxable_base + totals.tax_total,
      notes = nullif(btrim(target_notes), ''),
      updated_by = actor_id
  from (
    select round(sum(item.tax_amount), 2) as tax_total
    from public.invoice_items item
    where item.organization_id = org_id
      and item.invoice_id = target_invoice_id
  ) totals
  where invoice.organization_id = org_id
    and invoice.id = target_invoice_id;
end;
$$;

create function public.issue_billing_invoice(target_invoice_id uuid)
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

create function public.cancel_billing_invoice(
  target_invoice_id uuid,
  target_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  org_id uuid := public.app_current_organization_id();
  normalized_reason text := nullif(btrim(target_reason), '');
begin
  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'billing_not_authorized' using errcode = '42501';
  end if;

  if normalized_reason is null then
    raise exception 'billing_cancellation_reason_required' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.invoice_orders invoice_order
    join public.payments payment
      on payment.organization_id = invoice_order.organization_id
     and payment.order_id = invoice_order.order_id
    where invoice_order.organization_id = org_id
      and invoice_order.invoice_id = target_invoice_id
    group by invoice_order.invoice_id
    having coalesce(sum(payment.amount) filter (where payment.status = 'confirmed'), 0)
      - coalesce(sum(payment.amount) filter (where payment.status = 'refunded'), 0) > 0
  ) then
    raise exception 'billing_paid_cancellation_requires_credit_note' using errcode = '55000';
  end if;

  perform set_config('app.billing_mutation', 'on', true);

  update public.invoices
  set document_status = 'cancelled',
      cancellation_reason = normalized_reason,
      cancelled_at = now(),
      updated_by = actor_id
  where organization_id = org_id
    and id = target_invoice_id
    and document_status = 'issued';

  if not found then
    raise exception 'billing_invalid_issued_invoice' using errcode = '22023';
  end if;

  update public.invoice_orders
  set is_active = false
  where organization_id = org_id
    and invoice_id = target_invoice_id;
end;
$$;

create function public.delete_billing_draft(target_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid := public.app_current_organization_id();
begin
  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'billing_not_authorized' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.invoices invoice
    where invoice.organization_id = org_id
      and invoice.id = target_invoice_id
      and invoice.document_status = 'draft'
  ) then
    raise exception 'billing_invalid_draft' using errcode = '22023';
  end if;

  perform set_config('app.billing_mutation', 'on', true);

  delete from public.invoices invoice
  where invoice.organization_id = org_id
    and invoice.id = target_invoice_id
    and invoice.document_status = 'draft';
end;
$$;

alter table public.organization_billing_settings enable row level security;
alter table public.billing_invoice_number_counters enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.invoice_orders enable row level security;

create policy "organization_billing_settings_select_management"
on public.organization_billing_settings
for select to authenticated
using (public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[]));

create policy "invoices_select_management"
on public.invoices
for select to authenticated
using (public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[]));

create policy "invoice_items_select_management"
on public.invoice_items
for select to authenticated
using (public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[]));

create policy "invoice_orders_select_management"
on public.invoice_orders
for select to authenticated
using (public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[]));

revoke all on table public.organization_billing_settings from public, anon, authenticated;
revoke all on table public.billing_invoice_number_counters from public, anon, authenticated;
revoke all on table public.invoices from public, anon, authenticated;
revoke all on table public.invoice_items from public, anon, authenticated;
revoke all on table public.invoice_orders from public, anon, authenticated;

grant select on table public.organization_billing_settings to authenticated;
grant select on table public.invoices to authenticated;
grant select on table public.invoice_items to authenticated;
grant select on table public.invoice_orders to authenticated;

revoke all on function public.protect_billing_invoice_mutation() from public, anon, authenticated;
revoke all on function public.protect_billing_child_mutation() from public, anon, authenticated;
revoke all on function public.upsert_organization_billing_settings(text, text, text, text, text, text, text, text, text, text, text, numeric) from public, anon, authenticated;
revoke all on function public.create_billing_draft(uuid[], text, numeric, text) from public, anon, authenticated;
revoke all on function public.update_billing_draft(uuid, date, date, text, numeric, text) from public, anon, authenticated;
revoke all on function public.issue_billing_invoice(uuid) from public, anon, authenticated;
revoke all on function public.cancel_billing_invoice(uuid, text) from public, anon, authenticated;
revoke all on function public.delete_billing_draft(uuid) from public, anon, authenticated;

grant execute on function public.upsert_organization_billing_settings(text, text, text, text, text, text, text, text, text, text, text, numeric) to authenticated;
grant execute on function public.create_billing_draft(uuid[], text, numeric, text) to authenticated;
grant execute on function public.update_billing_draft(uuid, date, date, text, numeric, text) to authenticated;
grant execute on function public.issue_billing_invoice(uuid) to authenticated;
grant execute on function public.cancel_billing_invoice(uuid, text) to authenticated;
grant execute on function public.delete_billing_draft(uuid) to authenticated;
