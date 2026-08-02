create or replace function public.update_order_assignment(
  target_order_id uuid,
  target_assigned_to uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
begin
  org_id := public.app_current_organization_id();

  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'not authorized';
  end if;

  if target_assigned_to is not null and not exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = org_id
      and membership.profile_id = target_assigned_to
      and membership.role = 'staff'
      and membership.is_active
  ) then
    raise exception 'assigned user must be active staff in organization';
  end if;

  update public.orders
  set assigned_to = target_assigned_to,
      updated_by = auth.uid()
  where id = target_order_id
    and organization_id = org_id
    and is_active
    and production_status not in ('completed', 'cancelled');

  if not found then
    raise exception 'invalid order';
  end if;
end;
$$;

revoke all privileges
on function public.update_order_assignment(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.update_order_assignment(uuid, uuid)
to authenticated;

create or replace function public.validate_app_007_assignment(target_organization_id uuid, target_profile_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if target_profile_id is null then
    return;
  end if;

  if not exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = target_organization_id
      and membership.profile_id = target_profile_id
      and membership.role = 'staff'
      and membership.is_active
  ) then
    raise exception 'assigned user must be active staff in organization';
  end if;
end;
$$;

revoke all privileges
on function public.validate_app_007_assignment(uuid, uuid)
from public, anon, authenticated;
