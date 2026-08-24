-- CATALOG-SEGMENTS-001: tenant-scoped customer quick catalogues.
--
-- Segments reference the existing organization catalogue. They never copy a
-- service or price and cannot relax the Portal visibility/orderability rules.

create table public.catalog_segments (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  portal_visible boolean not null default true,
  display_order integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_segments_organization_id_id_unique unique (organization_id, id),
  constraint catalog_segments_name_not_blank check (length(btrim(name)) between 1 and 120),
  constraint catalog_segments_description_length check (
    description is null or length(description) <= 1000
  ),
  constraint catalog_segments_display_order_non_negative check (display_order >= 0)
);

create unique index catalog_segments_name_unique_per_organization
on public.catalog_segments (organization_id, lower(btrim(name)));

create index catalog_segments_admin_idx
on public.catalog_segments (organization_id, is_active, portal_visible, display_order, name);

create table public.catalog_segment_services (
  organization_id uuid not null,
  segment_id uuid not null,
  service_id uuid not null,
  display_order integer not null default 0,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (segment_id, service_id),
  constraint catalog_segment_services_segment_same_organization foreign key (
    organization_id,
    segment_id
  ) references public.catalog_segments (organization_id, id) on delete cascade,
  constraint catalog_segment_services_service_same_organization foreign key (
    organization_id,
    service_id
  ) references public.services (organization_id, id) on delete cascade,
  constraint catalog_segment_services_display_order_non_negative check (display_order >= 0)
);

create index catalog_segment_services_order_idx
on public.catalog_segment_services (organization_id, segment_id, display_order, service_id);

create table public.catalog_segment_categories (
  organization_id uuid not null,
  segment_id uuid not null,
  category_key text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (segment_id, category_key),
  constraint catalog_segment_categories_segment_same_organization foreign key (
    organization_id,
    segment_id
  ) references public.catalog_segments (organization_id, id) on delete cascade,
  constraint catalog_segment_categories_category_same_organization foreign key (
    organization_id,
    category_key
  ) references public.organization_portal_categories (organization_id, category_key) on delete cascade,
  constraint catalog_segment_categories_display_order_non_negative check (display_order >= 0)
);

create index catalog_segment_categories_order_idx
on public.catalog_segment_categories (organization_id, segment_id, display_order, category_key);

alter table public.customers
  add column catalog_segment_id uuid,
  add constraint customers_catalog_segment_same_organization foreign key (
    organization_id,
    catalog_segment_id
  ) references public.catalog_segments (organization_id, id) on delete restrict;

create index customers_catalog_segment_idx
on public.customers (organization_id, catalog_segment_id)
where catalog_segment_id is not null;

create trigger catalog_segments_set_updated_at
before update on public.catalog_segments
for each row execute function public.set_updated_at();

create function public.protect_catalog_segment_immutable_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.organization_id <> old.organization_id then
    raise exception 'catalog_segments.organization_id cannot be changed';
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'catalog_segments.created_by cannot be changed';
  end if;

  return new;
end;
$$;

create trigger catalog_segments_protect_immutable_fields
before update on public.catalog_segments
for each row execute function public.protect_catalog_segment_immutable_fields();

create function public.protect_customer_catalog_segment_assignment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.catalog_segment_id is distinct from old.catalog_segment_id
    and coalesce(auth.role(), '') <> 'service_role'
    and not public.has_organization_role(
      old.organization_id,
      array['owner', 'manager']::public.app_role[]
    )
  then
    raise exception 'catalog_segment_assignment_not_authorized';
  end if;

  return new;
end;
$$;

create trigger customers_protect_catalog_segment_assignment
before update of catalog_segment_id on public.customers
for each row execute function public.protect_customer_catalog_segment_assignment();

alter table public.catalog_segments enable row level security;
alter table public.catalog_segment_services enable row level security;
alter table public.catalog_segment_categories enable row level security;

create policy "catalog_segments_select_manager"
on public.catalog_segments
for select
to authenticated
using (public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[]));

create policy "catalog_segments_insert_manager"
on public.catalog_segments
for insert
to authenticated
with check (public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[]));

create policy "catalog_segments_update_manager"
on public.catalog_segments
for update
to authenticated
using (public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[]))
with check (public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[]));

create policy "catalog_segments_delete_manager"
on public.catalog_segments
for delete
to authenticated
using (public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[]));

create policy "catalog_segment_services_select_manager"
on public.catalog_segment_services
for select
to authenticated
using (public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[]));

create policy "catalog_segment_services_insert_manager"
on public.catalog_segment_services
for insert
to authenticated
with check (public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[]));

create policy "catalog_segment_services_update_manager"
on public.catalog_segment_services
for update
to authenticated
using (public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[]))
with check (public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[]));

create policy "catalog_segment_services_delete_manager"
on public.catalog_segment_services
for delete
to authenticated
using (public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[]));

create policy "catalog_segment_categories_select_manager"
on public.catalog_segment_categories
for select
to authenticated
using (public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[]));

create policy "catalog_segment_categories_insert_manager"
on public.catalog_segment_categories
for insert
to authenticated
with check (public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[]));

create policy "catalog_segment_categories_update_manager"
on public.catalog_segment_categories
for update
to authenticated
using (public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[]))
with check (public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[]));

create policy "catalog_segment_categories_delete_manager"
on public.catalog_segment_categories
for delete
to authenticated
using (public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[]));

-- One transactional write surface keeps metadata, curated relations and the
-- primary customer assignments synchronized and tenant-scoped.
create function public.save_catalog_segment(
  target_organization_id uuid,
  target_segment_id uuid,
  target_name text,
  target_description text,
  target_is_active boolean,
  target_portal_visible boolean,
  target_display_order integer,
  target_services jsonb,
  target_categories jsonb,
  target_customer_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  saved_segment_id uuid;
begin
  if not public.has_organization_role(
    target_organization_id,
    array['owner', 'manager']::public.app_role[]
  ) then
    raise exception 'catalog_segment_not_authorized';
  end if;

  if length(btrim(coalesce(target_name, ''))) not between 1 and 120
    or length(coalesce(target_description, '')) > 1000
    or coalesce(target_display_order, -1) < 0
    or jsonb_typeof(coalesce(target_services, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(target_categories, '[]'::jsonb)) <> 'array'
  then
    raise exception 'catalog_segment_invalid';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(target_services, '[]'::jsonb))
      as entry(service_id uuid, display_order integer, featured boolean)
    where not exists (
      select 1
      from public.services service
      where service.organization_id = target_organization_id
        and service.id = entry.service_id
    )
  ) or exists (
    select 1
    from jsonb_to_recordset(coalesce(target_categories, '[]'::jsonb))
      as entry(category_key text, display_order integer)
    where not exists (
      select 1
      from public.organization_portal_categories category
      where category.organization_id = target_organization_id
        and category.category_key = entry.category_key
    )
  ) or exists (
    select 1
    from unnest(coalesce(target_customer_ids, '{}'::uuid[])) as entry(customer_id)
    where not exists (
      select 1
      from public.customers customer
      where customer.organization_id = target_organization_id
        and customer.id = entry.customer_id
    )
  ) then
    raise exception 'catalog_segment_cross_tenant_reference';
  end if;

  if target_segment_id is null then
    insert into public.catalog_segments (
      organization_id,
      name,
      description,
      is_active,
      portal_visible,
      display_order,
      created_by,
      updated_by
    ) values (
      target_organization_id,
      btrim(target_name),
      nullif(btrim(coalesce(target_description, '')), ''),
      coalesce(target_is_active, false),
      coalesce(target_portal_visible, false),
      target_display_order,
      actor_id,
      actor_id
    ) returning id into saved_segment_id;
  else
    update public.catalog_segments
    set name = btrim(target_name),
        description = nullif(btrim(coalesce(target_description, '')), ''),
        is_active = coalesce(target_is_active, false),
        portal_visible = coalesce(target_portal_visible, false),
        display_order = target_display_order,
        updated_by = actor_id
    where organization_id = target_organization_id
      and id = target_segment_id
    returning id into saved_segment_id;

    if saved_segment_id is null then
      raise exception 'catalog_segment_not_found';
    end if;
  end if;

  delete from public.catalog_segment_services
  where organization_id = target_organization_id
    and segment_id = saved_segment_id;

  insert into public.catalog_segment_services (
    organization_id,
    segment_id,
    service_id,
    display_order,
    featured
  )
  select
    target_organization_id,
    saved_segment_id,
    service.id,
    greatest(coalesce(entry.display_order, 0), 0),
    coalesce(entry.featured, false)
  from jsonb_to_recordset(coalesce(target_services, '[]'::jsonb))
    as entry(service_id uuid, display_order integer, featured boolean)
  join public.services service
    on service.organization_id = target_organization_id
   and service.id = entry.service_id
  on conflict (segment_id, service_id) do update
  set display_order = excluded.display_order,
      featured = excluded.featured;

  delete from public.catalog_segment_categories
  where organization_id = target_organization_id
    and segment_id = saved_segment_id;

  insert into public.catalog_segment_categories (
    organization_id,
    segment_id,
    category_key,
    display_order
  )
  select
    target_organization_id,
    saved_segment_id,
    category.category_key,
    greatest(coalesce(entry.display_order, 0), 0)
  from jsonb_to_recordset(coalesce(target_categories, '[]'::jsonb))
    as entry(category_key text, display_order integer)
  join public.organization_portal_categories category
    on category.organization_id = target_organization_id
   and category.category_key = entry.category_key
  on conflict (segment_id, category_key) do update
  set display_order = excluded.display_order;

  update public.customers
  set catalog_segment_id = null,
      updated_by = actor_id
  where organization_id = target_organization_id
    and catalog_segment_id = saved_segment_id
    and not (id = any(coalesce(target_customer_ids, '{}'::uuid[])));

  update public.customers
  set catalog_segment_id = saved_segment_id,
      updated_by = actor_id
  where organization_id = target_organization_id
    and id = any(coalesce(target_customer_ids, '{}'::uuid[]));

  return saved_segment_id;
end;
$$;

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
      customer.catalog_segment_id,
      organization.default_currency::text as currency,
      organization.timezone,
      (
        select location.id
        from public.locations location
        where location.organization_id = access.organization_id
          and location.is_active
          and location.deleted_at is null
        order by location.created_at, location.id
        limit 1
      ) as location_id
    from public.customer_portal_access access
    join public.customers customer
      on customer.organization_id = access.organization_id
     and customer.id = access.customer_id
    join public.organizations organization
      on organization.id = access.organization_id
    where access.user_id = auth.uid()
      and access.is_active
      and customer.is_active
      and organization.status = 'active'
      and organization.deleted_at is null
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
    current_price.is_from,
    service.portal_featured,
    category.portal_featured,
    service.customer_orderable,
    service.portal_image_path,
    segment.id,
    segment.name,
    segment.description,
    segment.id is not null
      and service.customer_orderable
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
   and service.is_active
   and service.portal_visible
   and (service.location_id is null or service.location_id = context.location_id)
  join public.organization_portal_categories category
    on category.organization_id = context.organization_id
   and category.category_key = service.portal_category_key
   and category.portal_visible
  left join public.catalog_segments segment
    on segment.organization_id = context.organization_id
   and segment.id = context.catalog_segment_id
   and segment.is_active
   and segment.portal_visible
  left join public.catalog_segment_services segment_service
    on segment_service.organization_id = context.organization_id
   and segment_service.segment_id = segment.id
   and segment_service.service_id = service.id
  left join public.catalog_segment_categories segment_category
    on segment_category.organization_id = context.organization_id
   and segment_category.segment_id = segment.id
   and segment_category.category_key = service.portal_category_key
  join lateral (
    select
      price.amount,
      price.currency,
      price.is_from
    from public.service_prices price
    where price.organization_id = context.organization_id
      and price.service_id = service.id
      and price.is_active
      and price.currency = context.currency
      and price.valid_from <= (now() at time zone context.timezone)::date
      and (price.valid_to is null or price.valid_to >= (now() at time zone context.timezone)::date)
      and (price.location_id is null or price.location_id = context.location_id)
    order by (price.location_id is not null) desc, price.valid_from desc, price.created_at desc
    limit 1
  ) current_price on true
  order by
    case when segment.id is not null
      and service.customer_orderable
      and (segment_service.service_id is not null or segment_category.category_key is not null)
      then 0 else 1 end,
    case
      when segment_service.service_id is not null then segment_service.display_order
      when segment_category.category_key is not null then 100000 + segment_category.display_order
      else 200000 + category.portal_sort_order
    end,
    category.portal_sort_order,
    service.portal_sort_order,
    service.name,
    service.id;
$$;

revoke all on public.catalog_segments from public, anon, authenticated;
revoke all on public.catalog_segment_services from public, anon, authenticated;
revoke all on public.catalog_segment_categories from public, anon, authenticated;
grant select, insert, update, delete on public.catalog_segments to authenticated;
grant select, insert, update, delete on public.catalog_segment_services to authenticated;
grant select, insert, update, delete on public.catalog_segment_categories to authenticated;

revoke all on function public.protect_customer_catalog_segment_assignment() from public, anon, authenticated;
revoke all on function public.protect_catalog_segment_immutable_fields() from public, anon, authenticated;
revoke all on function public.save_catalog_segment(uuid, uuid, text, text, boolean, boolean, integer, jsonb, jsonb, uuid[]) from public, anon, authenticated;
grant execute on function public.save_catalog_segment(uuid, uuid, text, text, boolean, boolean, integer, jsonb, jsonb, uuid[]) to authenticated;

revoke all on function public.list_customer_portal_services() from public, anon, authenticated;
grant execute on function public.list_customer_portal_services() to authenticated;
