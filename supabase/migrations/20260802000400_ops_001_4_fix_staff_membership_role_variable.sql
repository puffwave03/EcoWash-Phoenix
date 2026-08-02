create or replace function public.update_staff_membership(
  target_membership_id uuid,
  target_role public.app_role,
  target_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  actor_id uuid := auth.uid();
  actor_role public.app_role;
  target_profile_id uuid;
  target_current_role public.app_role;
  target_current_is_active boolean;
  active_owner_count integer;
begin
  org_id := public.app_current_organization_id();

  select membership.role
  into actor_role
  from public.organization_memberships membership
  where membership.organization_id = org_id
    and membership.profile_id = actor_id
    and membership.is_active;

  if actor_role not in ('owner', 'manager') then
    raise exception 'not authorized';
  end if;

  select membership.profile_id, membership.role, membership.is_active
  into target_profile_id, target_current_role, target_current_is_active
  from public.organization_memberships membership
  where membership.id = target_membership_id
    and membership.organization_id = org_id
  for update;

  if target_profile_id is null then
    raise exception 'invalid membership';
  end if;

  if target_profile_id = actor_id then
    raise exception 'self membership changes are not allowed';
  end if;

  if actor_role = 'manager' and (target_current_role <> 'staff' or target_role <> 'staff') then
    raise exception 'manager can only manage staff';
  end if;

  if actor_role = 'owner' and target_role not in ('owner', 'manager', 'staff') then
    raise exception 'invalid role';
  end if;

  if target_current_role = 'owner' and (target_role <> 'owner' or target_is_active is false) then
    select count(*)
    into active_owner_count
    from public.organization_memberships membership
    where membership.organization_id = org_id
      and membership.role = 'owner'
      and membership.is_active;

    if active_owner_count <= 1 then
      raise exception 'last owner cannot be removed';
    end if;
  end if;

  update public.organization_memberships
  set role = target_role,
      is_active = coalesce(target_is_active, target_current_is_active),
      updated_at = now()
  where id = target_membership_id
    and organization_id = org_id;
end;
$$;

revoke all privileges
on function public.update_staff_membership(uuid, public.app_role, boolean)
from public, anon, authenticated;

grant execute
on function public.update_staff_membership(uuid, public.app_role, boolean)
to authenticated;
