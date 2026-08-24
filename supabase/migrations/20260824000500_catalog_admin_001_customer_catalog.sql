-- CATALOG-ADMIN-001: tenant-scoped customer catalogue presentation controls.
--
-- This migration is additive. It does not delete services, prices or order
-- history, and it deliberately leaves the internal service category and sort
-- order independent from their Portal presentation equivalents.

alter table public.services
  add column customer_orderable boolean not null default false,
  add column portal_description text,
  add column portal_category_key text,
  add column portal_sort_order integer not null default 0;

-- Preserve the catalogue CATALOG-001 explicitly approved. Services created
-- after this migration remain non-orderable until an Owner/Manager opts in.
update public.services
set
  customer_orderable = portal_visible,
  portal_category_key = case
    when category ~ '^[a-z0-9_]{1,64}$' then category
    else null
  end,
  portal_sort_order = sort_order;

create or replace function public.app_brand_media_path_is_valid(target_path text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select target_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/(logo|hero|promo|category|service)/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$';
$$;

alter table public.services
  add constraint services_portal_description_length check (
    portal_description is null or length(portal_description) <= 1000
  ),
  add constraint services_portal_category_key check (
    portal_category_key is null or portal_category_key ~ '^[a-z0-9_]{1,64}$'
  ),
  add constraint services_portal_image_path_safe check (
    portal_image_path is null
    or (
      portal_image_path ~ '^/images/[A-Za-z0-9_./-]+\.(jpg|jpeg|png|webp)$'
      and position('..' in portal_image_path) = 0
    )
    or (
      public.app_brand_media_path_is_valid(portal_image_path)
      and public.app_brand_media_path_organization_id(portal_image_path) = organization_id
      and split_part(portal_image_path, '/', 2) = 'service'
    )
  );

alter table public.organization_portal_categories
  add column portal_visible boolean not null default true,
  add column portal_featured boolean not null default false,
  add column portal_sort_order integer not null default 0,
  add column portal_title text,
  add constraint organization_portal_categories_title_length check (
    portal_title is null or length(portal_title) between 1 and 120
  );

-- Materialize every current internal category as an organization-owned Portal
-- category. Null/invalid internal categories are intentionally not invented;
-- their services stay internal until explicitly assigned in the management UI.
insert into public.organization_portal_categories (
  organization_id,
  category_key,
  portal_sort_order
)
select
  service.organization_id,
  service.category,
  min(service.sort_order)
from public.services service
where service.category ~ '^[a-z0-9_]{1,64}$'
group by service.organization_id, service.category
on conflict (organization_id, category_key) do nothing;

-- Ensure the complete CATALOG-001 commercial structure exists for every
-- tenant, including categories that currently contain no internal service.
insert into public.organization_portal_categories (
  organization_id,
  category_key,
  portal_sort_order
)
select
  organization.id,
  category.category_key,
  category.portal_sort_order
from public.organizations organization
cross join (values
  ('laundry_by_weight', 10),
  ('ironing', 20),
  ('bed_linen', 30),
  ('home_textiles', 40),
  ('dry_cleaning', 50),
  ('leather', 60),
  ('rugs_bulky', 70),
  ('self_service', 80),
  ('professional_services', 90),
  ('special_services', 100),
  ('traditional_ceremonial', 110)
) as category(category_key, portal_sort_order)
on conflict (organization_id, category_key) do update
set portal_sort_order = excluded.portal_sort_order;

drop policy "organization_portal_categories_insert_owner"
on public.organization_portal_categories;

drop policy "organization_portal_categories_update_owner"
on public.organization_portal_categories;

create policy "organization_portal_categories_insert_catalog_manager"
on public.organization_portal_categories
for insert
to authenticated
with check (
  public.has_organization_role(
    organization_id,
    array['owner', 'manager']::public.app_role[]
  )
);

create policy "organization_portal_categories_update_catalog_manager"
on public.organization_portal_categories
for update
to authenticated
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

-- Managers may upload/delete only catalogue category/service assets. Branding
-- paths (logo/hero/promo) remain Owner-only under BRAND-001 policies.
create policy "brand_media_insert_catalog_manager"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'brand-media'
  and owner = auth.uid()
  and public.app_brand_media_path_is_valid(name)
  and split_part(name, '/', 2) in ('category', 'service')
  and public.has_organization_role(
    public.app_brand_media_path_organization_id(name),
    array['owner', 'manager']::public.app_role[]
  )
);

create policy "brand_media_delete_catalog_manager"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'brand-media'
  and public.app_brand_media_path_is_valid(name)
  and split_part(name, '/', 2) in ('category', 'service')
  and public.has_organization_role(
    public.app_brand_media_path_organization_id(name),
    array['owner', 'manager']::public.app_role[]
  )
);

drop index public.services_portal_catalog_idx;

create index services_portal_catalog_idx
on public.services (
  organization_id,
  portal_visible,
  customer_orderable,
  portal_category_key,
  portal_featured,
  portal_sort_order
)
where is_active;

create index organization_portal_categories_catalog_idx
on public.organization_portal_categories (
  organization_id,
  portal_visible,
  portal_featured,
  portal_sort_order,
  category_key
);

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
  portal_image_path text
)
language sql
stable
security definer
set search_path = public
as $$
  with portal_context as (
    select
      access.organization_id,
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
    service.portal_image_path
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
    category.portal_sort_order,
    category.category_key,
    service.portal_sort_order,
    service.name,
    service.id;
$$;

revoke all on function public.list_customer_portal_services() from public, anon, authenticated;
grant execute on function public.list_customer_portal_services() to authenticated;

-- Keep the proven CATALOG-001 order creation implementation intact behind a
-- wrapper. The wrapper adds category visibility and customer-orderability
-- checks; the original continues enforcing Portal access, organization,
-- active service, location and current-price validity.
alter function public.create_customer_portal_order_request(
  uuid,
  uuid,
  jsonb,
  timestamp without time zone,
  text
) rename to create_customer_portal_order_request_catalog_001;

revoke all on function public.create_customer_portal_order_request_catalog_001(
  uuid,
  uuid,
  jsonb,
  timestamp without time zone,
  text
) from public, anon, authenticated;

create function public.create_customer_portal_order_request(
  target_request_id uuid,
  target_property_id uuid,
  target_items jsonb,
  target_requested_pickup_at timestamp without time zone,
  target_customer_notes text
)
returns table (
  id uuid,
  order_number text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  portal_org_id uuid;
  item jsonb;
  item_service_id uuid;
begin
  select access.organization_id
  into portal_org_id
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
  limit 1;

  if portal_org_id is null then
    raise exception 'portal_request_unauthorized';
  end if;

  if target_items is null or jsonb_typeof(target_items) <> 'array' then
    raise exception 'portal_request_invalid_items';
  end if;

  for item in select value from jsonb_array_elements(target_items)
  loop
    begin
      item_service_id := nullif(item ->> 'service_id', '')::uuid;
    exception when others then
      raise exception 'portal_request_invalid_items';
    end;

    if item_service_id is null or not exists (
      select 1
      from public.services service
      join public.organization_portal_categories category
        on category.organization_id = service.organization_id
       and category.category_key = service.portal_category_key
       and category.portal_visible
      where service.id = item_service_id
        and service.organization_id = portal_org_id
        and service.is_active
        and service.portal_visible
        and service.customer_orderable
    ) then
      raise exception 'portal_request_service_unavailable';
    end if;
  end loop;

  return query
  select request.id, request.order_number
  from public.create_customer_portal_order_request_catalog_001(
    target_request_id,
    target_property_id,
    target_items,
    target_requested_pickup_at,
    target_customer_notes
  ) request;
end;
$$;

revoke all on function public.create_customer_portal_order_request(
  uuid,
  uuid,
  jsonb,
  timestamp without time zone,
  text
) from public, anon, authenticated;

grant execute on function public.create_customer_portal_order_request(
  uuid,
  uuid,
  jsonb,
  timestamp without time zone,
  text
) to authenticated;
