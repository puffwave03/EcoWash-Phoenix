-- WAREHOUSE-001E-A: history starts here; existing current placements are untouched.
create table public.warehouse_movements (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null,
  order_id uuid not null,
  storage_id uuid not null,
  location_id uuid not null,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  actor_name text,
  movement_type text not null check (movement_type in ('entered', 'moved', 'updated', 'exited')),
  source text not null check (source in (
    'canonical_receipt', 'manual_assignment', 'manual_move', 'manual_update',
    'customer_handoff', 'delivery_completed', 'cancelled_return'
  )),
  from_position_id uuid,
  to_position_id uuid,
  from_position_label text,
  to_position_label text,
  from_package_count integer,
  to_package_count integer,
  from_storage_mode public.order_storage_mode,
  to_storage_mode public.order_storage_mode,
  note text check (note is null or char_length(note) <= 500),
  constraint warehouse_movements_order_same_org foreign key (organization_id, order_id)
    references public.orders (organization_id, id) on delete restrict,
  constraint warehouse_movements_location_same_org foreign key (organization_id, location_id)
    references public.locations (organization_id, id) on delete restrict
);

create index warehouse_movements_order_timeline_idx
  on public.warehouse_movements (organization_id, order_id, occurred_at, id);

alter table public.warehouse_movements enable row level security;
create policy warehouse_movements_select_management
  on public.warehouse_movements for select to authenticated
  using (
    organization_id = public.app_current_organization_id()
    and public.has_organization_role(
      organization_id, array['owner', 'manager']::public.app_role[]
    )
  );
revoke all on public.warehouse_movements from public, anon, authenticated;
grant select on public.warehouse_movements to authenticated;

create function public.protect_warehouse_movements()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op <> 'INSERT' or current_setting('app.warehouse_event_write', true) <> 'on' then
    raise exception 'warehouse_movements_append_only' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger warehouse_movements_protect
  before insert or update or delete on public.warehouse_movements
  for each row execute function public.protect_warehouse_movements();
revoke all on function public.protect_warehouse_movements() from public, anon, authenticated;

-- Every physical mutation records exactly one event in its own transaction.
create function public.record_order_storage_movement()
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
    if movement_source is distinct from 'manual_storage' then
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
    event_source := case when event_type = 'moved' then 'manual_move' else 'manual_update' end;
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
create trigger order_storage_record_movement
  after insert or update or delete on public.order_storage
  for each row execute function public.record_order_storage_movement();
revoke all on function public.record_order_storage_movement() from public, anon, authenticated;

-- Preserve the deployed helper signature and all its tenant/location/idempotency guards.
create or replace function public.ensure_warehouse_inbound_storage(
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
  previous_source text;
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

  previous_source := current_setting('app.warehouse_movement_source', true);
  perform set_config('app.warehouse_movement_source', 'canonical_receipt', true);
  insert into public.order_storage (
    organization_id, order_id, location_id, warehouse_position_id,
    package_count, storage_mode, entered_at
  ) values (
    target_organization_id, target_order_id, order_location_id, inbound_position_id,
    1, 'other'::public.order_storage_mode, coalesce(target_entered_at, now())
  ) on conflict (organization_id, order_id) do nothing;
  perform set_config('app.warehouse_movement_source', coalesce(previous_source, ''), true);
end;
$$;

create function public.save_order_storage_assignment(
  target_order_id uuid,
  target_position_id uuid,
  target_package_count integer,
  target_storage_mode public.order_storage_mode
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid := public.app_current_organization_id();
  order_location_id uuid;
  storage_row public.order_storage%rowtype;
  previous_source text;
begin
  if auth.uid() is null or not public.has_organization_role(
    org_id, array['owner', 'manager']::public.app_role[]
  ) then
    raise exception 'warehouse_storage_not_authorized' using errcode = '42501';
  end if;
  if target_package_count is null or target_package_count < 1 or target_storage_mode is null then
    raise exception 'warehouse_storage_invalid' using errcode = '22023';
  end if;

  select orders.location_id into order_location_id
  from public.orders orders
  join public.locations location
    on location.organization_id = orders.organization_id
   and location.id = orders.location_id
  where orders.organization_id = org_id
    and orders.id = target_order_id
    and location.is_active and location.deleted_at is null
  for update of orders;
  if order_location_id is null then
    raise exception 'warehouse_storage_order_location_invalid' using errcode = '22023';
  end if;
  perform 1 from public.warehouse_positions position
  where position.organization_id = org_id
    and position.location_id = order_location_id
    and position.id = target_position_id
    and position.is_active
  for share;
  if not found then
    raise exception 'warehouse_storage_position_invalid' using errcode = '22023';
  end if;

  select * into storage_row from public.order_storage storage
  where storage.organization_id = org_id and storage.order_id = target_order_id
  for update;
  if storage_row.id is not null
    and storage_row.warehouse_position_id = target_position_id
    and storage_row.package_count = target_package_count
    and storage_row.storage_mode = target_storage_mode then
    return storage_row.id;
  end if;

  previous_source := current_setting('app.warehouse_movement_source', true);
  perform set_config('app.warehouse_movement_source', 'manual_storage', true);
  if storage_row.id is null then
    insert into public.order_storage (
      organization_id, order_id, location_id, warehouse_position_id, package_count, storage_mode
    ) values (
      org_id, target_order_id, order_location_id, target_position_id, target_package_count, target_storage_mode
    ) returning * into storage_row;
  else
    update public.order_storage
    set warehouse_position_id = target_position_id,
        package_count = target_package_count,
        storage_mode = target_storage_mode,
        entered_at = case when warehouse_position_id is distinct from target_position_id then now() else entered_at end
    where organization_id = org_id and id = storage_row.id;
  end if;
  perform set_config('app.warehouse_movement_source', coalesce(previous_source, ''), true);
  return storage_row.id;
end;
$$;
revoke all on function public.save_order_storage_assignment(uuid, uuid, integer, public.order_storage_mode)
  from public, anon, authenticated;
grant execute on function public.save_order_storage_assignment(uuid, uuid, integer, public.order_storage_mode)
  to authenticated;

create function public.return_cancelled_order_from_warehouse(
  target_order_id uuid,
  target_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid := public.app_current_organization_id();
  order_status public.production_status;
  storage_id uuid;
  previous_source text;
  previous_note text;
begin
  if auth.uid() is null or not public.has_organization_role(
    org_id, array['owner', 'manager']::public.app_role[]
  ) then
    raise exception 'warehouse_return_not_authorized' using errcode = '42501';
  end if;
  if char_length(coalesce(target_note, '')) > 500 then
    raise exception 'warehouse_return_note_invalid' using errcode = '22023';
  end if;
  select orders.production_status into order_status
  from public.orders orders
  where orders.organization_id = org_id and orders.id = target_order_id
  for update;
  if order_status is distinct from 'cancelled' then
    raise exception 'warehouse_return_requires_cancelled_order' using errcode = '22023';
  end if;
  select storage.id into storage_id from public.order_storage storage
  where storage.organization_id = org_id and storage.order_id = target_order_id
  for update;
  if storage_id is null then
    raise exception 'warehouse_return_storage_missing' using errcode = '22023';
  end if;
  previous_source := current_setting('app.warehouse_movement_source', true);
  previous_note := current_setting('app.warehouse_movement_note', true);
  perform set_config('app.warehouse_movement_source', 'cancelled_return', true);
  perform set_config('app.warehouse_movement_note', coalesce(nullif(btrim(target_note), ''), ''), true);
  delete from public.order_storage
  where organization_id = org_id and id = storage_id;
  perform set_config('app.warehouse_movement_source', coalesce(previous_source, ''), true);
  perform set_config('app.warehouse_movement_note', coalesce(previous_note, ''), true);
end;
$$;
revoke all on function public.return_cancelled_order_from_warehouse(uuid, text)
  from public, anon, authenticated;
grant execute on function public.return_cancelled_order_from_warehouse(uuid, text)
  to authenticated;
