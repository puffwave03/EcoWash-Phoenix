-- Completing final Warehouse placement completes production, not fulfillment.
-- Existing ready orders keep their manual ready -> completed transition.
create or replace function public.transition_order_ready_with_storage(
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
  production_completed_at timestamptz;
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

  if current_storage.warehouse_position_id is distinct from target_position_id
    or current_storage.package_count is distinct from target_package_count
    or current_storage.storage_mode is distinct from target_storage_mode then
    previous_movement_source := current_setting('app.warehouse_movement_source', true);
    perform set_config('app.warehouse_movement_source', 'production_ready', true);
    update public.order_storage
    set warehouse_position_id = target_position_id,
        package_count = target_package_count,
        storage_mode = target_storage_mode,
        entered_at = case when warehouse_position_id is distinct from target_position_id then now() else entered_at end
    where organization_id = org_id and id = current_storage.id;
    perform set_config('app.warehouse_movement_source', coalesce(previous_movement_source, ''), true);
  end if;

  -- READY authorization and all final-placement checks have succeeded. Do not
  -- call the public transition again: its next-step capability can differ from
  -- the quality/packing capability already checked above.
  production_completed_at := now();
  update public.orders
  set production_status = 'completed',
      completed_at = production_completed_at,
      updated_by = auth.uid()
  where organization_id = org_id
    and id = target_order_id
    and production_status = 'ready'
    and is_active;
  if not found then
    raise exception 'ready_production_completion_failed' using errcode = '22023';
  end if;

  insert into public.order_status_history (
    organization_id, order_id, from_status, to_status, reason, changed_by
  ) values (
    org_id, target_order_id, 'ready', 'completed', null, auth.uid()
  );
end;
$$;
