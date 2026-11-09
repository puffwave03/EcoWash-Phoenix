-- PREPARED, NOT EXECUTED. Dedicated disposable PostgreSQL 17 constraint/RLS fixture.
-- Not a Supabase parity/security certification. Helpers model existing memberships.
-- Requires separate authorization before creating a DB or applying either migration.
-- This setup includes the unchanged original printer-profile migration. Then apply
-- the proposed 20261108205704 migration ONLY in that authorized disposable DB,
-- followed by the assertion script. No command is run during Phase A.
-- No runner connects to or mutates a database in the Phase A Node suite.
\set ON_ERROR_STOP on
do $$ begin
  if current_database() <> 'phoenix_print_document_preferences_test'
    or inet_server_addr() is not null
    or to_regclass('public.organizations') is not null then
    raise exception 'dedicated empty local Unix-socket test database required';
  end if;
end $$;
create schema auth;
create schema extensions;
create extension pgcrypto with schema extensions;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
end $$;
create type public.app_role as enum ('owner', 'manager', 'staff');
create table public.profiles (id uuid primary key);
create table public.organizations (id uuid primary key, printing boolean not null default true);
create table public.locations (
  id uuid primary key, organization_id uuid not null references public.organizations(id),
  is_active boolean not null default true, deleted_at timestamptz,
  unique (organization_id, id)
);
create table public.organization_memberships (
  organization_id uuid not null references public.organizations(id),
  profile_id uuid not null references public.profiles(id), role public.app_role not null,
  is_active boolean not null default true, primary key (organization_id, profile_id)
);
create function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function public.app_current_organization_id() returns uuid
language sql stable security definer set search_path = ''
as $$ select organization_id from public.organization_memberships where profile_id = auth.uid() and is_active $$;
create function public.has_organization_role(org uuid, roles public.app_role[]) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.organization_memberships where organization_id = org and profile_id = auth.uid() and role = any(roles) and is_active) $$;
create function public.is_organization_member(org uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.organization_memberships where organization_id = org and profile_id = auth.uid() and is_active) $$;
create function public.organization_entitlement_is_enabled(org uuid, feature text, at_time timestamptz) returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select printing from public.organizations where id = org and feature = 'printing'), false) $$;
create function public.has_organization_entitlement(org uuid, feature text) returns boolean
language sql stable security definer set search_path = ''
as $$ select public.organization_entitlement_is_enabled(org, feature, now()) $$;
create function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
grant usage on schema public, auth to authenticated, anon;

insert into public.organizations(id) values
 ('00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000002');
insert into public.profiles values
 ('10000000-0000-4000-8000-000000000001'), ('10000000-0000-4000-8000-000000000002'),
 ('10000000-0000-4000-8000-000000000003'), ('10000000-0000-4000-8000-000000000004');
insert into public.organization_memberships(organization_id,profile_id,role) values
 ('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner'),
 ('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','manager'),
 ('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','staff'),
 ('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004','owner');
insert into public.locations(id,organization_id) values
 ('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001'),
 ('20000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001'),
 ('20000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002');

-- Original profile schema and rows precede the proposed preference migration.
\ir ../../supabase/migrations/20260829000400_counter_ui_003_printer_profiles.sql
-- Existing profile rows are available unchanged after adding the preference model.
insert into public.printer_profiles(id,organization_id,location_id,display_name,purpose,paper_format) values
 ('30000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','58','receipt','receipt_58mm'),
 ('30000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','80','receipt','receipt_80mm'),
 ('30000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003','Other tenant','receipt','receipt_58mm');
insert into public.printer_profiles(id,organization_id,location_id,display_name,purpose,paper_format,connection_mode,
  label_width_mm,label_height_mm,label_orientation,label_copies,label_margin_mm,label_gap_mm,is_default)
values ('30000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001','Existing labels','label','label_custom','local_bridge',50,30,'portrait',3,2,3,true);
create table public.fixture_original_printer_profiles as select id, to_jsonb(profile) as snapshot from public.printer_profiles profile;
