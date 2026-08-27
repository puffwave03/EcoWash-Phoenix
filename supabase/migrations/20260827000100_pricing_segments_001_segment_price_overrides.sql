create table public.catalog_segment_prices (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  segment_id uuid not null,
  service_id uuid not null,
  location_id uuid,
  amount numeric(12,2) not null,
  currency text not null,
  valid_from date not null,
  valid_to date,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_segment_prices_amount_non_negative check (amount >= 0),
  constraint catalog_segment_prices_currency_format check (
    currency = upper(currency) and length(currency) = 3
  ),
  constraint catalog_segment_prices_valid_range check (
    valid_to is null or valid_to >= valid_from
  ),
  constraint catalog_segment_prices_segment_same_organization foreign key (
    organization_id,
    segment_id
  ) references public.catalog_segments (organization_id, id) on delete restrict,
  constraint catalog_segment_prices_service_same_organization foreign key (
    organization_id,
    service_id
  ) references public.services (organization_id, id) on delete restrict,
  constraint catalog_segment_prices_location_same_organization foreign key (
    organization_id,
    location_id
  ) references public.locations (organization_id, id) on delete restrict
);

create unique index catalog_segment_prices_active_unique_period
on public.catalog_segment_prices (
  organization_id,
  segment_id,
  service_id,
  coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid),
  currency,
  valid_from
)
where is_active;

create index catalog_segment_prices_lookup_idx
on public.catalog_segment_prices (
  organization_id,
  segment_id,
  service_id,
  location_id,
  currency,
  is_active,
  valid_from desc
);

create trigger catalog_segment_prices_set_updated_at
before update on public.catalog_segment_prices
for each row execute function public.set_updated_at();

create function public.protect_catalog_segment_price_immutable_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.organization_id <> old.organization_id
    or new.segment_id <> old.segment_id
    or new.service_id <> old.service_id
    or new.location_id is distinct from old.location_id
    or new.created_by is distinct from old.created_by then
    raise exception 'catalog_segment_prices immutable relationship fields cannot be changed';
  end if;

  return new;
end;
$$;

create trigger catalog_segment_prices_protect_immutable_fields
before update on public.catalog_segment_prices
for each row execute function public.protect_catalog_segment_price_immutable_fields();

create function public.reject_catalog_segment_price_overlap()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.is_active and exists (
    select 1
    from public.catalog_segment_prices existing
    where existing.organization_id = new.organization_id
      and existing.segment_id = new.segment_id
      and existing.service_id = new.service_id
      and existing.location_id is not distinct from new.location_id
      and existing.currency = new.currency
      and existing.is_active
      and existing.id <> new.id
      and daterange(existing.valid_from, existing.valid_to, '[]')
        && daterange(new.valid_from, new.valid_to, '[]')
  ) then
    raise exception 'catalog_segment_price_period_overlap' using errcode = '23P01';
  end if;

  return new;
end;
$$;

create trigger catalog_segment_prices_reject_overlap
before insert or update of valid_from, valid_to, is_active, currency on public.catalog_segment_prices
for each row execute function public.reject_catalog_segment_price_overlap();

alter table public.catalog_segment_prices enable row level security;

create policy catalog_segment_prices_select_manager
on public.catalog_segment_prices
for select
using (
  public.has_organization_role(
    organization_id,
    array['owner', 'manager']::public.app_role[]
  )
);

create policy catalog_segment_prices_insert_manager
on public.catalog_segment_prices
for insert
with check (
  public.has_organization_role(
    organization_id,
    array['owner', 'manager']::public.app_role[]
  )
);

create policy catalog_segment_prices_update_manager
on public.catalog_segment_prices
for update
using (
  public.has_organization_role(
    organization_id,
    array['owner', 'manager']::public.app_role[]
  )
)
with check (
  public.has_organization_role(
    organization_id,
    array['owner', 'manager']::public.app_role[]
  )
);

create function public.resolve_effective_service_price(
  target_organization_id uuid,
  target_customer_id uuid,
  target_service_id uuid,
  target_location_id uuid,
  target_effective_date date
)
returns table (
  amount numeric,
  currency text,
  unit_type public.service_unit_type,
  price_is_from boolean,
  pricing_source text,
  segment_id uuid,
  segment_name text,
  base_amount numeric,
  valid_from date,
  valid_to date
)
language sql
stable
security definer
set search_path = public
as $$
  with customer_context as (
    select
      customer.catalog_segment_id,
      organization.default_currency::text as currency,
      service.unit_type
    from public.customers customer
    join public.organizations organization
      on organization.id = customer.organization_id
    join public.services service
      on service.organization_id = target_organization_id
     and service.id = target_service_id
     and service.is_active
     and (service.location_id is null or service.location_id = target_location_id)
    where customer.organization_id = target_organization_id
      and customer.id = target_customer_id
      and customer.is_active
      and organization.status = 'active'
      and organization.deleted_at is null
  ),
  base_price as (
    select price.*
    from customer_context context
    join public.service_prices price
      on price.organization_id = target_organization_id
     and price.service_id = target_service_id
     and price.currency = context.currency
     and price.is_active
     and price.valid_from <= target_effective_date
     and (price.valid_to is null or price.valid_to >= target_effective_date)
     and (price.location_id is null or price.location_id = target_location_id)
    order by (price.location_id is not null) desc, price.valid_from desc, price.created_at desc
    limit 1
  ),
  active_segment as (
    select segment.id, segment.name
    from customer_context context
    join public.catalog_segments segment
      on segment.organization_id = target_organization_id
     and segment.id = context.catalog_segment_id
     and segment.is_active
  ),
  segment_price as (
    select price.*
    from base_price base
    join active_segment segment on true
    join public.catalog_segment_prices price
      on price.organization_id = target_organization_id
     and price.segment_id = segment.id
     and price.service_id = target_service_id
     and price.currency = base.currency
     and price.is_active
     and price.valid_from <= target_effective_date
     and (price.valid_to is null or price.valid_to >= target_effective_date)
     and (price.location_id is null or price.location_id = target_location_id)
    order by (price.location_id is not null) desc, price.valid_from desc, price.created_at desc
    limit 1
  )
  select
    coalesce(segment_price.amount, base.amount),
    base.currency,
    context.unit_type,
    base.is_from,
    case when segment_price.id is null then 'base' else 'segment' end,
    case when segment_price.id is null then null else segment.id end,
    case when segment_price.id is null then null else segment.name end,
    base.amount,
    coalesce(segment_price.valid_from, base.valid_from),
    coalesce(segment_price.valid_to, base.valid_to)
  from base_price base
  join customer_context context on true
  left join active_segment segment on true
  left join segment_price on true;
$$;

create function public.save_catalog_segment_price(
  target_price_id uuid,
  target_organization_id uuid,
  target_segment_id uuid,
  target_service_id uuid,
  target_location_id uuid,
  target_amount numeric,
  target_currency text,
  target_valid_from date,
  target_valid_to date,
  target_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  saved_price_id uuid;
  organization_currency text;
begin
  if actor_id is null or not public.has_organization_role(
    target_organization_id,
    array['owner', 'manager']::public.app_role[]
  ) then
    raise exception 'catalog_segment_price_not_authorized' using errcode = '42501';
  end if;

  select default_currency::text into organization_currency
  from public.organizations
  where id = target_organization_id
    and status = 'active'
    and deleted_at is null;

  if organization_currency is null
    or target_currency <> organization_currency
    or target_amount < 0
    or target_valid_from is null
    or (target_valid_to is not null and target_valid_to < target_valid_from) then
    raise exception 'catalog_segment_price_invalid';
  end if;

  if not exists (
    select 1 from public.catalog_segments segment
    where segment.organization_id = target_organization_id and segment.id = target_segment_id
  ) or not exists (
    select 1 from public.services service
    where service.organization_id = target_organization_id and service.id = target_service_id
  ) or (target_location_id is not null and not exists (
    select 1 from public.locations location
    where location.organization_id = target_organization_id and location.id = target_location_id
  )) then
    raise exception 'catalog_segment_price_cross_tenant_reference' using errcode = '23503';
  end if;

  if not exists (
    select 1 from public.service_prices price
    where price.organization_id = target_organization_id
      and price.service_id = target_service_id
      and price.currency = target_currency
  ) then
    raise exception 'catalog_segment_price_requires_base_price';
  end if;

  if target_price_id is null then
    insert into public.catalog_segment_prices (
      organization_id, segment_id, service_id, location_id, amount, currency,
      valid_from, valid_to, is_active, created_by, updated_by
    ) values (
      target_organization_id, target_segment_id, target_service_id, target_location_id,
      target_amount, target_currency, target_valid_from, target_valid_to,
      target_is_active, actor_id, actor_id
    ) returning id into saved_price_id;
  else
    update public.catalog_segment_prices
    set amount = target_amount,
        currency = target_currency,
        valid_from = target_valid_from,
        valid_to = target_valid_to,
        is_active = target_is_active,
        updated_by = actor_id
    where id = target_price_id
      and organization_id = target_organization_id
      and segment_id = target_segment_id
      and service_id = target_service_id
      and location_id is not distinct from target_location_id
    returning id into saved_price_id;

    if saved_price_id is null then
      raise exception 'catalog_segment_price_not_found';
    end if;
  end if;

  return saved_price_id;
end;
$$;

create function public.list_effective_order_services(target_order_id uuid)
returns table (
  id uuid,
  code text,
  name text,
  description text,
  unit_type public.service_unit_type,
  category text,
  is_active boolean,
  amount numeric,
  currency text,
  price_is_from boolean,
  valid_from date,
  valid_to date,
  pricing_source text,
  pricing_segment_name text
)
language sql
stable
security definer
set search_path = public
as $$
  with order_context as (
    select
      orders.organization_id,
      orders.customer_id,
      orders.location_id,
      (now() at time zone organization.timezone)::date as effective_date
    from public.orders orders
    join public.organizations organization on organization.id = orders.organization_id
    where orders.id = target_order_id
      and orders.is_active
      and public.is_organization_member(orders.organization_id)
  )
  select
    service.id,
    service.code,
    service.name,
    service.description,
    service.unit_type,
    service.category,
    service.is_active,
    price.amount,
    price.currency,
    price.price_is_from,
    price.valid_from,
    price.valid_to,
    price.pricing_source,
    price.segment_name
  from order_context context
  join public.services service
    on service.organization_id = context.organization_id
   and service.is_active
   and (service.location_id is null or service.location_id = context.location_id)
  join lateral public.resolve_effective_service_price(
    context.organization_id,
    context.customer_id,
    service.id,
    context.location_id,
    context.effective_date
  ) price on true
  order by service.sort_order, service.name, service.id;
$$;

create function public.enforce_effective_order_item_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  order_context record;
  effective_price numeric(12,2);
begin
  if new.service_id is null then
    return new;
  end if;

  select
    orders.organization_id,
    orders.customer_id,
    orders.location_id,
    (now() at time zone organization.timezone)::date as effective_date
  into order_context
  from public.orders orders
  join public.organizations organization on organization.id = orders.organization_id
  where orders.id = new.order_id
    and orders.organization_id = new.organization_id;

  select price.amount into effective_price
  from public.resolve_effective_service_price(
    order_context.organization_id,
    order_context.customer_id,
    new.service_id,
    order_context.location_id,
    order_context.effective_date
  ) price;

  if effective_price is null then
    raise exception 'effective_service_price_unavailable';
  end if;

  new.unit_price := effective_price;
  new.line_total := round(new.quantity * effective_price, 2);
  return new;
end;
$$;

create trigger order_items_resolve_effective_price
before insert or update of service_id, quantity, unit_price on public.order_items
for each row execute function public.enforce_effective_order_item_price();

drop function public.list_customer_portal_services();

create function public.list_customer_portal_services()
returns table (
  id uuid,
  name text,
  description text,
  unit_type public.service_unit_type,
  category text,
  category_title text,
  amount numeric,
  currency text,
  price_is_from boolean,
  pricing_source text,
  portal_featured boolean,
  category_featured boolean,
  customer_orderable boolean,
  portal_image_path text,
  segment_id uuid,
  segment_name text,
  segment_description text,
  segment_match boolean,
  segment_featured boolean,
  segment_sort_order integer
)
language sql
stable
security definer
set search_path = public
as $$
  with portal_context as (
    select
      access.organization_id,
      access.customer_id,
      customer.catalog_segment_id,
      organization.timezone,
      (select location.id from public.locations location
       where location.organization_id = access.organization_id
         and location.is_active and location.deleted_at is null
       order by location.created_at, location.id limit 1) as location_id
    from public.customer_portal_access access
    join public.customers customer
      on customer.organization_id = access.organization_id and customer.id = access.customer_id
    join public.organizations organization on organization.id = access.organization_id
    where access.user_id = auth.uid() and access.is_active and customer.is_active
      and organization.status = 'active' and organization.deleted_at is null
    order by access.created_at
    limit 1
  )
  select
    service.id,
    service.name,
    coalesce(service.portal_description, service.description),
    service.unit_type,
    service.portal_category_key,
    category.portal_title,
    current_price.amount,
    current_price.currency,
    current_price.price_is_from,
    current_price.pricing_source,
    service.portal_featured,
    category.portal_featured,
    service.customer_orderable,
    service.portal_image_path,
    segment.id,
    segment.name,
    segment.description,
    segment.id is not null and service.customer_orderable
      and (segment_service.service_id is not null or segment_category.category_key is not null),
    coalesce(segment_service.featured, false),
    case
      when segment_service.service_id is not null then segment_service.display_order
      when segment_category.category_key is not null then 100000 + segment_category.display_order
      else 200000 + service.portal_sort_order
    end
  from portal_context context
  join public.services service
    on service.organization_id = context.organization_id
   and service.is_active and service.portal_visible
   and (service.location_id is null or service.location_id = context.location_id)
  join public.organization_portal_categories category
    on category.organization_id = context.organization_id
   and category.category_key = service.portal_category_key
   and category.portal_visible
  left join public.catalog_segments segment
    on segment.organization_id = context.organization_id
   and segment.id = context.catalog_segment_id
   and segment.is_active and segment.portal_visible
  left join public.catalog_segment_services segment_service
    on segment_service.organization_id = context.organization_id
   and segment_service.segment_id = segment.id and segment_service.service_id = service.id
  left join public.catalog_segment_categories segment_category
    on segment_category.organization_id = context.organization_id
   and segment_category.segment_id = segment.id
   and segment_category.category_key = service.portal_category_key
  join lateral public.resolve_effective_service_price(
    context.organization_id,
    context.customer_id,
    service.id,
    context.location_id,
    (now() at time zone context.timezone)::date
  ) current_price on true
  order by
    case when segment.id is not null and service.customer_orderable
      and (segment_service.service_id is not null or segment_category.category_key is not null)
      then 0 else 1 end,
    case
      when segment_service.service_id is not null then segment_service.display_order
      when segment_category.category_key is not null then 100000 + segment_category.display_order
      else 200000 + category.portal_sort_order
    end,
    category.portal_sort_order, service.portal_sort_order, service.name, service.id;
$$;

revoke all on public.catalog_segment_prices from public, anon, authenticated;
grant select on public.catalog_segment_prices to authenticated;

revoke all on function public.protect_catalog_segment_price_immutable_fields() from public, anon, authenticated;
revoke all on function public.reject_catalog_segment_price_overlap() from public, anon, authenticated;
revoke all on function public.resolve_effective_service_price(uuid, uuid, uuid, uuid, date) from public, anon, authenticated;
revoke all on function public.enforce_effective_order_item_price() from public, anon, authenticated;
revoke all on function public.save_catalog_segment_price(uuid, uuid, uuid, uuid, uuid, numeric, text, date, date, boolean) from public, anon, authenticated;
grant execute on function public.save_catalog_segment_price(uuid, uuid, uuid, uuid, uuid, numeric, text, date, date, boolean) to authenticated;

revoke all on function public.list_effective_order_services(uuid) from public, anon, authenticated;
grant execute on function public.list_effective_order_services(uuid) to authenticated;

revoke all on function public.list_customer_portal_services() from public, anon, authenticated;
grant execute on function public.list_customer_portal_services() to authenticated;
