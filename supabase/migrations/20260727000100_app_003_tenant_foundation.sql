create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('owner', 'manager', 'staff');
create type public.organization_status as enum ('active', 'inactive');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  locale text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status public.organization_status not null default 'active',
  default_currency char(3) not null default 'EUR',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint organizations_default_currency_uppercase check (default_currency = upper(default_currency))
);

create table public.locations (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  name text not null,
  address_line1 text,
  address_line2 text,
  city text,
  region text,
  postal_code text,
  country_code char(2),
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint locations_country_code_uppercase check (country_code is null or country_code = upper(country_code))
);

create table public.organization_memberships (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  is_active boolean not null default true,
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_memberships_unique_profile unique (organization_id, profile_id)
);

create index locations_organization_id_idx on public.locations (organization_id);
create index organization_memberships_organization_id_idx on public.organization_memberships (organization_id);
create index organization_memberships_profile_id_idx on public.organization_memberships (profile_id);
create index organization_memberships_role_idx on public.organization_memberships (organization_id, role) where is_active;

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger locations_set_updated_at
before update on public.locations
for each row execute function public.set_updated_at();

create trigger organization_memberships_set_updated_at
before update on public.organization_memberships
for each row execute function public.set_updated_at();

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(split_part(new.email, '@', 1), ''),
      'EcoWash user'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid();
$$;

create function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = target_organization_id
      and membership.profile_id = auth.uid()
      and membership.is_active
  );
$$;

create function public.has_organization_role(
  target_organization_id uuid,
  allowed_roles public.app_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = target_organization_id
      and membership.profile_id = auth.uid()
      and membership.role = any(allowed_roles)
      and membership.is_active
  );
$$;

create function public.shares_organization_with_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships viewer_membership
    join public.organization_memberships target_membership
      on target_membership.organization_id = viewer_membership.organization_id
    where viewer_membership.profile_id = auth.uid()
      and target_membership.profile_id = target_profile_id
      and viewer_membership.is_active
      and target_membership.is_active
  );
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.locations enable row level security;
alter table public.organization_memberships enable row level security;

create policy "profiles_select_own_or_same_organization"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.shares_organization_with_profile(id)
);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "organizations_select_member"
on public.organizations
for select
to authenticated
using (
  deleted_at is null
  and public.is_organization_member(id)
);

create policy "organizations_update_owner"
on public.organizations
for update
to authenticated
using (
  deleted_at is null
  and public.has_organization_role(id, array['owner']::public.app_role[])
)
with check (
  public.has_organization_role(id, array['owner']::public.app_role[])
);

create policy "locations_select_member"
on public.locations
for select
to authenticated
using (
  deleted_at is null
  and public.is_organization_member(organization_id)
);

create policy "locations_insert_manager"
on public.locations
for insert
to authenticated
with check (
  public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[])
);

create policy "locations_update_manager"
on public.locations
for update
to authenticated
using (
  deleted_at is null
  and public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[])
)
with check (
  public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[])
);

create policy "memberships_select_member"
on public.organization_memberships
for select
to authenticated
using (public.is_organization_member(organization_id));

create policy "memberships_insert_owner"
on public.organization_memberships
for insert
to authenticated
with check (
  public.has_organization_role(organization_id, array['owner']::public.app_role[])
);

create policy "memberships_update_owner"
on public.organization_memberships
for update
to authenticated
using (
  public.has_organization_role(organization_id, array['owner']::public.app_role[])
)
with check (
  public.has_organization_role(organization_id, array['owner']::public.app_role[])
);

revoke all on function public.set_updated_at() from public;
revoke all on function public.handle_new_auth_user() from public;

grant usage on schema public to authenticated;
grant usage on type public.app_role to authenticated;
grant usage on type public.organization_status to authenticated;
grant select, update on public.profiles to authenticated;
grant select, update on public.organizations to authenticated;
grant select, insert, update on public.locations to authenticated;
grant select, insert, update on public.organization_memberships to authenticated;
grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.is_organization_member(uuid) to authenticated;
grant execute on function public.has_organization_role(uuid, public.app_role[]) to authenticated;
grant execute on function public.shares_organization_with_profile(uuid) to authenticated;
