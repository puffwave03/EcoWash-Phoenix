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
  result_id uuid;
begin
  org_id := public.app_current_organization_id();

  if not public.has_organization_role(org_id, array['owner', 'manager', 'staff']::public.app_role[]) then
    raise exception 'not authorized';
  end if;

  if not exists (select 1 from public.orders where id = target_order_id and organization_id = org_id and is_active) then
    raise exception 'invalid order';
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

create or replace function public.create_or_update_delivery(
  target_order_id uuid,
  target_delivery_id uuid,
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
  result_id uuid;
begin
  org_id := public.app_current_organization_id();

  if not public.has_organization_role(org_id, array['owner', 'manager', 'staff']::public.app_role[]) then
    raise exception 'not authorized';
  end if;

  if not exists (select 1 from public.orders where id = target_order_id and organization_id = org_id and is_active) then
    raise exception 'invalid order';
  end if;

  perform public.validate_app_007_assignment(org_id, target_assigned_to);
  perform set_config('app.app_007_mutation', 'on', true);

  if target_delivery_id is null then
    insert into public.deliveries (
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
    select status into existing_status
    from public.deliveries
    where id = target_delivery_id
      and order_id = target_order_id
      and organization_id = org_id
    for update;

    if existing_status is null or existing_status not in ('scheduled', 'in_progress', 'completed') then
      raise exception 'invalid delivery';
    end if;

    if existing_status = 'completed'
      and not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
      raise exception 'not authorized';
    end if;

    update public.deliveries
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
    where id = target_delivery_id
      and order_id = target_order_id
      and organization_id = org_id
    returning id into result_id;
  end if;

  if result_id is null then
    raise exception 'invalid delivery';
  end if;

  return result_id;
end;
$$;
