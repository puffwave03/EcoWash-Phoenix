-- POS-001.1: PostgreSQL does not provide min(uuid) on linked staging.
-- Preserve the single-active-membership contract while aggregating through text.
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
  if exists (
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

  select count(*), min(membership.organization_id::text)::uuid
  into membership_count, result
  from public.organization_memberships membership
  join public.organizations organization on organization.id = membership.organization_id
  where membership.profile_id = auth.uid()
    and membership.is_active
    and organization.platform_service_status = 'active'
    and organization.status = 'active'
    and organization.deleted_at is null;

  if membership_count <> 1 then
    raise exception 'single active organization membership required';
  end if;

  return result;
end;
$$;

revoke all on function public.app_current_organization_id() from public, anon, authenticated;
