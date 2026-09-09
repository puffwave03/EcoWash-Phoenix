-- ORDER-FULFILLMENT-LIFECYCLE-001 keeps planned draft logistics from
-- advancing into operational execution while preserving completed-production
-- orders as valid parents for open fulfillment work.
create or replace function public.transition_pickup_status(
  target_pickup_id uuid,
  target_status public.fulfillment_status,
  target_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  actor_role public.app_role;
  current_status public.fulfillment_status;
  current_assigned_to uuid;
  parent_is_active boolean;
  parent_production_status public.production_status;
  allowed boolean := false;
begin
  org_id := public.app_current_organization_id();

  select membership.role into actor_role
  from public.organization_memberships membership
  where membership.organization_id = org_id
    and membership.profile_id = auth.uid()
    and membership.is_active;

  select pickup.status,
         pickup.assigned_to,
         orders.is_active,
         orders.production_status
  into current_status,
       current_assigned_to,
       parent_is_active,
       parent_production_status
  from public.pickups pickup
  join public.orders orders
    on orders.organization_id = pickup.organization_id
   and orders.id = pickup.order_id
  where pickup.id = target_pickup_id
    and pickup.organization_id = org_id
  for update of pickup, orders;

  if current_status is null
    or not public.has_operational_capability(org_id, 'pickup')
    or (actor_role = 'staff' and current_assigned_to is distinct from auth.uid()) then
    raise exception 'not authorized';
  end if;

  if target_status in ('in_progress', 'completed')
    and (not parent_is_active or parent_production_status in ('draft', 'cancelled')) then
    raise exception 'logistics parent not operational';
  end if;

  if current_status = 'scheduled' then
    allowed := target_status in ('in_progress', 'cancelled');
  elsif current_status = 'in_progress' then
    allowed := target_status in ('completed', 'cancelled');
  end if;

  if not allowed then
    raise exception 'transition not allowed';
  end if;

  if target_status = 'cancelled' and nullif(btrim(target_reason), '') is null then
    raise exception 'reason required';
  end if;

  perform set_config('app.app_007_mutation', 'on', true);

  update public.pickups
  set status = target_status,
      started_at = case when target_status = 'in_progress' and started_at is null then now() else started_at end,
      completed_at = case when target_status = 'completed' then now() else completed_at end,
      cancellation_reason = case when target_status = 'cancelled' then nullif(btrim(target_reason), '') else cancellation_reason end,
      updated_by = auth.uid()
  where id = target_pickup_id and organization_id = org_id;
end;
$$;

create or replace function public.transition_delivery_status(
  target_delivery_id uuid,
  target_status public.fulfillment_status,
  target_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  actor_role public.app_role;
  current_status public.fulfillment_status;
  current_assigned_to uuid;
  parent_is_active boolean;
  parent_production_status public.production_status;
  allowed boolean := false;
begin
  org_id := public.app_current_organization_id();

  select membership.role into actor_role
  from public.organization_memberships membership
  where membership.organization_id = org_id
    and membership.profile_id = auth.uid()
    and membership.is_active;

  select delivery.status,
         delivery.assigned_to,
         orders.is_active,
         orders.production_status
  into current_status,
       current_assigned_to,
       parent_is_active,
       parent_production_status
  from public.deliveries delivery
  join public.orders orders
    on orders.organization_id = delivery.organization_id
   and orders.id = delivery.order_id
  where delivery.id = target_delivery_id
    and delivery.organization_id = org_id
  for update of delivery, orders;

  if current_status is null
    or not public.has_operational_capability(org_id, 'delivery')
    or (actor_role = 'staff' and current_assigned_to is distinct from auth.uid()) then
    raise exception 'not authorized';
  end if;

  if target_status in ('in_progress', 'completed')
    and (not parent_is_active or parent_production_status in ('draft', 'cancelled')) then
    raise exception 'logistics parent not operational';
  end if;

  if current_status = 'scheduled' then
    allowed := target_status in ('in_progress', 'cancelled');
  elsif current_status = 'in_progress' then
    allowed := target_status in ('completed', 'cancelled');
  end if;

  if not allowed then
    raise exception 'transition not allowed';
  end if;

  if target_status = 'cancelled' and nullif(btrim(target_reason), '') is null then
    raise exception 'reason required';
  end if;

  perform set_config('app.app_007_mutation', 'on', true);

  update public.deliveries
  set status = target_status,
      started_at = case when target_status = 'in_progress' and started_at is null then now() else started_at end,
      completed_at = case when target_status = 'completed' then now() else completed_at end,
      cancellation_reason = case when target_status = 'cancelled' then nullif(btrim(target_reason), '') else cancellation_reason end,
      updated_by = auth.uid()
  where id = target_delivery_id and organization_id = org_id;
end;
$$;
