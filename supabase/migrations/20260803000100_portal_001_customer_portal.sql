create table public.customer_portal_access (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null,
  customer_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  is_active boolean not null default true,
  invited_by uuid references public.profiles (id) on delete set null,
  disabled_by uuid references public.profiles (id) on delete set null,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_portal_access_customer_same_org foreign key (
    organization_id,
    customer_id
  ) references public.customers (organization_id, id) on delete cascade,
  constraint customer_portal_access_email_lowercase check (email = lower(email)),
  constraint customer_portal_access_disabled_audit check (
    is_active
    or (disabled_by is not null and disabled_at is not null)
  )
);

create unique index customer_portal_access_customer_unique
on public.customer_portal_access (organization_id, customer_id);

create unique index customer_portal_access_user_customer_unique
on public.customer_portal_access (user_id, customer_id);

create index customer_portal_access_user_active_idx
on public.customer_portal_access (user_id, is_active);

create index customer_portal_access_org_active_idx
on public.customer_portal_access (organization_id, is_active);

create trigger customer_portal_access_set_updated_at
before update on public.customer_portal_access
for each row execute function public.set_updated_at();

alter table public.order_photos
add column customer_visible boolean not null default false;

create index order_photos_customer_visible_idx
on public.order_photos (organization_id, order_id, customer_visible)
where is_active and customer_visible;

create function public.upsert_customer_portal_access(
  target_customer_id uuid,
  target_user_id uuid,
  target_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_profile_id uuid := auth.uid();
  org_id uuid;
  access_id uuid;
begin
  select customer.organization_id
  into org_id
  from public.customers customer
  where customer.id = target_customer_id
    and customer.is_active;

  if org_id is null then
    raise exception 'invalid customer';
  end if;

  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'not authorized';
  end if;

  insert into public.customer_portal_access (
    organization_id,
    customer_id,
    user_id,
    email,
    is_active,
    invited_by,
    disabled_by,
    disabled_at
  )
  values (
    org_id,
    target_customer_id,
    target_user_id,
    lower(btrim(target_email)),
    true,
    actor_profile_id,
    null,
    null
  )
  on conflict (organization_id, customer_id)
  do update
  set user_id = excluded.user_id,
      email = excluded.email,
      is_active = true,
      invited_by = excluded.invited_by,
      disabled_by = null,
      disabled_at = null
  returning id into access_id;

  return access_id;
end;
$$;

create function public.update_customer_portal_access(
  target_access_id uuid,
  target_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_profile_id uuid := auth.uid();
  org_id uuid;
begin
  select access.organization_id
  into org_id
  from public.customer_portal_access access
  where access.id = target_access_id;

  if org_id is null then
    raise exception 'invalid customer access';
  end if;

  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'not authorized';
  end if;

  update public.customer_portal_access
  set is_active = target_is_active,
      disabled_by = case when target_is_active then null else actor_profile_id end,
      disabled_at = case when target_is_active then null else now() end
  where id = target_access_id;
end;
$$;

create function public.set_order_photo_customer_visibility(
  target_photo_id uuid,
  target_customer_visible boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
begin
  select photo.organization_id
  into org_id
  from public.order_photos photo
  where photo.id = target_photo_id
    and photo.is_active;

  if org_id is null then
    raise exception 'invalid photo';
  end if;

  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'not authorized';
  end if;

  update public.order_photos
  set customer_visible = target_customer_visible
  where id = target_photo_id
    and organization_id = org_id
    and is_active;
end;
$$;

alter table public.customer_portal_access enable row level security;

create policy "customer_portal_access_select_self_or_manager"
on public.customer_portal_access
for select
to authenticated
using (
  user_id = auth.uid()
  or public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[])
);

create policy "customers_select_portal_user"
on public.customers
for select
to authenticated
using (
  exists (
    select 1
    from public.customer_portal_access access
    where access.organization_id = customers.organization_id
      and access.customer_id = customers.id
      and access.user_id = auth.uid()
      and access.is_active
  )
);

create policy "properties_select_portal_user"
on public.properties
for select
to authenticated
using (
  exists (
    select 1
    from public.customer_portal_access access
    where access.organization_id = properties.organization_id
      and access.customer_id = properties.customer_id
      and access.user_id = auth.uid()
      and access.is_active
  )
);

create policy "orders_select_portal_user"
on public.orders
for select
to authenticated
using (
  exists (
    select 1
    from public.customer_portal_access access
    where access.organization_id = orders.organization_id
      and access.customer_id = orders.customer_id
      and access.user_id = auth.uid()
      and access.is_active
  )
);

create policy "order_items_select_portal_user"
on public.order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.orders target_order
    join public.customer_portal_access access
      on access.organization_id = target_order.organization_id
     and access.customer_id = target_order.customer_id
    where target_order.organization_id = order_items.organization_id
      and target_order.id = order_items.order_id
      and access.user_id = auth.uid()
      and access.is_active
  )
);

create policy "order_status_history_select_portal_user"
on public.order_status_history
for select
to authenticated
using (
  exists (
    select 1
    from public.orders target_order
    join public.customer_portal_access access
      on access.organization_id = target_order.organization_id
     and access.customer_id = target_order.customer_id
    where target_order.organization_id = order_status_history.organization_id
      and target_order.id = order_status_history.order_id
      and access.user_id = auth.uid()
      and access.is_active
  )
);

create policy "pickups_select_portal_user"
on public.pickups
for select
to authenticated
using (
  exists (
    select 1
    from public.orders target_order
    join public.customer_portal_access access
      on access.organization_id = target_order.organization_id
     and access.customer_id = target_order.customer_id
    where target_order.organization_id = pickups.organization_id
      and target_order.id = pickups.order_id
      and access.user_id = auth.uid()
      and access.is_active
  )
);

create policy "deliveries_select_portal_user"
on public.deliveries
for select
to authenticated
using (
  exists (
    select 1
    from public.orders target_order
    join public.customer_portal_access access
      on access.organization_id = target_order.organization_id
     and access.customer_id = target_order.customer_id
    where target_order.organization_id = deliveries.organization_id
      and target_order.id = deliveries.order_id
      and access.user_id = auth.uid()
      and access.is_active
  )
);

create policy "order_photos_select_portal_user"
on public.order_photos
for select
to authenticated
using (
  is_active
  and customer_visible
  and exists (
    select 1
    from public.orders target_order
    join public.customer_portal_access access
      on access.organization_id = target_order.organization_id
     and access.customer_id = target_order.customer_id
    where target_order.organization_id = order_photos.organization_id
      and target_order.id = order_photos.order_id
      and access.user_id = auth.uid()
      and access.is_active
  )
);

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
        or (
          photo.customer_visible
          and exists (
            select 1
            from public.orders target_order
            join public.customer_portal_access access
              on access.organization_id = target_order.organization_id
             and access.customer_id = target_order.customer_id
            where target_order.organization_id = photo.organization_id
              and target_order.id = photo.order_id
              and access.user_id = auth.uid()
              and access.is_active
          )
        )
      )
  )
);

grant select on public.customer_portal_access to authenticated;

revoke all on function public.upsert_customer_portal_access(uuid, uuid, text) from public, anon;
revoke all on function public.update_customer_portal_access(uuid, boolean) from public, anon;
revoke all on function public.set_order_photo_customer_visibility(uuid, boolean) from public, anon;

grant execute on function public.upsert_customer_portal_access(uuid, uuid, text) to authenticated;
grant execute on function public.update_customer_portal_access(uuid, boolean) to authenticated;
grant execute on function public.set_order_photo_customer_visibility(uuid, boolean) to authenticated;
