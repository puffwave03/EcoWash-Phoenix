-- SECURITY-D03-MULTICONTEXT-SUSPENSION-001B
-- The pre-request gate reports suspension only when no usable context remains.
-- Passing it never authorizes a tenant: F04 membership/role helpers, RLS and
-- canonical Staff/Portal RPC guards remain authoritative for each operation.
-- CREATE OR REPLACE preserves the existing signatures, owners and ACLs.

create or replace function public.platform_assert_request_allowed()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null or public.platform_admin_is_active(actor_id) then
    return;
  end if;

  if exists (
    select 1
    from public.organization_memberships membership
    join public.organizations organization
      on organization.id = membership.organization_id
    where membership.profile_id = actor_id
      and membership.is_active
      and organization.status = 'active'
      and organization.platform_service_status = 'active'
      and organization.deleted_at is null
  ) or exists (
    -- Reuse the selected Portal context; never search for a later fallback.
    select 1 from public.customer_portal_current_access()
  ) then
    return;
  end if;

  if exists (
    select 1
    from public.organization_memberships membership
    join public.organizations organization
      on organization.id = membership.organization_id
    where membership.profile_id = actor_id
      and membership.is_active
      and organization.platform_service_status = 'suspended'
      and organization.deleted_at is null
  ) or exists (
    select 1
    from public.customer_portal_access access
    join public.organizations organization
      on organization.id = access.organization_id
    where access.user_id = actor_id
      and access.is_active
      and organization.platform_service_status = 'suspended'
      and organization.deleted_at is null
  ) then
    raise exception 'organization_suspended' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.app_current_organization_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result uuid;
  membership_count integer;
begin
  select count(*), min(membership.organization_id::text)::uuid
  into membership_count, result
  from public.organization_memberships membership
  join public.organizations organization on organization.id = membership.organization_id
  where membership.profile_id = auth.uid()
    and membership.is_active
    and organization.platform_service_status = 'active'
    and organization.status = 'active'
    and organization.deleted_at is null;

  if membership_count = 0 and exists (
    select 1
    from public.organization_memberships membership
    join public.organizations organization on organization.id = membership.organization_id
    where membership.profile_id = auth.uid()
      and membership.is_active
      and organization.platform_service_status = 'suspended'
      and organization.deleted_at is null
  ) then
    raise exception 'organization_suspended' using errcode = '42501';
  end if;

  if membership_count <> 1 then
    raise exception 'single active organization membership required';
  end if;

  return result;
end;
$$;
