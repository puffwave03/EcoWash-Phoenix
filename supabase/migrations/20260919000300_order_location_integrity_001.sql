-- ORDER-LOCATION-INTEGRITY-001
-- Require every newly-created order to use an active location in its tenant.
-- Existing orders, including historical rows with a null location, are untouched.

create or replace function public.validate_order_relationships()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and current_setting('app.order_create', true) <> 'on' then
    raise exception 'orders inserts require create_order RPC';
  end if;

  if tg_op = 'INSERT' and (
    new.location_id is null
    or not exists (
      select 1
      from public.locations location
      where location.id = new.location_id
        and location.organization_id = new.organization_id
        and location.is_active
        and location.deleted_at is null
    )
  ) then
    raise exception 'order_location_invalid' using errcode = '22023';
  end if;

  if new.property_id is not null and not exists (
    select 1
    from public.properties property
    where property.id = new.property_id
      and property.organization_id = new.organization_id
      and property.customer_id = new.customer_id
  ) then
    raise exception 'orders.property_id must belong to the same customer and organization';
  end if;

  if new.assigned_to is not null and not exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = new.organization_id
      and membership.profile_id = new.assigned_to
      and membership.is_active
  ) then
    raise exception 'orders.assigned_to must be an active organization member';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_order_relationships() from public;

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
  resolved_location_id uuid;
  active_location_count bigint;
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

  if target_location_id is null then
    select
      count(*),
      (array_agg(location.id order by location.created_at, location.id))[1]
    into active_location_count, resolved_location_id
    from public.locations location
    where location.organization_id = org_id
      and location.is_active
      and location.deleted_at is null;

    if active_location_count = 0 then
      raise exception 'order_location_unavailable' using errcode = '22023';
    end if;

    if active_location_count > 1 then
      raise exception 'order_location_selection_required' using errcode = '22023';
    end if;
  else
    select location.id
    into resolved_location_id
    from public.locations location
    where location.id = target_location_id
      and location.organization_id = org_id
      and location.is_active
      and location.deleted_at is null;

    if resolved_location_id is null then
      raise exception 'order_location_invalid' using errcode = '22023';
    end if;
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
    resolved_location_id,
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

revoke all on function public.create_order(
  uuid,
  uuid,
  uuid,
  public.order_priority,
  timestamptz,
  text,
  text
) from public, anon;

grant execute on function public.create_order(
  uuid,
  uuid,
  uuid,
  public.order_priority,
  timestamptz,
  text,
  text
) to authenticated;

create or replace function public.create_customer_portal_order_request(
  target_request_id uuid,
  target_property_id uuid,
  target_items jsonb,
  target_requested_pickup_at timestamp without time zone,
  target_customer_notes text
)
returns table (
  id uuid,
  order_number text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  portal_org_id uuid;
  active_location_count bigint;
  item jsonb;
  item_service_id uuid;
begin
  select access.organization_id
  into portal_org_id
  from public.customer_portal_access access
  join public.customers customer
    on customer.organization_id = access.organization_id
   and customer.id = access.customer_id
  join public.organizations organization
    on organization.id = access.organization_id
  where access.user_id = auth.uid()
    and access.is_active
    and customer.is_active
    and organization.status = 'active'
    and organization.deleted_at is null
  order by access.created_at
  limit 1;

  if portal_org_id is null then
    raise exception 'portal_request_unauthorized';
  end if;

  select count(*)
  into active_location_count
  from public.locations location
  where location.organization_id = portal_org_id
    and location.is_active
    and location.deleted_at is null;

  if active_location_count = 0 then
    raise exception 'portal_request_location_unavailable' using errcode = '22023';
  end if;

  if active_location_count > 1 then
    raise exception 'portal_request_location_selection_required' using errcode = '22023';
  end if;

  if target_items is null or jsonb_typeof(target_items) <> 'array' then
    raise exception 'portal_request_invalid_items';
  end if;

  for item in select value from jsonb_array_elements(target_items)
  loop
    begin
      item_service_id := nullif(item ->> 'service_id', '')::uuid;
    exception when others then
      raise exception 'portal_request_invalid_items';
    end;

    if item_service_id is null or not exists (
      select 1
      from public.services service
      join public.organization_portal_categories category
        on category.organization_id = service.organization_id
       and category.category_key = service.portal_category_key
       and category.portal_visible
      where service.id = item_service_id
        and service.organization_id = portal_org_id
        and service.is_active
        and service.portal_visible
        and service.customer_orderable
    ) then
      raise exception 'portal_request_service_unavailable';
    end if;
  end loop;

  return query
  select request.id, request.order_number
  from public.create_customer_portal_order_request_catalog_001(
    target_request_id,
    target_property_id,
    target_items,
    target_requested_pickup_at,
    target_customer_notes
  ) request;
end;
$$;

revoke all on function public.create_customer_portal_order_request(
  uuid,
  uuid,
  jsonb,
  timestamp without time zone,
  text
) from public, anon, authenticated;

grant execute on function public.create_customer_portal_order_request(
  uuid,
  uuid,
  jsonb,
  timestamp without time zone,
  text
) to authenticated;
