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
  select count(*)
  into membership_count
  from public.organization_memberships
  where profile_id = auth.uid()
    and is_active;

  if membership_count <> 1 then
    raise exception 'single active organization membership required';
  end if;

  select organization_id
  into result
  from public.organization_memberships
  where profile_id = auth.uid()
    and is_active
  limit 1;

  return result;
end;
$$;

create or replace function public.create_order(
  target_customer_id uuid,
  target_property_id uuid,
  target_location_id uuid,
  target_priority public.order_priority,
  target_due_at timestamptz,
  target_customer_notes text,
  target_internal_notes text
)
returns table(id uuid, order_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  new_order_id uuid;
  new_order_number text;
begin
  org_id := public.app_current_organization_id();

  if not public.has_organization_role(org_id, array['owner', 'manager', 'staff']::public.app_role[]) then
    raise exception 'not authorized';
  end if;

  if not exists (
    select 1
    from public.customers as customer
    where customer.id = target_customer_id
      and customer.organization_id = org_id
      and customer.is_active
  ) then
    raise exception 'invalid customer';
  end if;

  if target_property_id is not null and not exists (
    select 1
    from public.properties as property
    where property.id = target_property_id
      and property.customer_id = target_customer_id
      and property.organization_id = org_id
      and property.is_active
  ) then
    raise exception 'invalid property';
  end if;

  if target_location_id is not null and not exists (
    select 1
    from public.locations as location
    where location.id = target_location_id
      and location.organization_id = org_id
      and location.is_active
      and location.deleted_at is null
  ) then
    raise exception 'invalid location';
  end if;

  new_order_number := 'EW-' || lpad(nextval('public.order_number_sequence')::text, 6, '0');

  perform set_config('app.order_create', 'on', true);

  insert into public.orders (
    organization_id,
    location_id,
    order_number,
    customer_id,
    property_id,
    priority,
    due_at,
    customer_notes,
    internal_notes,
    created_by,
    updated_by
  )
  values (
    org_id,
    target_location_id,
    new_order_number,
    target_customer_id,
    target_property_id,
    coalesce(target_priority, 'normal'::public.order_priority),
    target_due_at,
    nullif(btrim(target_customer_notes), ''),
    nullif(btrim(target_internal_notes), ''),
    auth.uid(),
    auth.uid()
  )
  returning orders.id into new_order_id;

  perform set_config('app.workflow_transition', 'on', true);

  insert into public.order_status_history (
    organization_id,
    order_id,
    from_status,
    to_status,
    reason,
    changed_by,
    metadata
  )
  values (
    org_id,
    new_order_id,
    null,
    'draft',
    null,
    auth.uid(),
    jsonb_build_object('source', 'create_order')
  );

  return query select new_order_id as id, new_order_number as order_number;
end;
$$;
