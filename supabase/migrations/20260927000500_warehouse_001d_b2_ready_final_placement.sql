-- WAREHOUSE-001D-B2: READY and final physical placement are one transaction.
-- Existing workflow signature, grants, authorization, and transition graph stay intact.
alter table public.warehouse_movements
  drop constraint warehouse_movements_source_check,
  add constraint warehouse_movements_source_check check (source in (
    'canonical_receipt', 'manual_assignment', 'manual_move', 'manual_update',
    'customer_handoff', 'delivery_completed', 'cancelled_return', 'production_ready'
  ));

create or replace function public.record_order_storage_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  movement_source text;
  event_source text;
  event_type text;
  event_note text;
  event_actor uuid := auth.uid();
  event_actor_name text;
  previous_label text;
  next_label text;
  scope_row public.order_storage%rowtype;
begin
  movement_source := nullif(current_setting('app.warehouse_movement_source', true), '');
  if tg_op = 'INSERT' then
    if movement_source not in ('canonical_receipt', 'manual_storage') or movement_source is null then
      raise exception 'warehouse_movement_source_required' using errcode = '42501';
    end if;
    event_type := 'entered';
    event_source := case when movement_source = 'canonical_receipt'
      then 'canonical_receipt' else 'manual_assignment' end;
    scope_row := new;
  elsif tg_op = 'UPDATE' then
    if movement_source not in ('manual_storage', 'production_ready') or movement_source is null then
      raise exception 'warehouse_movement_source_required' using errcode = '42501';
    end if;
    if new.organization_id is distinct from old.organization_id
      or new.order_id is distinct from old.order_id
      or new.location_id is distinct from old.location_id then
      raise exception 'warehouse_movement_scope_immutable' using errcode = '22023';
    end if;
    if new.warehouse_position_id is not distinct from old.warehouse_position_id
      and new.package_count is not distinct from old.package_count
      and new.storage_mode is not distinct from old.storage_mode then
      return new;
    end if;
    event_type := case when new.warehouse_position_id is distinct from old.warehouse_position_id
      then 'moved' else 'updated' end;
    event_source := case when movement_source = 'production_ready' then 'production_ready'
      when event_type = 'moved' then 'manual_move' else 'manual_update' end;
    scope_row := new;
  else
    scope_row := old;
    event_type := 'exited';
    if movement_source = 'cancelled_return' then
      if not exists (
        select 1 from public.orders orders
        where orders.organization_id = old.organization_id
          and orders.id = old.order_id
          and orders.production_status = 'cancelled'
      ) then
        raise exception 'warehouse_cancelled_return_invalid' using errcode = '22023';
      end if;
      event_source := 'cancelled_return';
      event_note := nullif(current_setting('app.warehouse_movement_note', true), '');
    elsif current_setting('app.customer_handoff_mutation', true) = 'on'
      and exists (
        select 1 from public.order_customer_handoffs handoff
        where handoff.organization_id = old.organization_id
          and handoff.order_id = old.order_id
      ) then
      event_source := 'customer_handoff';
    elsif current_setting('app.app_007_mutation', true) = 'on'
      and exists (
        select 1 from public.deliveries delivery
        where delivery.organization_id = old.organization_id
          and delivery.order_id = old.order_id
          and delivery.status = 'completed'
      ) then
      event_source := 'delivery_completed';
    else
      raise exception 'warehouse_exit_source_required' using errcode = '42501';
    end if;
  end if;

  if tg_op <> 'INSERT' then
    select concat_ws(' · ', position.code, nullif(position.name, '')) into previous_label
    from public.warehouse_positions position
    where position.organization_id = old.organization_id
      and position.id = old.warehouse_position_id;
  end if;
  if tg_op <> 'DELETE' then
    select concat_ws(' · ', position.code, nullif(position.name, '')) into next_label
    from public.warehouse_positions position
    where position.organization_id = new.organization_id
      and position.id = new.warehouse_position_id;
  end if;
  if event_actor is not null then
    select profile.display_name into event_actor_name
    from public.profiles profile where profile.id = event_actor;
  end if;

  perform set_config('app.warehouse_event_write', 'on', true);
  insert into public.warehouse_movements (
    organization_id, order_id, storage_id, location_id, actor_id, actor_name,
    movement_type, source, from_position_id, to_position_id,
    from_position_label, to_position_label, from_package_count, to_package_count,
    from_storage_mode, to_storage_mode, note
  ) values (
    scope_row.organization_id, scope_row.order_id, scope_row.id, scope_row.location_id,
    event_actor, event_actor_name, event_type, event_source,
    case when tg_op = 'INSERT' then null else old.warehouse_position_id end,
    case when tg_op = 'DELETE' then null else new.warehouse_position_id end,
    previous_label, next_label,
    case when tg_op = 'INSERT' then null else old.package_count end,
    case when tg_op = 'DELETE' then null else new.package_count end,
    case when tg_op = 'INSERT' then null else old.storage_mode end,
    case when tg_op = 'DELETE' then null else new.storage_mode end,
    event_note
  );
  perform set_config('app.warehouse_event_write', '', true);

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- ORDER-PICKUP-PRODUCTION-GATE-001 keeps inbound pickup and production
-- sequencing authoritative without rewriting existing UAT history.
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


create function public.transition_order_ready_with_storage(
  target_order_id uuid,
  target_position_id uuid,
  target_package_count integer,
  target_storage_mode public.order_storage_mode
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid := public.app_current_organization_id();
  order_location_id uuid;
  current_storage public.order_storage%rowtype;
  previous_ready_context text;
  previous_movement_source text;
begin
  -- Reuse the canonical transition's capability, assignment, status and pickup checks.
  -- Any later failure rolls that transition and its history back.
  previous_ready_context := current_setting('app.ready_storage_transition', true);
  perform set_config('app.ready_storage_transition', 'on', true);
  perform public.transition_order_status(target_order_id, 'ready'::public.production_status, null);
  perform set_config('app.ready_storage_transition', coalesce(previous_ready_context, ''), true);

  if target_package_count is null or target_package_count < 1 or target_storage_mode is null then
    raise exception 'ready_warehouse_values_invalid' using errcode = '22023';
  end if;

  select orders.location_id into order_location_id
  from public.orders orders
  join public.locations location
    on location.organization_id = orders.organization_id
   and location.id = orders.location_id
  where orders.organization_id = org_id
    and orders.id = target_order_id
    and location.is_active
    and location.deleted_at is null
  for share of location;
  if order_location_id is null then
    raise exception 'ready_warehouse_location_invalid' using errcode = '22023';
  end if;

  select * into current_storage from public.order_storage storage
  where storage.organization_id = org_id
    and storage.order_id = target_order_id
    and storage.location_id = order_location_id
  for update;
  if current_storage.id is null then
    raise exception 'ready_warehouse_storage_missing' using errcode = '22023';
  end if;

  perform 1 from public.warehouse_positions position
  where position.organization_id = org_id
    and position.location_id = order_location_id
    and position.id = target_position_id
    and position.is_active
    and not position.is_default_inbound
  for share;
  if not found then
    raise exception 'ready_warehouse_position_invalid' using errcode = '22023';
  end if;

  if current_storage.warehouse_position_id is not distinct from target_position_id
    and current_storage.package_count is not distinct from target_package_count
    and current_storage.storage_mode is not distinct from target_storage_mode then
    return;
  end if;

  previous_movement_source := current_setting('app.warehouse_movement_source', true);
  perform set_config('app.warehouse_movement_source', 'production_ready', true);
  update public.order_storage
  set warehouse_position_id = target_position_id,
      package_count = target_package_count,
      storage_mode = target_storage_mode,
      entered_at = case when warehouse_position_id is distinct from target_position_id then now() else entered_at end
  where organization_id = org_id and id = current_storage.id;
  perform set_config('app.warehouse_movement_source', coalesce(previous_movement_source, ''), true);
end;
$$;
revoke all on function public.transition_order_ready_with_storage(uuid, uuid, integer, public.order_storage_mode)
  from public, anon, authenticated;
grant execute on function public.transition_order_ready_with_storage(uuid, uuid, integer, public.order_storage_mode)
  to authenticated;
