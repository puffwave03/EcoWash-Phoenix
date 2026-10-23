-- SECURITY-F04-INACTIVE-ORG-HELPERS-001A

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    join public.organizations organization
      on organization.id = membership.organization_id
    where membership.organization_id = target_organization_id
      and membership.profile_id = auth.uid()
      and membership.is_active
      and organization.platform_service_status = 'active'
      and organization.status = 'active'
      and organization.deleted_at is null
  );
$$;

create or replace function public.has_organization_role(
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
    join public.organizations organization
      on organization.id = membership.organization_id
    where membership.organization_id = target_organization_id
      and membership.profile_id = auth.uid()
      and membership.role = any(allowed_roles)
      and membership.is_active
      and organization.platform_service_status = 'active'
      and organization.status = 'active'
      and organization.deleted_at is null
  );
$$;

create or replace function public.shares_organization_with_profile(target_profile_id uuid)
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
    join public.organizations organization
      on organization.id = viewer_membership.organization_id
    where viewer_membership.profile_id = auth.uid()
      and target_membership.profile_id = target_profile_id
      and viewer_membership.is_active
      and target_membership.is_active
      and organization.platform_service_status = 'active'
      and organization.status = 'active'
      and organization.deleted_at is null
  );
$$;
