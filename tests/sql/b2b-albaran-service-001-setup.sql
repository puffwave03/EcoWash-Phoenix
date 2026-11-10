-- Synthetic dependencies ONLY, for a newly created network-isolated PostgreSQL
-- test container. Not a Supabase migration, recovery procedure or remote script.
create role authenticated nologin;
create role anon nologin;
create role service_role nologin bypassrls;
create schema auth;
grant usage on schema auth to authenticated, anon;
create function auth.uid() returns uuid language sql stable as
  $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
create function public.test_id(n integer) returns uuid language sql immutable as
  $$select ('00000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid$$;
create type public.operational_capability as enum ('pos','production','delivery');
create type public.app_role as enum ('owner','manager','staff');
create type public.service_unit_type as enum ('weight','area','cycle','service','day','piece');
create table public.organizations(id uuid primary key, name text, timezone text, printing boolean default true);
create table public.profiles(id uuid primary key);
create table public.test_memberships(profile_id uuid, organization_id uuid, role public.app_role, pos boolean);
create table public.customers(id uuid primary key, organization_id uuid, customer_type text, company_name text,
  display_name text, notes text, unique(organization_id,id));
create table public.locations(id uuid primary key, organization_id uuid, name text, unique(organization_id,id));
create table public.properties(id uuid primary key, organization_id uuid, customer_id uuid, name text,
  access_instructions text, unique(organization_id,id));
create table public.orders(id uuid primary key, organization_id uuid, customer_id uuid, location_id uuid, property_id uuid,
  order_number text, production_status text, completed_at timestamptz, is_active boolean default true,
  internal_notes text, total numeric, unique(organization_id,id));
create table public.order_status_history(id uuid primary key, organization_id uuid, order_id uuid,
  to_status text, changed_at timestamptz, changed_by uuid references public.profiles(id));
create table public.order_items(id uuid primary key, organization_id uuid, order_id uuid, description text,
  quantity numeric, unit_type public.service_unit_type, sort_order integer, created_at timestamptz default now(), is_active boolean default true,
  notes text, unit_price numeric, line_total numeric);
create table public.payments(id integer primary key, amount numeric, reference text);
create table public.invoices(id integer primary key, document_number text);
create table public.operational_receipts(id integer primary key, receipt_number text);
create function public.app_current_organization_id() returns uuid language sql stable security definer set search_path='' as
  $$select organization_id from public.test_memberships where profile_id=auth.uid() limit 1$$;
create function public.is_organization_member(org uuid) returns boolean language sql stable security definer set search_path='' as
  $$select exists(select 1 from public.test_memberships where profile_id=auth.uid() and organization_id=org)$$;
create function public.has_operational_capability(org uuid, cap public.operational_capability) returns boolean
  language sql stable security definer set search_path='' as
  $$select exists(select 1 from public.test_memberships where profile_id=auth.uid() and organization_id=org
    and (role in ('owner','manager') or (cap='pos' and pos)))$$;
create function public.has_organization_role(org uuid, roles public.app_role[]) returns boolean
  language sql stable security definer set search_path='' as
  $$select exists(select 1 from public.test_memberships where profile_id=auth.uid() and organization_id=org and role=any(roles))$$;
create function public.organization_entitlement_is_enabled(org uuid, feature text, moment timestamptz) returns boolean
  language sql stable security definer set search_path='' as
  $$select coalesce((select printing from public.organizations where id=org and feature='printing'),false)$$;
-- Canonical public wrapper and ACL boundary (20260827000200): the internal
-- helper is callable by SECURITY DEFINER code, never directly by authenticated.
create function public.has_organization_entitlement(target_organization_id uuid, target_feature_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_organization_member(target_organization_id)
    and public.organization_entitlement_is_enabled(target_organization_id, target_feature_key, now());
$$;
revoke all on function public.organization_entitlement_is_enabled(uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function public.has_organization_entitlement(uuid,text) from public,anon,authenticated;
grant execute on function public.has_organization_entitlement(uuid,text) to authenticated;

insert into public.organizations values(test_id(101),'Tenant A','Atlantic/Canary',true),(test_id(102),'Tenant B','UTC',true);
insert into public.profiles select test_id(n) from generate_series(1,6) n;
insert into public.test_memberships values
  (test_id(1),test_id(101),'owner',true),(test_id(2),test_id(101),'manager',true),
  (test_id(3),test_id(101),'staff',true),(test_id(4),test_id(101),'staff',false),
  (test_id(5),test_id(102),'owner',true);
insert into public.customers values
  (test_id(301),test_id(101),'business','Hotel A','Customer A','PRIVATE_CUSTOMER'),
  (test_id(302),test_id(102),'business','Hotel B','Customer B','PRIVATE_CUSTOMER'),
  (test_id(303),test_id(101),'individual',null,'Individual A','PRIVATE_CUSTOMER');
insert into public.locations values(test_id(201),test_id(101),'Site A'),(test_id(202),test_id(102),'Site B'),(test_id(203),test_id(101),'Site A2');
insert into public.properties values(test_id(401),test_id(101),test_id(301),'Apartment A','PRIVATE_ACCESS');
insert into public.orders
  select test_id(n),test_id(101),test_id(301),test_id(201),test_id(401),'EW-'||n,
    'completed',now()-interval '1 day',true,'PRIVATE_INTERNAL',99.99 from generate_series(501,516) n;
update public.orders set production_status='washing',completed_at=null where id=test_id(503);
update public.orders set production_status='cancelled',completed_at=null,is_active=false where id=test_id(504);
update public.orders set customer_id=test_id(303),property_id=null where id=test_id(505);
update public.orders set location_id=null where id=test_id(507);
update public.orders set location_id=test_id(203) where id=test_id(512);
insert into public.orders values(test_id(601),test_id(102),test_id(302),test_id(202),null,'EW-B',
  'completed',now()-interval '1 day',true,'PRIVATE_INTERNAL',12.34);
insert into public.order_status_history
  select test_id(right(id::text,12)::integer+1000),organization_id,id,'completed',completed_at,
    case when organization_id=test_id(102) then test_id(5) else test_id(1) end
    from public.orders where completed_at is not null;
delete from public.order_status_history where order_id=test_id(506);
insert into public.order_status_history values(test_id(9501),test_id(101),test_id(515),'washing',now()-interval '1 hour',test_id(1));
update public.orders set completed_at=now()+interval '1 day' where id=test_id(516);
update public.order_status_history set changed_at=(select completed_at from public.orders where id=test_id(516)) where order_id=test_id(516);
insert into public.order_items
  select test_id(right(id::text,12)::integer+2000),organization_id,id,'Laundry service',2,'piece',0,now(),true,'PRIVATE_ITEM',50,100
    from public.orders;
delete from public.order_items where order_id=test_id(508);
insert into public.order_items(id,organization_id,order_id,description,quantity,unit_type,sort_order,notes,unit_price,line_total)
  select test_id(9000+n::integer),test_id(101),test_id(501),'Laundry service',1.25,unit_type,n,'PRIVATE_ITEM',50,62.5
    from unnest(array['weight','area','cycle','service','day']::public.service_unit_type[]) with ordinality as u(unit_type,n);
insert into public.payments values(1,4,'PRIVATE_PAYMENT');
insert into public.invoices values(1,'INV-HISTORICAL');
insert into public.operational_receipts values(1,'REC-HISTORICAL');
