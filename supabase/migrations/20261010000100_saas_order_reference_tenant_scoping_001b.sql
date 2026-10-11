-- SAAS-ORDER-REFERENCE-TENANT-SCOPING-001B: future references only.
-- Historical orders and the legacy global sequence remain untouched.
begin;

create table public.organization_order_numbering (
  organization_id uuid primary key references public.organizations (id) on delete restrict,
  order_prefix text not null check (order_prefix ~ '^[A-Z0-9]{2,6}$'),
  next_order_number bigint not null check (next_order_number between 1 and 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organization_order_numbering enable row level security;
revoke all on public.organization_order_numbering from public, anon, authenticated;

-- Approved staging tenants have explicit policy. Any other existing tenant is
-- seeded only when every historical reference has one valid, common prefix.
do $seed$
declare
  tenant record;
  selected_prefix text;
  total_orders bigint;
  valid_orders bigint;
  prefix_count bigint;
  derived_prefix text;
  next_value bigint;
begin
  for tenant in select id, slug, status from public.organizations order by id loop
    selected_prefix := case tenant.slug
      when 'ecowash-la-tejita' then 'EW'
      when 'phoenix-demo-laundry-staging' then 'PD'
      when 'phoenix-uat-tenant-001c' then 'PU'
      else null
    end;

    if selected_prefix is null then
      select count(*),
        count(*) filter (where o.order_number ~ '^[A-Z0-9]{2,6}-[0-9]{6}$'),
        count(distinct split_part(o.order_number, '-', 1)),
        min(split_part(o.order_number, '-', 1))
      into total_orders, valid_orders, prefix_count, derived_prefix
      from public.orders o where o.organization_id = tenant.id;
      if total_orders = 0 or valid_orders <> total_orders or prefix_count <> 1 then
        raise exception 'order_reference_prefix_unresolved: organization=%, status=%',
          tenant.slug, tenant.status using errcode = '22023';
      end if;
      selected_prefix := derived_prefix;
    end if;

    select coalesce(max(substring(o.order_number from length(selected_prefix) + 2)::bigint), 0) + 1
      into next_value
    from public.orders o
    where o.organization_id = tenant.id
      and o.order_number ~ ('^' || selected_prefix || '-[0-9]{6}$');
    if next_value > 1000000 then
      raise exception 'order_reference_sequence_exhausted: organization=%', tenant.slug using errcode = '22023';
    end if;
    insert into public.organization_order_numbering (organization_id, order_prefix, next_order_number)
    values (tenant.id, selected_prefix, next_value);
  end loop;
end;
$seed$;

create function public.allocate_order_reference(target_organization_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $allocate$
declare
  allocated_prefix text;
  allocated_number bigint;
begin
  -- This internal helper is callable only by the trusted creation RPC owners.
  -- UPDATE serializes concurrent allocations for one organization.
  update public.organization_order_numbering numbering
  set next_order_number = numbering.next_order_number + 1,
      updated_at = now()
  where numbering.organization_id = target_organization_id
    and numbering.next_order_number <= 999999
  returning numbering.order_prefix, numbering.next_order_number - 1
    into allocated_prefix, allocated_number;
  if not found then
    raise exception 'order_reference_configuration_missing_or_exhausted' using errcode = '22023';
  end if;
  return allocated_prefix || '-' || pg_catalog.lpad(allocated_number::text, 6, '0');
end;
$allocate$;
revoke all on function public.allocate_order_reference(uuid) from public, anon, authenticated;

-- Preserve the established staff and Portal validation/idempotency bodies;
-- replace only their single legacy allocation statement. Abort on drift.
do $generators$
declare
  staff_oid oid := pg_catalog.to_regprocedure('public.create_order(uuid,uuid,uuid,public.order_priority,timestamptz,text,text)');
  portal_oid oid := pg_catalog.to_regprocedure('public.create_customer_portal_order_request_catalog_001(uuid,uuid,jsonb,timestamp without time zone,text)');
  definition text;
  legacy text := 'new_order_number := ''EW-'' || lpad(nextval(''public.order_number_sequence'')::text, 6, ''0'');';
begin
  if staff_oid is null or portal_oid is null then
    raise exception 'order_reference_generator_missing' using errcode = '22023';
  end if;

  definition := pg_catalog.pg_get_functiondef(staff_oid);
  if pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, legacy, '')) <> pg_catalog.length(legacy) then
    raise exception 'order_reference_staff_generator_drift' using errcode = '22023';
  end if;
  execute pg_catalog.replace(definition, legacy,
    'new_order_number := public.allocate_order_reference(org_id);');

  definition := pg_catalog.pg_get_functiondef(portal_oid);
  if pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, legacy, '')) <> pg_catalog.length(legacy) then
    raise exception 'order_reference_portal_generator_drift' using errcode = '22023';
  end if;
  execute pg_catalog.replace(definition, legacy,
    'new_order_number := public.allocate_order_reference(portal_org_id);');
end;
$generators$;

-- Keep the original bootstrap logic as an inaccessible internal primitive.
-- The public signature now requires a trusted, explicit prefix.
alter function public.platform_bootstrap_tenant(
  uuid, text, text, text, text, text, text, uuid, text
) rename to platform_bootstrap_tenant_core;
revoke all on function public.platform_bootstrap_tenant_core(
  uuid, text, text, text, text, text, text, uuid, text
) from public, anon, authenticated;

create function public.platform_bootstrap_tenant(
  target_idempotency_key uuid,
  target_name text,
  target_slug text,
  target_default_currency text,
  target_timezone text,
  target_default_locale text,
  target_default_country_code text,
  target_owner_profile_id uuid,
  target_first_location_name text,
  target_order_prefix text
)
returns table (
  organization_id uuid,
  organization_slug text,
  owner_membership_id uuid,
  owner_profile_id uuid,
  first_location_id uuid,
  idempotency_key uuid,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $bootstrap$
declare
  created record;
  existing_prefix text;
begin
  if target_order_prefix is null or target_order_prefix !~ '^[A-Z0-9]{2,6}$' then
    raise exception 'platform_tenant_bootstrap_input_invalid' using errcode = '22023';
  end if;
  select * into created from public.platform_bootstrap_tenant_core(
    target_idempotency_key, target_name, target_slug, target_default_currency,
    target_timezone, target_default_locale, target_default_country_code,
    target_owner_profile_id, target_first_location_name
  );
  if created.organization_id is null then
    raise exception 'platform_tenant_bootstrap_result_missing' using errcode = '22023';
  end if;
  if created.replayed then
    select numbering.order_prefix into existing_prefix
    from public.organization_order_numbering numbering
    where numbering.organization_id = created.organization_id;
    if existing_prefix is distinct from target_order_prefix then
      raise exception 'platform_tenant_bootstrap_idempotency_conflict' using errcode = '23505';
    end if;
  else
    insert into public.organization_order_numbering (
      organization_id, order_prefix, next_order_number
    ) values (created.organization_id, target_order_prefix, 1);
  end if;
  return query select created.organization_id, created.organization_slug,
    created.owner_membership_id, created.owner_profile_id,
    created.first_location_id, created.idempotency_key, created.replayed;
end;
$bootstrap$;

revoke all on function public.platform_bootstrap_tenant(
  uuid, text, text, text, text, text, text, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.platform_bootstrap_tenant(
  uuid, text, text, text, text, text, text, uuid, text, text
) to authenticated;

commit;
