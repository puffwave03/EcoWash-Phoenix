create type public.operational_capability as enum (
  'pickup',
  'production',
  'quality',
  'delivery',
  'supervision'
);

alter table public.organization_memberships
add column operational_capabilities public.operational_capability[];

update public.organization_memberships
set operational_capabilities = case
  when role in ('owner', 'manager') then array[
    'pickup', 'production', 'quality', 'delivery', 'supervision'
  ]::public.operational_capability[]
  else array[
    'pickup', 'production', 'quality', 'delivery'
  ]::public.operational_capability[]
end
where operational_capabilities is null;

alter table public.organization_memberships
alter column operational_capabilities set default '{}'::public.operational_capability[],
alter column operational_capabilities set not null;

create function public.has_operational_capability(
  target_organization_id uuid,
  target_capability public.operational_capability
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
    where membership.organization_id = target_organization_id
      and membership.profile_id = auth.uid()
      and membership.is_active
      and (
        membership.role in ('owner', 'manager')
        or (
          membership.role = 'staff'
          and target_capability <> 'supervision'
          and target_capability = any(membership.operational_capabilities)
        )
      )
  );
$$;

create function public.update_staff_capabilities(
  target_membership_id uuid,
  target_capabilities public.operational_capability[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  actor_id uuid := auth.uid();
  target_profile_id uuid;
  target_role public.app_role;
  normalized_capabilities public.operational_capability[];
begin
  org_id := public.app_current_organization_id();

  if not public.has_organization_role(org_id, array['owner']::public.app_role[]) then
    raise exception 'not authorized';
  end if;

  select membership.profile_id, membership.role
  into target_profile_id, target_role
  from public.organization_memberships membership
  where membership.id = target_membership_id
    and membership.organization_id = org_id
  for update;

  if target_profile_id is null then
    raise exception 'invalid membership';
  end if;

  if target_profile_id = actor_id then
    raise exception 'self capability changes are not allowed';
  end if;

  if target_role in ('owner', 'manager') then
    normalized_capabilities := array[
      'pickup', 'production', 'quality', 'delivery', 'supervision'
    ]::public.operational_capability[];
  else
    select coalesce(array_agg(distinct capability order by capability), '{}'::public.operational_capability[])
    into normalized_capabilities
    from unnest(coalesce(target_capabilities, '{}'::public.operational_capability[])) capability
    where capability <> 'supervision';
  end if;

  update public.organization_memberships
  set operational_capabilities = normalized_capabilities,
      updated_at = now()
  where id = target_membership_id
    and organization_id = org_id;
end;
$$;

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
  result_id uuid;
begin
  org_id := public.app_current_organization_id();

  if not public.has_organization_role(org_id, array['owner']::public.app_role[]) then
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
  target_profile_id uuid;
  target_current_role public.app_role;
  target_current_is_active boolean;
  active_owner_count integer;
begin
  org_id := public.app_current_organization_id();

  if not public.has_organization_role(org_id, array['owner']::public.app_role[]) then
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

create or replace function public.transition_pickup_status(
  target_pickup_id uuid,
  target_status public.fulfillment_status,
  target_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  actor_role public.app_role;
  current_status public.fulfillment_status;
  current_assigned_to uuid;
  allowed boolean := false;
begin
  org_id := public.app_current_organization_id();

  select membership.role into actor_role
  from public.organization_memberships membership
  where membership.organization_id = org_id
    and membership.profile_id = auth.uid()
    and membership.is_active;

  select status, assigned_to into current_status, current_assigned_to
  from public.pickups
  where id = target_pickup_id and organization_id = org_id
  for update;

  if current_status is null
    or not public.has_operational_capability(org_id, 'pickup')
    or (actor_role = 'staff' and current_assigned_to is distinct from auth.uid()) then
    raise exception 'not authorized';
  end if;

  if current_status = 'scheduled' then
    allowed := target_status in ('in_progress', 'cancelled');
  elsif current_status = 'in_progress' then
    allowed := target_status in ('completed', 'cancelled');
  end if;

  if not allowed then
    raise exception 'transition not allowed';
  end if;

  if target_status = 'cancelled' and nullif(btrim(target_reason), '') is null then
    raise exception 'reason required';
  end if;

  perform set_config('app.app_007_mutation', 'on', true);

  update public.pickups
  set status = target_status,
      started_at = case when target_status = 'in_progress' and started_at is null then now() else started_at end,
      completed_at = case when target_status = 'completed' then now() else completed_at end,
      cancellation_reason = case when target_status = 'cancelled' then nullif(btrim(target_reason), '') else cancellation_reason end,
      updated_by = auth.uid()
  where id = target_pickup_id and organization_id = org_id;
end;
$$;

create or replace function public.transition_delivery_status(
  target_delivery_id uuid,
  target_status public.fulfillment_status,
  target_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  actor_role public.app_role;
  current_status public.fulfillment_status;
  current_assigned_to uuid;
  allowed boolean := false;
begin
  org_id := public.app_current_organization_id();

  select membership.role into actor_role
  from public.organization_memberships membership
  where membership.organization_id = org_id
    and membership.profile_id = auth.uid()
    and membership.is_active;

  select status, assigned_to into current_status, current_assigned_to
  from public.deliveries
  where id = target_delivery_id and organization_id = org_id
  for update;

  if current_status is null
    or not public.has_operational_capability(org_id, 'delivery')
    or (actor_role = 'staff' and current_assigned_to is distinct from auth.uid()) then
    raise exception 'not authorized';
  end if;

  if current_status = 'scheduled' then
    allowed := target_status in ('in_progress', 'cancelled');
  elsif current_status = 'in_progress' then
    allowed := target_status in ('completed', 'cancelled');
  end if;

  if not allowed then
    raise exception 'transition not allowed';
  end if;

  if target_status = 'cancelled' and nullif(btrim(target_reason), '') is null then
    raise exception 'reason required';
  end if;

  perform set_config('app.app_007_mutation', 'on', true);

  update public.deliveries
  set status = target_status,
      started_at = case when target_status = 'in_progress' and started_at is null then now() else started_at end,
      completed_at = case when target_status = 'completed' then now() else completed_at end,
      cancellation_reason = case when target_status = 'cancelled' then nullif(btrim(target_reason), '') else cancellation_reason end,
      updated_by = auth.uid()
  where id = target_delivery_id and organization_id = org_id;
end;
$$;

create or replace function public.transition_order_status(
  target_order_id uuid,
  target_status public.production_status,
  target_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  actor_role public.app_role;
  current_status public.production_status;
  current_assigned_to uuid;
  previous_status public.production_status;
  required_capability public.operational_capability;
  reason_text text;
  allowed boolean := false;
begin
  org_id := public.app_current_organization_id();
  reason_text := nullif(btrim(target_reason), '');

  select membership.role into actor_role
  from public.organization_memberships membership
  where membership.organization_id = org_id
    and membership.profile_id = auth.uid()
    and membership.is_active;

  select production_status, assigned_to into current_status, current_assigned_to
  from public.orders
  where id = target_order_id
    and organization_id = org_id
    and is_active
  for update;

  if current_status is null then
    raise exception 'invalid order';
  end if;

  required_capability := case
    when current_status in ('quality_check', 'packing') then 'quality'::public.operational_capability
    else 'production'::public.operational_capability
  end;

  if not public.has_operational_capability(org_id, required_capability)
    or (actor_role = 'staff' and current_assigned_to is distinct from auth.uid()) then
    raise exception 'not authorized';
  end if;

  if current_status in ('completed', 'cancelled') then
    raise exception 'final status cannot transition';
  end if;

  if target_status in ('on_hold', 'cancelled') and reason_text is null then
    raise exception 'reason required';
  end if;

  if current_status = 'draft' then
    allowed := target_status in ('received', 'cancelled');
  elsif current_status = 'received' then
    allowed := target_status in ('washing', 'ironing', 'quality_check', 'on_hold', 'cancelled');
  elsif current_status = 'washing' then
    allowed := target_status in ('drying', 'quality_check', 'on_hold');
  elsif current_status = 'drying' then
    allowed := target_status in ('ironing', 'quality_check', 'packing', 'on_hold');
  elsif current_status = 'ironing' then
    allowed := target_status in ('quality_check', 'packing', 'on_hold');
  elsif current_status = 'quality_check' then
    allowed := target_status in ('packing', 'on_hold');
  elsif current_status = 'packing' then
    allowed := target_status in ('ready', 'on_hold');
  elsif current_status = 'ready' then
    allowed := target_status in ('completed', 'on_hold');
  elsif current_status = 'on_hold' then
    select history.to_status
    into previous_status
    from public.order_status_history history
    where history.order_id = target_order_id
      and history.organization_id = org_id
      and history.to_status not in ('on_hold', 'cancelled', 'completed')
    order by history.changed_at desc
    limit 1;

    allowed := target_status = previous_status or target_status = 'cancelled';
  end if;

  if not allowed then
    raise exception 'transition not allowed';
  end if;

  perform set_config('app.workflow_transition', 'on', true);

  update public.orders
  set production_status = target_status,
      received_at = case when target_status = 'received' and received_at is null then now() else received_at end,
      completed_at = case when target_status = 'completed' then now() else null end,
      cancelled_at = case when target_status = 'cancelled' then now() else null end,
      cancellation_reason = case when target_status = 'cancelled' then reason_text else cancellation_reason end,
      on_hold_reason = case when target_status = 'on_hold' then reason_text else null end,
      updated_by = auth.uid()
  where id = target_order_id
    and organization_id = org_id;

  insert into public.order_status_history (
    organization_id,
    order_id,
    from_status,
    to_status,
    reason,
    changed_by
  )
  values (
    org_id,
    target_order_id,
    current_status,
    target_status,
    reason_text,
    auth.uid()
  );
end;
$$;

revoke all privileges
on function public.has_operational_capability(uuid, public.operational_capability)
from public, anon;

revoke all privileges
on function public.update_staff_capabilities(uuid, public.operational_capability[])
from public, anon, authenticated;

grant usage on type public.operational_capability to authenticated;
grant execute on function public.has_operational_capability(uuid, public.operational_capability) to authenticated;
grant execute on function public.update_staff_capabilities(uuid, public.operational_capability[]) to authenticated;
