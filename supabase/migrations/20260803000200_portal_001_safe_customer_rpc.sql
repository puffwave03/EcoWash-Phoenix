drop policy if exists "customers_select_portal_user" on public.customers;
drop policy if exists "properties_select_portal_user" on public.properties;
drop policy if exists "orders_select_portal_user" on public.orders;
drop policy if exists "order_items_select_portal_user" on public.order_items;
drop policy if exists "order_status_history_select_portal_user" on public.order_status_history;
drop policy if exists "pickups_select_portal_user" on public.pickups;
drop policy if exists "deliveries_select_portal_user" on public.deliveries;
drop policy if exists "order_photos_select_portal_user" on public.order_photos;

create function public.customer_portal_current_access()
returns table (
  access_id uuid,
  organization_id uuid,
  customer_id uuid,
  customer_name text,
  customer_email text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    access.id,
    access.organization_id,
    access.customer_id,
    customer.display_name,
    coalesce(customer.email, access.email)
  from public.customer_portal_access access
  join public.customers customer
    on customer.organization_id = access.organization_id
   and customer.id = access.customer_id
  where access.user_id = auth.uid()
    and access.is_active
    and customer.is_active
  order by access.created_at
  limit 1;
$$;

create function public.list_customer_portal_orders()
returns table (
  id uuid,
  order_number text,
  production_status public.production_status,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz,
  property_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    orders.id,
    orders.order_number,
    orders.production_status,
    orders.due_at,
    orders.completed_at,
    orders.created_at,
    property.name
  from public.orders orders
  join public.customer_portal_access access
    on access.organization_id = orders.organization_id
   and access.customer_id = orders.customer_id
  left join public.properties property
    on property.organization_id = orders.organization_id
   and property.id = orders.property_id
  where access.user_id = auth.uid()
    and access.is_active
    and orders.is_active
    and orders.production_status <> 'cancelled'
  order by orders.created_at desc
  limit 100;
$$;

create function public.get_customer_portal_order(target_order_id uuid)
returns table (
  id uuid,
  order_number text,
  production_status public.production_status,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz,
  property_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    orders.id,
    orders.order_number,
    orders.production_status,
    orders.due_at,
    orders.completed_at,
    orders.created_at,
    property.name
  from public.orders orders
  join public.customer_portal_access access
    on access.organization_id = orders.organization_id
   and access.customer_id = orders.customer_id
  left join public.properties property
    on property.organization_id = orders.organization_id
   and property.id = orders.property_id
  where access.user_id = auth.uid()
    and access.is_active
    and orders.id = target_order_id
    and orders.is_active
    and orders.production_status <> 'cancelled'
  limit 1;
$$;

create function public.list_customer_portal_order_items(target_order_id uuid)
returns table (
  id uuid,
  description text,
  unit_type public.service_unit_type,
  quantity numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    item.id,
    item.description,
    item.unit_type,
    item.quantity
  from public.order_items item
  join public.orders orders
    on orders.organization_id = item.organization_id
   and orders.id = item.order_id
  join public.customer_portal_access access
    on access.organization_id = orders.organization_id
   and access.customer_id = orders.customer_id
  where access.user_id = auth.uid()
    and access.is_active
    and item.order_id = target_order_id
    and item.is_active
    and orders.is_active
    and orders.production_status <> 'cancelled'
  order by item.sort_order;
$$;

create function public.list_customer_portal_order_history(target_order_id uuid)
returns table (
  id uuid,
  to_status public.production_status,
  changed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    history.id,
    history.to_status,
    history.changed_at
  from public.order_status_history history
  join public.orders orders
    on orders.organization_id = history.organization_id
   and orders.id = history.order_id
  join public.customer_portal_access access
    on access.organization_id = orders.organization_id
   and access.customer_id = orders.customer_id
  where access.user_id = auth.uid()
    and access.is_active
    and history.order_id = target_order_id
    and orders.is_active
    and orders.production_status <> 'cancelled'
  order by history.changed_at desc;
$$;

create function public.list_customer_portal_logistics(target_order_id uuid)
returns table (
  kind text,
  status public.fulfillment_status,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  address_line1 text,
  address_line2 text,
  city text,
  postal_code text,
  country_code character,
  contact_phone text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    'pickup'::text,
    pickup.status,
    pickup.scheduled_at,
    pickup.started_at,
    pickup.completed_at,
    pickup.address_line1,
    pickup.address_line2,
    pickup.city,
    pickup.postal_code,
    pickup.country_code,
    pickup.contact_phone
  from public.pickups pickup
  join public.orders orders
    on orders.organization_id = pickup.organization_id
   and orders.id = pickup.order_id
  join public.customer_portal_access access
    on access.organization_id = orders.organization_id
   and access.customer_id = orders.customer_id
  where access.user_id = auth.uid()
    and access.is_active
    and pickup.order_id = target_order_id
    and pickup.status <> 'cancelled'
    and orders.is_active
    and orders.production_status <> 'cancelled'
  union all
  select
    'delivery'::text,
    delivery.status,
    delivery.scheduled_at,
    delivery.started_at,
    delivery.completed_at,
    delivery.address_line1,
    delivery.address_line2,
    delivery.city,
    delivery.postal_code,
    delivery.country_code,
    delivery.contact_phone
  from public.deliveries delivery
  join public.orders orders
    on orders.organization_id = delivery.organization_id
   and orders.id = delivery.order_id
  join public.customer_portal_access access
    on access.organization_id = orders.organization_id
   and access.customer_id = orders.customer_id
  where access.user_id = auth.uid()
    and access.is_active
    and delivery.order_id = target_order_id
    and delivery.status <> 'cancelled'
    and orders.is_active
    and orders.production_status <> 'cancelled';
$$;

create function public.list_customer_portal_order_photos(target_order_id uuid)
returns table (
  id uuid,
  category public.photo_category,
  storage_bucket text,
  storage_path text,
  original_filename text,
  mime_type text,
  size_bytes bigint,
  caption text,
  created_at timestamptz,
  is_active boolean,
  customer_visible boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    photo.id,
    photo.category,
    photo.storage_bucket,
    photo.storage_path,
    photo.original_filename,
    photo.mime_type,
    photo.size_bytes,
    photo.caption,
    photo.created_at,
    photo.is_active,
    photo.customer_visible
  from public.order_photos photo
  join public.orders orders
    on orders.organization_id = photo.organization_id
   and orders.id = photo.order_id
  join public.customer_portal_access access
    on access.organization_id = orders.organization_id
   and access.customer_id = orders.customer_id
  where access.user_id = auth.uid()
    and access.is_active
    and photo.order_id = target_order_id
    and photo.is_active
    and photo.customer_visible
    and orders.is_active
    and orders.production_status <> 'cancelled'
  order by photo.created_at desc;
$$;

create function public.list_customer_portal_next_tasks()
returns table (
  kind text,
  order_id uuid,
  order_number text,
  status public.fulfillment_status,
  scheduled_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select *
  from (
    select
      'pickup'::text as kind,
      orders.id as order_id,
      orders.order_number,
      pickup.status,
      pickup.scheduled_at
    from public.pickups pickup
    join public.orders orders
      on orders.organization_id = pickup.organization_id
     and orders.id = pickup.order_id
    join public.customer_portal_access access
      on access.organization_id = orders.organization_id
     and access.customer_id = orders.customer_id
    where access.user_id = auth.uid()
      and access.is_active
      and pickup.status in ('scheduled', 'in_progress')
      and pickup.scheduled_at >= now()
      and orders.is_active
      and orders.production_status <> 'cancelled'
    union all
    select
      'delivery'::text as kind,
      orders.id as order_id,
      orders.order_number,
      delivery.status,
      delivery.scheduled_at
    from public.deliveries delivery
    join public.orders orders
      on orders.organization_id = delivery.organization_id
     and orders.id = delivery.order_id
    join public.customer_portal_access access
      on access.organization_id = orders.organization_id
     and access.customer_id = orders.customer_id
    where access.user_id = auth.uid()
      and access.is_active
      and delivery.status in ('scheduled', 'in_progress')
      and delivery.scheduled_at >= now()
      and orders.is_active
      and orders.production_status <> 'cancelled'
  ) tasks
  order by tasks.scheduled_at
  limit 1;
$$;

create function public.can_access_customer_order_photo(
  target_bucket text,
  target_path text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.order_photos photo
    join public.orders orders
      on orders.organization_id = photo.organization_id
     and orders.id = photo.order_id
    join public.customer_portal_access access
      on access.organization_id = orders.organization_id
     and access.customer_id = orders.customer_id
    where photo.storage_bucket = target_bucket
      and photo.storage_path = target_path
      and photo.is_active
      and photo.customer_visible
      and access.user_id = auth.uid()
      and access.is_active
      and orders.is_active
      and orders.production_status <> 'cancelled'
  );
$$;

drop policy if exists "order_media_select_member" on storage.objects;

create policy "order_media_select_member"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'order-media'
  and public.app_order_media_path_is_valid(name)
  and exists (
    select 1
    from public.order_photos photo
    where photo.storage_bucket = storage.objects.bucket_id
      and photo.storage_path = storage.objects.name
      and photo.organization_id = public.app_order_media_path_organization_id(storage.objects.name)
      and photo.order_id = public.app_order_media_path_order_id(storage.objects.name)
      and photo.is_active
      and (
        public.is_organization_member(photo.organization_id)
        or public.can_access_customer_order_photo(storage.objects.bucket_id, storage.objects.name)
      )
  )
);

revoke all on function public.customer_portal_current_access() from public, anon;
revoke all on function public.list_customer_portal_orders() from public, anon;
revoke all on function public.get_customer_portal_order(uuid) from public, anon;
revoke all on function public.list_customer_portal_order_items(uuid) from public, anon;
revoke all on function public.list_customer_portal_order_history(uuid) from public, anon;
revoke all on function public.list_customer_portal_logistics(uuid) from public, anon;
revoke all on function public.list_customer_portal_order_photos(uuid) from public, anon;
revoke all on function public.list_customer_portal_next_tasks() from public, anon;
revoke all on function public.can_access_customer_order_photo(text, text) from public, anon;

grant execute on function public.customer_portal_current_access() to authenticated;
grant execute on function public.list_customer_portal_orders() to authenticated;
grant execute on function public.get_customer_portal_order(uuid) to authenticated;
grant execute on function public.list_customer_portal_order_items(uuid) to authenticated;
grant execute on function public.list_customer_portal_order_history(uuid) to authenticated;
grant execute on function public.list_customer_portal_logistics(uuid) to authenticated;
grant execute on function public.list_customer_portal_order_photos(uuid) to authenticated;
grant execute on function public.list_customer_portal_next_tasks() to authenticated;
grant execute on function public.can_access_customer_order_photo(text, text) to authenticated;
