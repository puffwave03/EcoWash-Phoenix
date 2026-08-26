create function public.protect_customer_lifecycle_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text := coalesce(auth.role(), '');
begin
  if tg_op = 'INSERT' then
    if not new.is_active
      and actor_role not in ('', 'service_role')
      and not public.has_organization_role(
        new.organization_id,
        array['owner', 'manager']::public.app_role[]
      )
    then
      raise exception 'customer_lifecycle_not_authorized' using errcode = '42501';
    end if;

    return new;
  end if;

  if new.is_active is distinct from old.is_active
    and actor_role not in ('', 'service_role')
    and not public.has_organization_role(
      old.organization_id,
      array['owner', 'manager']::public.app_role[]
    )
  then
    raise exception 'customer_lifecycle_not_authorized' using errcode = '42501';
  end if;

  if old.is_active and not new.is_active then
    update public.customer_portal_access
    set is_active = false,
        disabled_by = actor_id,
        disabled_at = coalesce(disabled_at, now())
    where organization_id = old.organization_id
      and customer_id = old.id
      and is_active;
  end if;

  return new;
end;
$$;

create trigger customers_protect_lifecycle_insert
before insert on public.customers
for each row execute function public.protect_customer_lifecycle_state();

create trigger customers_protect_lifecycle_update
before update of is_active on public.customers
for each row execute function public.protect_customer_lifecycle_state();

create function public.set_customer_lifecycle_active(
  target_customer_id uuid,
  target_is_active boolean
)
returns table (
  customer_id uuid,
  is_active boolean,
  portal_access_disabled boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  org_id uuid;
  current_is_active boolean;
  disabled_access boolean := false;
begin
  org_id := public.app_current_organization_id();

  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'customer_lifecycle_not_authorized' using errcode = '42501';
  end if;

  select customer.is_active
  into current_is_active
  from public.customers customer
  where customer.organization_id = org_id
    and customer.id = target_customer_id
  for update;

  if current_is_active is null then
    raise exception 'customer_lifecycle_invalid_customer' using errcode = '22023';
  end if;

  if current_is_active is distinct from target_is_active then
    select exists (
      select 1
      from public.customer_portal_access access
      where access.organization_id = org_id
        and access.customer_id = target_customer_id
        and access.is_active
    )
    into disabled_access;

    update public.customers
    set is_active = target_is_active,
        updated_by = actor_id
    where organization_id = org_id
      and id = target_customer_id;
  end if;

  return query
  select target_customer_id, target_is_active, disabled_access;
end;
$$;

create function public.get_customer_lifecycle_eligibility(target_customer_id uuid)
returns table (
  customer_id uuid,
  is_active boolean,
  can_deactivate boolean,
  can_reactivate boolean,
  can_anonymize boolean,
  can_hard_delete boolean,
  blocking_reasons text[],
  property_count bigint,
  portal_access_count bigint,
  order_count bigint,
  order_item_count bigint,
  order_history_count bigint,
  payment_count bigint,
  pickup_count bigint,
  delivery_count bigint,
  photo_count bigint,
  has_segment_assignment boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid;
  customer_active boolean;
  segment_assigned boolean;
  reasons text[] := array[]::text[];
  properties_total bigint;
  portal_total bigint;
  orders_total bigint;
  items_total bigint;
  history_total bigint;
  payments_total bigint;
  pickups_total bigint;
  deliveries_total bigint;
  photos_total bigint;
begin
  org_id := public.app_current_organization_id();

  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'customer_lifecycle_not_authorized' using errcode = '42501';
  end if;

  select customer.is_active, customer.catalog_segment_id is not null
  into customer_active, segment_assigned
  from public.customers customer
  where customer.organization_id = org_id
    and customer.id = target_customer_id;

  if customer_active is null then
    raise exception 'customer_lifecycle_invalid_customer' using errcode = '22023';
  end if;

  select count(*) into properties_total
  from public.properties property
  where property.organization_id = org_id
    and property.customer_id = target_customer_id;

  select count(*) into portal_total
  from public.customer_portal_access access
  where access.organization_id = org_id
    and access.customer_id = target_customer_id;

  select count(*) into orders_total
  from public.orders customer_order
  where customer_order.organization_id = org_id
    and customer_order.customer_id = target_customer_id;

  select count(*) into items_total
  from public.order_items item
  join public.orders customer_order
    on customer_order.organization_id = item.organization_id
   and customer_order.id = item.order_id
  where customer_order.organization_id = org_id
    and customer_order.customer_id = target_customer_id;

  select count(*) into history_total
  from public.order_status_history history
  join public.orders customer_order
    on customer_order.organization_id = history.organization_id
   and customer_order.id = history.order_id
  where customer_order.organization_id = org_id
    and customer_order.customer_id = target_customer_id;

  select count(*) into payments_total
  from public.payments payment
  join public.orders customer_order
    on customer_order.organization_id = payment.organization_id
   and customer_order.id = payment.order_id
  where customer_order.organization_id = org_id
    and customer_order.customer_id = target_customer_id;

  select count(*) into pickups_total
  from public.pickups pickup
  join public.orders customer_order
    on customer_order.organization_id = pickup.organization_id
   and customer_order.id = pickup.order_id
  where customer_order.organization_id = org_id
    and customer_order.customer_id = target_customer_id;

  select count(*) into deliveries_total
  from public.deliveries delivery
  join public.orders customer_order
    on customer_order.organization_id = delivery.organization_id
   and customer_order.id = delivery.order_id
  where customer_order.organization_id = org_id
    and customer_order.customer_id = target_customer_id;

  select count(*) into photos_total
  from public.order_photos photo
  join public.orders customer_order
    on customer_order.organization_id = photo.organization_id
   and customer_order.id = photo.order_id
  where customer_order.organization_id = org_id
    and customer_order.customer_id = target_customer_id;

  if customer_active then reasons := array_append(reasons, 'active_customer'); end if;
  if properties_total > 0 then reasons := array_append(reasons, 'properties'); end if;
  if portal_total > 0 then reasons := array_append(reasons, 'portal_access'); end if;
  if orders_total > 0 then reasons := array_append(reasons, 'orders'); end if;
  if items_total > 0 or history_total > 0 then reasons := array_append(reasons, 'order_history'); end if;
  if payments_total > 0 then reasons := array_append(reasons, 'payments'); end if;
  if pickups_total > 0 or deliveries_total > 0 then reasons := array_append(reasons, 'operational_history'); end if;
  if photos_total > 0 then reasons := array_append(reasons, 'media'); end if;
  if segment_assigned then reasons := array_append(reasons, 'segment_assignment'); end if;

  return query
  select
    target_customer_id,
    customer_active,
    customer_active,
    not customer_active,
    false,
    cardinality(reasons) = 0,
    reasons,
    properties_total,
    portal_total,
    orders_total,
    items_total,
    history_total,
    payments_total,
    pickups_total,
    deliveries_total,
    photos_total,
    segment_assigned;
end;
$$;

create or replace function public.update_customer_portal_access(
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
  customer_active boolean;
begin
  select access.organization_id, customer.is_active
  into org_id, customer_active
  from public.customer_portal_access access
  join public.customers customer
    on customer.organization_id = access.organization_id
   and customer.id = access.customer_id
  where access.id = target_access_id;

  if org_id is null then
    raise exception 'invalid customer access';
  end if;

  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'not authorized';
  end if;

  if target_is_active and not customer_active then
    raise exception 'customer_lifecycle_inactive_customer' using errcode = '55000';
  end if;

  update public.customer_portal_access
  set is_active = target_is_active,
      disabled_by = case when target_is_active then null else actor_profile_id end,
      disabled_at = case when target_is_active then null else now() end
  where id = target_access_id
    and organization_id = org_id;
end;
$$;

revoke all on function public.protect_customer_lifecycle_state() from public, anon, authenticated;
revoke all on function public.set_customer_lifecycle_active(uuid, boolean) from public, anon, authenticated;
revoke all on function public.get_customer_lifecycle_eligibility(uuid) from public, anon, authenticated;
revoke all on function public.update_customer_portal_access(uuid, boolean) from public, anon, authenticated;

grant execute on function public.set_customer_lifecycle_active(uuid, boolean) to authenticated;
grant execute on function public.get_customer_lifecycle_eligibility(uuid) to authenticated;
grant execute on function public.update_customer_portal_access(uuid, boolean) to authenticated;
