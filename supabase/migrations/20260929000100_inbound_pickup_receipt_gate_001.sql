-- Block manual receipt while inbound pickup still holds physical custody.
-- The pickup completion and Quick Drop intake paths remain unchanged.
create or replace function public.transition_order_status(
  target_order_id uuid,
  target_status public.production_status,
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
  current_status public.production_status;
  current_assigned_to uuid;
  order_location_id uuid;
  default_assignee_id uuid;
  previous_status public.production_status;
  required_capability public.operational_capability;
  reason_text text;
  allowed boolean := false;
begin
  org_id := public.app_current_organization_id();
  reason_text := nullif(btrim(target_reason), '');

  select membership.role into actor_role
  from public.organization_memberships membership
  where membership.organization_id = org_id
    and membership.profile_id = auth.uid()
    and membership.is_active;

  select production_status, assigned_to, location_id
  into current_status, current_assigned_to, order_location_id
  from public.orders
  where id = target_order_id
    and organization_id = org_id
    and is_active
  for update;

  if current_status is null then
    raise exception 'invalid order';
  end if;

  -- Resolve only on the first received -> washing transition. Lock the eligible
  -- membership so it cannot become stale before the order update commits.
  if current_status = 'received' and target_status = 'washing'
    and current_assigned_to is null then
    select location.default_production_assignee_id into default_assignee_id
    from public.locations location
    join public.organization_memberships assignee
      on assignee.organization_id = location.organization_id
     and assignee.profile_id = location.default_production_assignee_id
    where location.organization_id = org_id
      and location.id = order_location_id
      and location.is_active
      and location.deleted_at is null
      and assignee.is_active
      and assignee.role = 'staff'
      and 'production'::public.operational_capability = any(assignee.operational_capabilities)
    for share of location, assignee;
  end if;

  required_capability := case
    when current_status in ('quality_check', 'packing') then 'quality'::public.operational_capability
    else 'production'::public.operational_capability
  end;

  if not public.has_operational_capability(org_id, required_capability)
    or (actor_role = 'staff'
      and coalesce(current_assigned_to, default_assignee_id) is distinct from auth.uid()) then
    raise exception 'not authorized';
  end if;

  if current_status in ('completed', 'cancelled') then
    raise exception 'final status cannot transition';
  end if;

  if target_status in ('on_hold', 'cancelled') and reason_text is null then
    raise exception 'reason required';
  end if;

  if current_status = 'draft' then
    allowed := target_status in ('received', 'cancelled');
  elsif current_status = 'received' then
    allowed := target_status in ('washing', 'ironing', 'quality_check', 'on_hold', 'cancelled');
  elsif current_status = 'washing' then
    allowed := target_status in ('drying', 'quality_check', 'on_hold');
  elsif current_status = 'drying' then
    allowed := target_status in ('ironing', 'quality_check', 'packing', 'on_hold');
  elsif current_status = 'ironing' then
    allowed := target_status in ('quality_check', 'packing', 'on_hold');
  elsif current_status = 'quality_check' then
    allowed := target_status in ('packing', 'on_hold');
  elsif current_status = 'packing' then
    allowed := target_status in ('ready', 'on_hold');
  elsif current_status = 'ready' then
    allowed := target_status in ('completed', 'on_hold');
  elsif current_status = 'on_hold' then
    select history.to_status
    into previous_status
    from public.order_status_history history
    where history.order_id = target_order_id
      and history.organization_id = org_id
      and history.to_status not in ('on_hold', 'cancelled', 'completed')
    order by history.changed_at desc
    limit 1;

    allowed := target_status = previous_status or target_status = 'cancelled';
  end if;

  if not allowed then
    raise exception 'transition not allowed';
  end if;

  if target_status in ('received', 'washing', 'drying', 'ironing', 'quality_check', 'packing', 'ready', 'completed')
    and exists (
      select 1
      from public.pickups pickup
      where pickup.organization_id = org_id
        and pickup.order_id = target_order_id
        and pickup.status in ('scheduled', 'in_progress')
    ) then
    raise exception 'inbound_pickup_incomplete';
  end if;

  if target_status = 'ready'
    and current_setting('app.ready_storage_transition', true) is distinct from 'on' then
    raise exception 'ready_warehouse_confirmation_required' using errcode = '22023';
  end if;

  -- Quick Drop and inbound pickup receipt use their own canonical intake paths.
  -- This RPC handles manual receipt, including return from on_hold.
  if target_status = 'received'
    or target_status in ('washing', 'drying', 'ironing', 'quality_check', 'packing', 'ready', 'completed') then
    perform public.assert_order_has_active_items(org_id, target_order_id);
  end if;

  perform set_config('app.workflow_transition', 'on', true);

  update public.orders
  set production_status = target_status,
      assigned_to = case
        when current_status = 'received' and target_status = 'washing' and assigned_to is null
          then default_assignee_id
        else assigned_to
      end,
      received_at = case when target_status = 'received' and received_at is null then now() else received_at end,
      completed_at = case when target_status = 'completed' then now() else null end,
      cancelled_at = case when target_status = 'cancelled' then now() else null end,
      cancellation_reason = case when target_status = 'cancelled' then reason_text else cancellation_reason end,
      on_hold_reason = case when target_status = 'on_hold' then reason_text else null end,
      updated_by = auth.uid()
  where id = target_order_id
    and organization_id = org_id;

  if target_status = 'cancelled' then
    perform set_config('app.app_007_mutation', 'on', true);

    update public.pickups
    set status = 'cancelled',
        cancellation_reason = reason_text,
        updated_by = auth.uid()
    where organization_id = org_id
      and order_id = target_order_id
      and status in ('scheduled', 'in_progress');

    update public.deliveries
    set status = 'cancelled',
        cancellation_reason = reason_text,
        updated_by = auth.uid()
    where organization_id = org_id
      and order_id = target_order_id
      and status in ('scheduled', 'in_progress');
  end if;

  insert into public.order_status_history (
    organization_id,
    order_id,
    from_status,
    to_status,
    reason,
    changed_by
  )
  values (
    org_id,
    target_order_id,
    current_status,
    target_status,
    reason_text,
    auth.uid()
  );
end;
$$;
