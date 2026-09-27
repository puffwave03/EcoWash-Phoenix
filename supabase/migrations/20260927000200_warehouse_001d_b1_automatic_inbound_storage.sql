-- WAREHOUSE-001D-B1: physical intake only at canonical counter submission or pickup completion.
-- Triggers run inside their existing RPC transactions; no generic create_order or Portal hook.
create function public.ensure_warehouse_inbound_storage(
  target_organization_id uuid,
  target_order_id uuid,
  target_entered_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  order_location_id uuid;
  inbound_position_id uuid;
begin
  if target_organization_id is distinct from public.app_current_organization_id() then
    raise exception 'warehouse_inbound_tenant_invalid' using errcode = '42501';
  end if;

  select orders.location_id into order_location_id
  from public.orders orders
  join public.locations location
    on location.organization_id = orders.organization_id
   and location.id = orders.location_id
  where orders.organization_id = target_organization_id
    and orders.id = target_order_id
    and location.is_active
    and location.deleted_at is null
  for update of orders;

  if order_location_id is null then
    raise exception 'warehouse_inbound_order_location_invalid' using errcode = '22023';
  end if;

  -- A deliberate current placement already accounts for physical custody.
  if exists (
    select 1 from public.order_storage storage
    where storage.organization_id = target_organization_id
      and storage.order_id = target_order_id
  ) then
    return;
  end if;

  select position.id into inbound_position_id
  from public.warehouse_positions position
  join public.locations location
    on location.organization_id = position.organization_id
   and location.id = position.location_id
  where position.organization_id = target_organization_id
    and position.location_id = order_location_id
    and position.is_default_inbound
    and position.is_active
    and location.is_active
    and location.deleted_at is null
  for share of position, location;

  if inbound_position_id is null then
    raise exception 'warehouse_default_inbound_unavailable: configure an active default inbound position for this location'
      using errcode = '22023';
  end if;

  insert into public.order_storage (
    organization_id, order_id, location_id, warehouse_position_id,
    package_count, storage_mode, entered_at
  ) values (
    target_organization_id, target_order_id, order_location_id, inbound_position_id,
    1, 'other'::public.order_storage_mode, coalesce(target_entered_at, now())
  ) on conflict (organization_id, order_id) do nothing;
end;
$$;

-- Both submit_shop_terminal_order and create_quick_drop_order finalize the same
-- idempotency record only after their canonical order work succeeds.
create function public.stage_counter_submission_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  physical_intake_at timestamptz;
begin
  select orders.received_at into physical_intake_at
  from public.orders orders
  where orders.organization_id = new.organization_id
    and orders.id = new.order_id;

  perform public.ensure_warehouse_inbound_storage(
    new.organization_id, new.order_id, coalesce(physical_intake_at, now())
  );
  return new;
end;
$$;

create trigger shop_terminal_submission_inbound_storage
  after update of order_id on public.shop_terminal_submissions
  for each row
  when (old.order_id is null and new.order_id is not null)
  execute function public.stage_counter_submission_order();

create function public.stage_completed_inbound_pickup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_warehouse_inbound_storage(
    new.organization_id, new.order_id, new.completed_at
  );
  return new;
end;
$$;

create trigger pickup_completion_inbound_storage
  after update of status on public.pickups
  for each row
  when (old.status is distinct from 'completed' and new.status = 'completed')
  execute function public.stage_completed_inbound_pickup();

revoke all on function public.ensure_warehouse_inbound_storage(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.stage_counter_submission_order() from public, anon, authenticated;
revoke all on function public.stage_completed_inbound_pickup() from public, anon, authenticated;
