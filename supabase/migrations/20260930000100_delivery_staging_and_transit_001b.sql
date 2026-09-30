-- DELIVERY-STAGING-AND-TRANSIT-001B: physical delivery custody and return.
alter table public.warehouse_movements
  add column delivery_id uuid,
  add constraint warehouse_movements_delivery_same_org
    foreign key (organization_id, delivery_id)
    references public.deliveries (organization_id, id) on delete restrict,
  drop constraint warehouse_movements_source_check,
  add constraint warehouse_movements_source_check check (source in (
    'canonical_receipt', 'manual_assignment', 'manual_move', 'manual_update',
    'customer_handoff', 'delivery_completed', 'cancelled_return', 'production_ready',
    'delivery_started', 'delivery_returned'
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
  event_delivery_id uuid;
  event_actor uuid := auth.uid();
  event_actor_name text;
  previous_label text;
  next_label text;
  scope_row public.order_storage%rowtype;
begin
  movement_source := nullif(current_setting('app.warehouse_movement_source', true), '');
  if tg_op = 'INSERT' then
    if movement_source not in ('canonical_receipt', 'manual_storage', 'delivery_return') or movement_source is null then
      raise exception 'warehouse_movement_source_required' using errcode = '42501';
    end if;
    event_type := 'entered';
    if movement_source = 'delivery_return' then
      event_delivery_id := nullif(current_setting('app.warehouse_delivery_id', true), '')::uuid;
      if not exists (
        select 1 from public.deliveries delivery
        where delivery.organization_id = new.organization_id
          and delivery.order_id = new.order_id
          and delivery.id = event_delivery_id
          and delivery.status = 'cancelled'
      ) then
        raise exception 'warehouse_delivery_return_invalid' using errcode = '22023';
      end if;
      event_source := 'delivery_returned';
      event_note := nullif(current_setting('app.warehouse_movement_note', true), '');
    else
      event_source := case when movement_source = 'canonical_receipt'
        then 'canonical_receipt' else 'manual_assignment' end;
    end if;
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
    if movement_source = 'delivery_start' then
      event_delivery_id := nullif(current_setting('app.warehouse_delivery_id', true), '')::uuid;
      if not exists (
        select 1 from public.deliveries delivery
        where delivery.organization_id = old.organization_id
          and delivery.order_id = old.order_id
          and delivery.id = event_delivery_id
          and delivery.status = 'in_progress'
      ) then
        raise exception 'warehouse_delivery_start_invalid' using errcode = '22023';
      end if;
      event_source := 'delivery_started';
    elsif movement_source = 'cancelled_return' then
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
    organization_id, order_id, delivery_id, storage_id, location_id, actor_id, actor_name,
    movement_type, source, from_position_id, to_position_id,
    from_position_label, to_position_label, from_package_count, to_package_count,
    from_storage_mode, to_storage_mode, note
  ) values (
    scope_row.organization_id, scope_row.order_id, event_delivery_id, scope_row.id, scope_row.location_id,
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

-- A transit order cannot be silently placed back in current storage.
create function public.prevent_transit_order_storage()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1 from public.deliveries delivery
    where delivery.organization_id = new.organization_id
      and delivery.order_id = new.order_id
      and delivery.status in ('in_progress', 'completed')
  ) then
    raise exception 'delivery_fulfillment_storage_forbidden' using errcode = '55000';
  end if;
  return new;
end;
$$;
create trigger order_storage_prevent_transit
before insert or update on public.order_storage
for each row execute function public.prevent_transit_order_storage();
revoke all on function public.prevent_transit_order_storage() from public, anon, authenticated;

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
  org_id uuid := public.app_current_organization_id();
  actor_role public.app_role;
  current_status public.fulfillment_status;
  current_assigned_to uuid;
  parent_order_id uuid;
  parent_is_active boolean;
  parent_production_status public.production_status;
  current_storage public.order_storage%rowtype;
  allowed boolean := false;
  previous_source text;
  previous_delivery_id text;
begin
  select membership.role into actor_role
  from public.organization_memberships membership
  where membership.organization_id = org_id
    and membership.profile_id = auth.uid()
    and membership.is_active;

  select delivery.status, delivery.assigned_to, orders.id,
         orders.is_active, orders.production_status
  into current_status, current_assigned_to, parent_order_id,
       parent_is_active, parent_production_status
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
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if target_status in ('in_progress', 'completed')
    and exists (
      select 1 from public.order_customer_handoffs handoff
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

  if current_status = 'scheduled' and target_status = 'in_progress' then
    if not parent_is_active or parent_production_status <> 'completed' then
      raise exception 'delivery_start_production_incomplete' using errcode = '55000';
    end if;
    select * into current_storage from public.order_storage storage
    where storage.organization_id = org_id and storage.order_id = parent_order_id
    for update;
    if current_storage.id is null then
      raise exception 'delivery_start_storage_missing' using errcode = '55000';
    end if;
  elsif current_status = 'in_progress' and target_status = 'cancelled' then
    -- Pre-001B deliveries still in storage have not physically departed.
    if not exists (
      select 1 from public.order_storage storage
      where storage.organization_id = org_id and storage.order_id = parent_order_id
    ) then
      raise exception 'delivery_return_required' using errcode = '55000';
    end if;
  end if;

  perform set_config('app.app_007_mutation', 'on', true);
  update public.deliveries
  set status = target_status,
      started_at = case when target_status = 'in_progress' and started_at is null then now() else started_at end,
      completed_at = case when target_status = 'completed' then now() else completed_at end,
      cancellation_reason = case when target_status = 'cancelled' then nullif(btrim(target_reason), '') else cancellation_reason end,
      updated_by = auth.uid()
  where id = target_delivery_id and organization_id = org_id;

  if current_status = 'scheduled' and target_status = 'in_progress' then
    previous_source := current_setting('app.warehouse_movement_source', true);
    previous_delivery_id := current_setting('app.warehouse_delivery_id', true);
    perform set_config('app.warehouse_movement_source', 'delivery_start', true);
    perform set_config('app.warehouse_delivery_id', target_delivery_id::text, true);
    delete from public.order_storage
    where organization_id = org_id and order_id = parent_order_id;
    perform set_config('app.warehouse_movement_source', coalesce(previous_source, ''), true);
    perform set_config('app.warehouse_delivery_id', coalesce(previous_delivery_id, ''), true);
  elsif target_status = 'completed' then
    -- Legacy in-progress deliveries can still hold current storage.
    delete from public.order_storage
    where organization_id = org_id and order_id = parent_order_id;
  end if;
end;
$$;

create function public.return_delivery_to_warehouse(
  target_delivery_id uuid,
  target_position_id uuid,
  target_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid := public.app_current_organization_id();
  actor_role public.app_role;
  current_status public.fulfillment_status;
  current_assigned_to uuid;
  parent_order_id uuid;
  parent_location_id uuid;
  parent_is_active boolean;
  snapshot_count integer;
  snapshot_mode public.order_storage_mode;
  previous_source text;
  previous_note text;
  previous_delivery_id text;
begin
  select membership.role into actor_role
  from public.organization_memberships membership
  where membership.organization_id = org_id
    and membership.profile_id = auth.uid()
    and membership.is_active;

  select delivery.status, delivery.assigned_to, orders.id, orders.location_id,
         orders.is_active
  into current_status, current_assigned_to, parent_order_id, parent_location_id,
       parent_is_active
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
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if current_status <> 'in_progress' or not parent_is_active then
    raise exception 'delivery_return_status_invalid' using errcode = '55000';
  end if;
  if nullif(btrim(target_reason), '') is null or char_length(btrim(target_reason)) > 500 then
    raise exception 'delivery_return_reason_required' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.order_storage storage
    where storage.organization_id = org_id and storage.order_id = parent_order_id
  ) then
    raise exception 'delivery_return_storage_exists' using errcode = '55000';
  end if;

  perform 1 from public.warehouse_positions position
    join public.locations location
      on location.organization_id = position.organization_id
     and location.id = position.location_id
    where position.organization_id = org_id
      and position.location_id = parent_location_id
      and position.id = target_position_id
      and position.is_active
      and not position.is_default_inbound
      and location.is_active
      and location.deleted_at is null
  for share of position, location;
  if not found then
    raise exception 'delivery_return_position_invalid' using errcode = '22023';
  end if;

  select movement.from_package_count, movement.from_storage_mode
  into snapshot_count, snapshot_mode
  from public.warehouse_movements movement
  where movement.organization_id = org_id
    and movement.order_id = parent_order_id
    and movement.delivery_id = target_delivery_id
    and movement.movement_type = 'exited'
    and movement.source = 'delivery_started'
  order by movement.occurred_at desc, movement.id desc
  limit 1;
  if snapshot_count is null or snapshot_mode is null then
    raise exception 'delivery_return_snapshot_missing' using errcode = '55000';
  end if;

  perform set_config('app.app_007_mutation', 'on', true);
  update public.deliveries
  set status = 'cancelled', cancellation_reason = btrim(target_reason), updated_by = auth.uid()
  where id = target_delivery_id and organization_id = org_id;

  previous_source := current_setting('app.warehouse_movement_source', true);
  previous_note := current_setting('app.warehouse_movement_note', true);
  previous_delivery_id := current_setting('app.warehouse_delivery_id', true);
  perform set_config('app.warehouse_movement_source', 'delivery_return', true);
  perform set_config('app.warehouse_movement_note', btrim(target_reason), true);
  perform set_config('app.warehouse_delivery_id', target_delivery_id::text, true);
  insert into public.order_storage (
    organization_id, order_id, location_id, warehouse_position_id,
    package_count, storage_mode, entered_at
  ) values (
    org_id, parent_order_id, parent_location_id, target_position_id,
    snapshot_count, snapshot_mode, now()
  );
  perform set_config('app.warehouse_movement_source', coalesce(previous_source, ''), true);
  perform set_config('app.warehouse_movement_note', coalesce(previous_note, ''), true);
  perform set_config('app.warehouse_delivery_id', coalesce(previous_delivery_id, ''), true);
end;
$$;
revoke all on function public.return_delivery_to_warehouse(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.return_delivery_to_warehouse(uuid, uuid, text) to authenticated;
