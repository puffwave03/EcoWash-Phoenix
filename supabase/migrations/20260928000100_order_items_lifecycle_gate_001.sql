-- ORDER-ITEMS-LIFECYCLE-GATE-001: tenant-scoped active-item assertion.
-- All calling canonical RPCs lock the parent order before this check; item
-- writes use the same order lock, so the check and status/storage writes serialize.
create function public.assert_order_has_active_items(
  target_organization_id uuid,
  target_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.order_items item
    where item.organization_id = target_organization_id
      and item.order_id = target_order_id
      and item.is_active = true
  ) then
    raise exception 'order_items_required' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.assert_order_has_active_items(uuid, uuid) from public, anon, authenticated;

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

  select production_status, assigned_to into current_status, current_assigned_to
  from public.orders
  where id = target_order_id
    and organization_id = org_id
    and is_active
  for update;

  if current_status is null then
    raise exception 'invalid order';
  end if;

  required_capability := case
    when current_status in ('quality_check', 'packing') then 'quality'::public.operational_capability
    else 'production'::public.operational_capability
  end;

  if not public.has_operational_capability(org_id, required_capability)
    or (actor_role = 'staff' and current_assigned_to is distinct from auth.uid()) then
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

  if target_status in ('washing', 'drying', 'ironing', 'quality_check', 'packing', 'ready', 'completed')
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



create or replace function public.complete_customer_handoff(
  target_order_id uuid,
  target_confirm_unpaid boolean,
  target_notes text
)
returns public.order_customer_handoffs
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  org_id uuid := public.app_current_organization_id();
  target_order public.orders%rowtype;
  canonical_handoff public.order_customer_handoffs%rowtype;
  current_balance numeric(12,2);
begin
  if actor_id is null then
    raise exception 'customer_handoff_not_authorized' using errcode = '42501';
  end if;

  perform public.require_pos_access(org_id);

  select * into target_order
  from public.orders orders
  where orders.id = target_order_id
    and orders.organization_id = org_id
  for update;

  if target_order.id is null or not target_order.is_active or target_order.production_status = 'cancelled' then
    raise exception 'customer_handoff_invalid_order' using errcode = '22023';
  end if;

  if target_order.production_status <> 'completed' then
    raise exception 'customer_handoff_production_incomplete' using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.deliveries delivery
    where delivery.organization_id = org_id
      and delivery.order_id = target_order_id
      and delivery.status in ('scheduled', 'in_progress', 'completed')
  ) then
    raise exception 'customer_handoff_delivery_conflict' using errcode = '55000';
  end if;

  select * into canonical_handoff
  from public.order_customer_handoffs handoff
  where handoff.organization_id = org_id
    and handoff.order_id = target_order_id;

  if canonical_handoff.id is not null then
    return canonical_handoff;
  end if;

  perform public.assert_order_has_active_items(org_id, target_order_id);

  select summary.balance_due
  into current_balance
  from public.get_order_payment_summary(target_order_id) summary;

  if current_balance > 0 and not coalesce(target_confirm_unpaid, false) then
    raise exception 'customer_handoff_unpaid_confirmation_required' using errcode = '55000';
  end if;

  perform set_config('app.customer_handoff_mutation', 'on', true);

  insert into public.order_customer_handoffs (
    organization_id,
    order_id,
    location_id,
    completed_at,
    completed_by,
    notes,
    balance_due_at_handoff,
    balance_currency,
    unpaid_balance_acknowledged
  )
  values (
    org_id,
    target_order_id,
    target_order.location_id,
    now(),
    actor_id,
    nullif(left(btrim(target_notes), 1000), ''),
    current_balance,
    target_order.currency,
    current_balance > 0
  )
  returning * into canonical_handoff;

  delete from public.order_storage
  where organization_id = org_id
    and order_id = target_order_id;

  return canonical_handoff;
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
  parent_order_id uuid;
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
         orders.id,
         orders.is_active,
         orders.production_status
  into current_status,
       current_assigned_to,
       parent_order_id,
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
    and exists (
      select 1
      from public.order_customer_handoffs handoff
      where handoff.organization_id = org_id
        and handoff.order_id = parent_order_id
    ) then
    raise exception 'customer_handoff_already_completed' using errcode = '55000';
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

  if target_status = 'completed' then
    perform public.assert_order_has_active_items(org_id, parent_order_id);
  end if;

  perform set_config('app.app_007_mutation', 'on', true);

  update public.deliveries
  set status = target_status,
      started_at = case when target_status = 'in_progress' and started_at is null then now() else started_at end,
      completed_at = case when target_status = 'completed' then now() else completed_at end,
      cancellation_reason = case when target_status = 'cancelled' then nullif(btrim(target_reason), '') else cancellation_reason end,
      updated_by = auth.uid()
  where id = target_delivery_id and organization_id = org_id;

  if target_status = 'completed' then
    delete from public.order_storage
    where organization_id = org_id
      and order_id = parent_order_id;
  end if;
end;
$$;
