-- Disposable local database only. Never run against staging or production.
do $$ begin if current_database() <> 'phoenix_002j_test' then raise exception 'disposable_database_required'; end if; end $$;
create schema if not exists auth;
create type public.app_role as enum ('owner','manager','staff');
create type public.service_unit_type as enum ('piece','weight','area','cycle','service','day');
create table public.organizations(id uuid primary key, status text not null, deleted_at timestamptz, default_currency text not null, timezone text not null, catalog_order_mode text default 'manual', updated_at timestamptz default now());
create table public.services(id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), code text, name text, description text, unit_type public.service_unit_type default 'piece', category text, is_active boolean default true, updated_by uuid, created_by uuid, portal_category_key text, portal_sort_order integer default 0, portal_visible boolean default false, customer_orderable boolean default false, portal_featured boolean default false, portal_image_path text);
create unique index services_org_id on public.services(organization_id,id);
create table public.service_prices(id uuid primary key default gen_random_uuid(), organization_id uuid not null, service_id uuid not null, location_id uuid, amount numeric(12,2) not null, currency text not null, is_from boolean default false, valid_from date not null, valid_to date, is_active boolean not null default true, created_by uuid, updated_by uuid, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.organization_portal_categories(organization_id uuid,category_key text,is_active boolean, primary key(organization_id,category_key));
create table public.service_catalog_translations(organization_id uuid,service_id uuid,locale text,name text,description text,updated_at timestamptz default now(),primary key(organization_id,service_id,locale));
create table public.category_catalog_translations(organization_id uuid,category_key text,locale text,title text,updated_at timestamptz default now(),primary key(organization_id,category_key,locale));
create table public.test_members(user_id uuid, organization_id uuid, role public.app_role);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function public.app_current_organization_id() returns uuid language sql stable as $$select nullif(current_setting('app.test_org',true),'')::uuid$$;
create function public.has_organization_role(target_org uuid, roles public.app_role[]) returns boolean language sql stable as $$select exists(select 1 from public.test_members m where m.user_id=auth.uid() and m.organization_id=target_org and m.role=any(roles))$$;
-- Load the exact historical apply_catalog_import function from its migration next.
insert into public.organizations values ('00000000-0000-4000-8000-000000000001','active',null,'EUR','Atlantic/Canary'),('00000000-0000-4000-8000-000000000002','active',null,'GBP','Europe/London');
insert into public.services(id,organization_id,code,name) values ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001','S-1','One'),('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000002','F-1','Foreign');
insert into public.test_members values ('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000001','owner'),('00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000002','owner'),('00000000-0000-4000-8000-000000000103','00000000-0000-4000-8000-000000000001','manager');
insert into public.organization_portal_categories values ('00000000-0000-4000-8000-000000000001','ironing',true);
