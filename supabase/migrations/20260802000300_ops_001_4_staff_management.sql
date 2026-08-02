create or replace function public.upsert_staff_membership(
  target_profile_id uuid,
  target_role public.app_role
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  actor_id uuid := auth.uid();
  actor_role public.app_role;
  result_id uuid;
begin
  org_id := public.app_current_organization_id();

  select membership.role
  into actor_role
  from public.organization_memberships membership
  where membership.organization_id = org_id
    and membership.profile_id = actor_id
    and membership.is_active;

  if actor_role is null then
    raise exception 'not authorized';
  end if;

  if actor_role = 'manager' and target_role <> 'staff' then
    raise exception 'manager can only invite staff';
  end if;

  if actor_role not in ('owner', 'manager') then
    raise exception 'not authorized';
  end if;

  if not exists (select 1 from public.profiles where id = target_profile_id) then
    raise exception 'invalid profile';
  end if;

  if exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id <> org_id
      and membership.profile_id = target_profile_id
      and membership.is_active
  ) then
    raise exception 'profile belongs to another active organization';
  end if;

  insert into public.organization_memberships (
    organization_id,
    profile_id,
    role,
    is_active,
    invited_by
  )
  values (
    org_id,
    target_profile_id,
    target_role,
    true,
    actor_id
  )
  on conflict (organization_id, profile_id)
  do update
    set role = excluded.role,
        is_active = true,
        invited_by = coalesce(public.organization_memberships.invited_by, excluded.invited_by),
        updated_at = now()
  where public.organization_memberships.organization_id = org_id
    and (
      actor_role = 'owner'
      or (
        actor_role = 'manager'
        and public.organization_memberships.role = 'staff'
        and excluded.role = 'staff'
      )
    )
  returning id into result_id;

  if result_id is null then
    raise exception 'membership cannot be created or updated';
  end if;

  return result_id;
end;
$$;

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
  current_profile_id uuid;
  current_role public.app_role;
  current_is_active boolean;
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
  into current_profile_id, current_role, current_is_active
  from public.organization_memberships membership
  where membership.id = target_membership_id
    and membership.organization_id = org_id
  for update;

  if current_profile_id is null then
    raise exception 'invalid membership';
  end if;

  if current_profile_id = actor_id then
    raise exception 'self membership changes are not allowed';
  end if;

  if actor_role = 'manager' and (current_role <> 'staff' or target_role <> 'staff') then
    raise exception 'manager can only manage staff';
  end if;

  if actor_role = 'owner' and target_role not in ('owner', 'manager', 'staff') then
    raise exception 'invalid role';
  end if;

  if current_role = 'owner' and (target_role <> 'owner' or target_is_active is false) then
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
      is_active = coalesce(target_is_active, current_is_active),
      updated_at = now()
  where id = target_membership_id
    and organization_id = org_id;
end;
$$;

revoke all privileges
on function public.upsert_staff_membership(uuid, public.app_role)
from public, anon, authenticated;

revoke all privileges
on function public.update_staff_membership(uuid, public.app_role, boolean)
from public, anon, authenticated;

grant execute
on function public.upsert_staff_membership(uuid, public.app_role)
to authenticated;

grant execute
on function public.update_staff_membership(uuid, public.app_role, boolean)
to authenticated;
