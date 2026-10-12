-- Disposable PostgreSQL fixture. Never run against staging or production.
create schema if not exists auth;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end $$;
create or replace function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create type public.app_role as enum ('owner', 'manager', 'staff');
create table public.organizations (
  id uuid primary key, status text not null, platform_service_status text not null,
  deleted_at timestamptz
);
create table public.organization_memberships (
  organization_id uuid not null references public.organizations(id),
  profile_id uuid not null, role public.app_role not null, is_active boolean not null,
  primary key (organization_id, profile_id)
);
create table public.locations (
  id uuid primary key, organization_id uuid not null references public.organizations(id),
  name text not null, address_line1 text, address_line2 text, city text,
  region text, postal_code text, country_code char(2), phone text,
  is_active boolean not null, deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint locations_country_code_uppercase check (country_code is null or country_code = upper(country_code))
);
create table public.location_dependents (
  id integer primary key, location_id uuid not null references public.locations(id)
);
create function public.fixture_set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger locations_set_updated_at before update on public.locations
for each row execute function public.fixture_set_updated_at();
create function public.fixture_is_member(target_organization_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organization_memberships m
    where m.organization_id = target_organization_id and m.profile_id = auth.uid() and m.is_active)
$$;
create function public.fixture_has_role(target_organization_id uuid, allowed_roles public.app_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organization_memberships m
    where m.organization_id = target_organization_id and m.profile_id = auth.uid()
      and m.role = any(allowed_roles) and m.is_active)
$$;
alter table public.locations enable row level security;
create policy locations_select_member on public.locations for select to authenticated
using (deleted_at is null and public.fixture_is_member(organization_id));
create policy locations_update_manager on public.locations for update to authenticated
using (deleted_at is null and public.fixture_has_role(organization_id, array['owner', 'manager']::public.app_role[]))
with check (public.fixture_has_role(organization_id, array['owner', 'manager']::public.app_role[]));
grant usage on schema public, auth to authenticated, anon;
grant create on schema public to postgres;
revoke all on public.locations from public, anon, authenticated;
grant select on public.locations to authenticated;

insert into public.organizations (id, status, platform_service_status) values
  ('00000000-0000-4000-8000-000000000001', 'active', 'active'),
  ('00000000-0000-4000-8000-000000000002', 'active', 'active');
insert into public.organization_memberships (organization_id, profile_id, role, is_active) values
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'owner', true),
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'manager', true),
  ('00000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', 'owner', true);
insert into public.locations (id, organization_id, name, country_code, is_active) values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Counter One', 'ES', true),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'Counter Two', 'GB', true);
insert into public.location_dependents values (1, '20000000-0000-4000-8000-000000000001');
alter table public.organizations owner to postgres;
alter table public.organization_memberships owner to postgres;
alter table public.locations owner to postgres;
alter table public.location_dependents owner to postgres;
grant usage on schema auth to postgres;
