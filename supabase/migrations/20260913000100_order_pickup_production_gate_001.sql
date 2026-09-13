-- ORDER-PICKUP-PRODUCTION-GATE-001 keeps inbound pickup and production
-- sequencing authoritative without rewriting existing UAT history.
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

  if target_status in ('washing', 'drying', 'ironing', 'quality_check', 'packing', 'ready', 'completed')
    and exists (
      select 1
      from public.pickups pickup
      where pickup.organization_id = org_id
        and pickup.order_id = target_order_id
        and pickup.status in ('scheduled', 'in_progress')
    ) then
    raise exception 'inbound_pickup_incomplete';
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

  if target_status = 'cancelled' then
    perform set_config('app.app_007_mutation', 'on', true);

    update public.pickups
    set status = 'cancelled',
        cancellation_reason = reason_text,
        updated_by = auth.uid()
    where organization_id = org_id
      and order_id = target_order_id
      and status in ('scheduled', 'in_progress');

    update public.deliveries
    set status = 'cancelled',
        cancellation_reason = reason_text,
        updated_by = auth.uid()
    where organization_id = org_id
      and order_id = target_order_id
      and status in ('scheduled', 'in_progress');
  end if;

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

create or replace function public.create_or_update_pickup(
  target_order_id uuid,
  target_pickup_id uuid,
  target_scheduled_at timestamptz,
  target_assigned_to uuid,
  target_address_line1 text,
  target_address_line2 text,
  target_city text,
  target_postal_code text,
  target_country_code text,
  target_contact_name text,
  target_contact_phone text,
  target_notes text,
  target_fee numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_status public.fulfillment_status;
  org_id uuid;
  parent_status public.production_status;
  production_started boolean := false;
  result_id uuid;
begin
  org_id := public.app_current_organization_id();

  if not public.has_organization_role(org_id, array['owner', 'manager', 'staff']::public.app_role[]) then
    raise exception 'not authorized';
  end if;

  select orders.production_status
  into parent_status
  from public.orders orders
  where orders.id = target_order_id
    and orders.organization_id = org_id
    and orders.is_active
  for update;

  if parent_status is null or parent_status = 'cancelled' then
    raise exception 'invalid order';
  end if;

  if target_pickup_id is not null then
    select status into existing_status
    from public.pickups
    where id = target_pickup_id
      and order_id = target_order_id
      and organization_id = org_id
    for update;

    if existing_status is null or existing_status not in ('scheduled', 'in_progress', 'completed') then
      raise exception 'invalid pickup';
    end if;

    if existing_status = 'completed'
      and not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
      raise exception 'not authorized';
    end if;
  end if;

  production_started := parent_status in (
    'washing', 'drying', 'ironing', 'quality_check', 'packing', 'ready', 'completed'
  ) or exists (
    select 1
    from public.order_status_history history
    where history.organization_id = org_id
      and history.order_id = target_order_id
      and history.to_status in (
        'washing', 'drying', 'ironing', 'quality_check', 'packing', 'ready', 'completed'
      )
  );

  if production_started
    and (target_pickup_id is null or existing_status in ('scheduled', 'in_progress')) then
    raise exception 'production_already_started';
  end if;

  perform public.validate_app_007_assignment(org_id, target_assigned_to);
  perform set_config('app.app_007_mutation', 'on', true);

  if target_pickup_id is null then
    insert into public.pickups (
      organization_id, order_id, scheduled_at, assigned_to, address_line1, address_line2,
      city, postal_code, country_code, contact_name, contact_phone, notes, fee, created_by, updated_by
    )
    values (
      org_id, target_order_id, target_scheduled_at, target_assigned_to, nullif(btrim(target_address_line1), ''),
      nullif(btrim(target_address_line2), ''), nullif(btrim(target_city), ''), nullif(btrim(target_postal_code), ''),
      nullif(upper(btrim(target_country_code)), ''), nullif(btrim(target_contact_name), ''),
      nullif(btrim(target_contact_phone), ''), nullif(btrim(target_notes), ''), coalesce(target_fee, 0), auth.uid(), auth.uid()
    )
    returning id into result_id;
  else
    update public.pickups
    set scheduled_at = target_scheduled_at,
        assigned_to = target_assigned_to,
        address_line1 = nullif(btrim(target_address_line1), ''),
        address_line2 = nullif(btrim(target_address_line2), ''),
        city = nullif(btrim(target_city), ''),
        postal_code = nullif(btrim(target_postal_code), ''),
        country_code = nullif(upper(btrim(target_country_code)), ''),
        contact_name = nullif(btrim(target_contact_name), ''),
        contact_phone = nullif(btrim(target_contact_phone), ''),
        notes = nullif(btrim(target_notes), ''),
        fee = coalesce(target_fee, 0),
        updated_by = auth.uid()
    where id = target_pickup_id
      and order_id = target_order_id
      and organization_id = org_id
    returning id into result_id;
  end if;

  if result_id is null then
    raise exception 'invalid pickup';
  end if;

  return result_id;
end;
$$;
