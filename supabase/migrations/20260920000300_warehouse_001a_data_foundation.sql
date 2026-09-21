-- WAREHOUSE-001A: physical storage foundation only.
-- Canonical order, production, logistics and customer-handoff lifecycles remain unchanged.

create type public.warehouse_position_type as enum (
  'shelf',
  'rack',
  'hanger',
  'cabinet',
  'other'
);

create type public.order_storage_mode as enum (
  'folded',
  'hanging',
  'mixed',
  'other'
);

create table public.warehouse_positions (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  location_id uuid not null,
  code text not null,
  name text,
  description text,
  position_type public.warehouse_position_type not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint warehouse_positions_location_same_org foreign key (organization_id, location_id)
    references public.locations (organization_id, id) on delete restrict,
  constraint warehouse_positions_org_location_id_unique unique (organization_id, location_id, id),
  constraint warehouse_positions_code_valid check (length(btrim(code)) between 1 and 64),
  constraint warehouse_positions_name_valid check (name is null or length(btrim(name)) between 1 and 160),
  constraint warehouse_positions_description_valid check (description is null or length(btrim(description)) between 1 and 500)
);

create unique index warehouse_positions_location_code_unique
on public.warehouse_positions (location_id, lower(btrim(code)));

create index warehouse_positions_active_location_idx
on public.warehouse_positions (organization_id, location_id, position_type, code, id)
where is_active;

create table public.order_storage (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  order_id uuid not null,
  location_id uuid not null,
  warehouse_position_id uuid not null,
  package_count integer not null default 1,
  storage_mode public.order_storage_mode not null,
  entered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_storage_order_same_org foreign key (organization_id, order_id)
    references public.orders (organization_id, id) on delete restrict,
  constraint order_storage_location_same_org foreign key (organization_id, location_id)
    references public.locations (organization_id, id) on delete restrict,
  constraint order_storage_position_same_location foreign key (
    organization_id,
    location_id,
    warehouse_position_id
  ) references public.warehouse_positions (organization_id, location_id, id) on delete restrict,
  constraint order_storage_one_current_per_order unique (organization_id, order_id),
  constraint order_storage_package_count_positive check (package_count >= 1)
);

create index order_storage_position_idx
on public.order_storage (organization_id, location_id, warehouse_position_id, entered_at, id);

create function public.validate_warehouse_position()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'warehouse_position_delete_forbidden' using errcode = '55000';
  end if;

  if tg_op = 'UPDATE' and (
    new.organization_id is distinct from old.organization_id
    or new.location_id is distinct from old.location_id
  ) then
    raise exception 'warehouse_position_scope_immutable' using errcode = '55000';
  end if;

  if tg_op = 'INSERT'
    or (tg_op = 'UPDATE' and new.is_active and not old.is_active) then
    if not exists (
      select 1
      from public.locations location
      where location.id = new.location_id
        and location.organization_id = new.organization_id
        and location.is_active
        and location.deleted_at is null
    ) then
      raise exception 'warehouse_position_location_invalid' using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

create trigger warehouse_positions_validate
before insert or update or delete on public.warehouse_positions
for each row execute function public.validate_warehouse_position();

create trigger warehouse_positions_set_updated_at
before update on public.warehouse_positions
for each row execute function public.set_updated_at();

create function public.validate_order_storage()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and (
    new.organization_id is distinct from old.organization_id
    or new.order_id is distinct from old.order_id
  ) then
    raise exception 'order_storage_identity_immutable' using errcode = '55000';
  end if;

  if tg_op = 'INSERT'
    or (tg_op = 'UPDATE' and (
      new.location_id is distinct from old.location_id
      or new.warehouse_position_id is distinct from old.warehouse_position_id
    )) then
    if not exists (
      select 1
      from public.warehouse_positions position
      join public.locations location
        on location.organization_id = position.organization_id
       and location.id = position.location_id
      where position.id = new.warehouse_position_id
        and position.organization_id = new.organization_id
        and position.location_id = new.location_id
        and position.is_active
        and location.is_active
        and location.deleted_at is null
    ) then
      raise exception 'order_storage_position_invalid' using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

create trigger order_storage_validate
before insert or update on public.order_storage
for each row execute function public.validate_order_storage();

create trigger order_storage_set_updated_at
before update on public.order_storage
for each row execute function public.set_updated_at();

alter table public.warehouse_positions enable row level security;
alter table public.order_storage enable row level security;

create policy "warehouse_positions_select_member"
on public.warehouse_positions
for select
to authenticated
using (
  organization_id = public.app_current_organization_id()
  and public.is_organization_member(organization_id)
);

create policy "order_storage_select_member"
on public.order_storage
for select
to authenticated
using (
  organization_id = public.app_current_organization_id()
  and public.is_organization_member(organization_id)
);

revoke all on function public.validate_warehouse_position() from public;
revoke all on function public.validate_order_storage() from public;

grant usage on type public.warehouse_position_type to authenticated;
grant usage on type public.order_storage_mode to authenticated;
grant select on public.warehouse_positions to authenticated;
grant select on public.order_storage to authenticated;
