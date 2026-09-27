-- WAREHOUSE-001D-A: explicit inbound position configuration only.
-- Existing positions remain unselected; no order storage or lifecycle mutation.
alter table public.warehouse_positions
  add column is_default_inbound boolean not null default false;

create unique index warehouse_positions_one_default_inbound_per_location
  on public.warehouse_positions (organization_id, location_id)
  where is_default_inbound;

create function public.validate_warehouse_default_inbound()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.is_default_inbound and not new.is_active and new.is_default_inbound then
    raise exception 'warehouse_default_inbound_deactivation_forbidden' using errcode = '22023';
  end if;

  if new.is_default_inbound then
    if not new.is_active or not exists (
      select 1 from public.locations location
      where location.organization_id = new.organization_id
        and location.id = new.location_id
        and location.is_active
        and location.deleted_at is null
    ) then
      raise exception 'warehouse_default_inbound_requires_active_position_and_location' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

create trigger warehouse_default_inbound_validate
before insert or update of is_default_inbound, is_active on public.warehouse_positions
for each row execute function public.validate_warehouse_default_inbound();

create function public.protect_warehouse_default_inbound_location()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (not new.is_active or new.deleted_at is not null)
    and exists (
      select 1 from public.warehouse_positions position
      where position.organization_id = new.organization_id
        and position.location_id = new.id
        and position.is_default_inbound
    ) then
    raise exception 'warehouse_default_inbound_location_deactivation_forbidden' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger warehouse_default_inbound_location_protect
before update of is_active, deleted_at on public.locations
for each row execute function public.protect_warehouse_default_inbound_location();

-- Location row locking serializes replacements for the same location.
create function public.set_warehouse_default_inbound(
  target_position_id uuid,
  target_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid := public.app_current_organization_id();
  target_location_id uuid;
  target_active boolean;
  location_active boolean;
  location_deleted_at timestamptz;
begin
  if not exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = org_id
      and membership.profile_id = auth.uid()
      and membership.is_active
      and membership.role in ('owner', 'manager')
  ) then
    raise exception 'warehouse_default_inbound_not_authorized' using errcode = '42501';
  end if;

  select position.location_id into target_location_id
  from public.warehouse_positions position
  where position.organization_id = org_id and position.id = target_position_id;
  if target_location_id is null then
    raise exception 'warehouse_default_inbound_position_not_found' using errcode = '22023';
  end if;

  select location.is_active, location.deleted_at
    into location_active, location_deleted_at
  from public.locations location
  where location.organization_id = org_id and location.id = target_location_id
  for update;
  if not coalesce(location_active, false) or location_deleted_at is not null then
    raise exception 'warehouse_default_inbound_location_inactive' using errcode = '22023';
  end if;

  select position.is_active into target_active
  from public.warehouse_positions position
  where position.organization_id = org_id
    and position.location_id = target_location_id
    and position.id = target_position_id
  for update;
  if target_active is null or (target_enabled and not target_active) then
    raise exception 'warehouse_default_inbound_position_inactive' using errcode = '22023';
  end if;

  if target_enabled then
    update public.warehouse_positions
    set is_default_inbound = false
    where organization_id = org_id
      and location_id = target_location_id
      and is_default_inbound
      and id <> target_position_id;
  end if;

  update public.warehouse_positions
  set is_default_inbound = target_enabled
  where organization_id = org_id
    and location_id = target_location_id
    and id = target_position_id
    and is_default_inbound is distinct from target_enabled;
end;
$$;

revoke all on function public.validate_warehouse_default_inbound() from public;
revoke all on function public.protect_warehouse_default_inbound_location() from public;
revoke all on function public.set_warehouse_default_inbound(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_warehouse_default_inbound(uuid, boolean) to authenticated;
