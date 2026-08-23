-- PORTAL-002.1 corrective fix: remove PL/pgSQL variable/column ambiguity.

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
  actor_id uuid := auth.uid();
  portal_org_id uuid;
  portal_customer_id uuid;
  org_timezone text;
  org_currency text;
  portal_location_id uuid;
  property_address_line1 text;
  property_address_line2 text;
  property_city text;
  property_postal_code text;
  property_country_code text;
  property_contact_name text;
  property_contact_phone text;
  property_access_instructions text;
  portal_pickup_at timestamptz;
  new_order_id uuid;
  new_order_number text;
  existing_order_id uuid;
  existing_order_number text;
  item jsonb;
  item_service_id uuid;
  item_quantity numeric;
  item_service_name text;
  item_unit_type public.service_unit_type;
  item_price numeric(12,2);
  normalized_items jsonb := '[]'::jsonb;
  selected_service_ids uuid[] := array[]::uuid[];
  item_index integer := 0;
begin
  if actor_id is null or target_request_id is null then
    raise exception 'portal_request_unauthorized';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_request_id::text, 0));

  select
    access.organization_id,
    access.customer_id,
    organization.timezone,
    organization.default_currency::text,
    (
      select location.id
      from public.locations location
      where location.organization_id = access.organization_id
        and location.is_active
        and location.deleted_at is null
      order by location.created_at, location.id
      limit 1
    )
  into portal_org_id, portal_customer_id, org_timezone, org_currency, portal_location_id
  from public.customer_portal_access access
  join public.customers customer
    on customer.organization_id = access.organization_id
   and customer.id = access.customer_id
  join public.organizations organization
    on organization.id = access.organization_id
  where access.user_id = actor_id
    and access.is_active
    and customer.is_active
    and organization.status = 'active'
    and organization.deleted_at is null
  order by access.created_at
  limit 1;

  if portal_org_id is null or portal_customer_id is null then
    raise exception 'portal_request_unauthorized';
  end if;

  select target_order.id, target_order.order_number
  into existing_order_id, existing_order_number
  from public.orders target_order
  join public.order_status_history history
    on history.organization_id = target_order.organization_id
   and history.order_id = target_order.id
  where target_order.organization_id = portal_org_id
    and target_order.customer_id = portal_customer_id
    and history.metadata ->> 'source' = 'customer_portal'
    and history.metadata ->> 'request_id' = target_request_id::text
  order by history.changed_at
  limit 1;

  if existing_order_id is not null then
    return query select existing_order_id, existing_order_number;
    return;
  end if;

  select
    property.address_line1,
    property.address_line2,
    property.city,
    property.postal_code,
    property.country_code::text,
    coalesce(property.contact_name, customer.display_name),
    coalesce(property.contact_phone, customer.phone),
    property.access_instructions
  into
    property_address_line1,
    property_address_line2,
    property_city,
    property_postal_code,
    property_country_code,
    property_contact_name,
    property_contact_phone,
    property_access_instructions
  from public.properties property
  join public.customers customer
    on customer.organization_id = property.organization_id
   and customer.id = property.customer_id
  where property.id = target_property_id
    and property.organization_id = portal_org_id
    and property.customer_id = portal_customer_id
    and property.is_active;

  if property_address_line1 is null
    or btrim(property_address_line1) = ''
    or property_city is null
    or btrim(property_city) = ''
    or property_country_code is null
    or btrim(property_country_code) = '' then
    raise exception 'portal_request_invalid_property';
  end if;

  if target_requested_pickup_at is null then
    raise exception 'portal_request_invalid_pickup_time';
  end if;

  portal_pickup_at := target_requested_pickup_at at time zone org_timezone;

  if portal_pickup_at <= now() then
    raise exception 'portal_request_pickup_in_past';
  end if;

  if target_items is null
    or jsonb_typeof(target_items) <> 'array'
    or jsonb_array_length(target_items) < 1
    or jsonb_array_length(target_items) > 20 then
    raise exception 'portal_request_invalid_items';
  end if;

  for item in select value from jsonb_array_elements(target_items)
  loop
    if jsonb_typeof(item) <> 'object' then
      raise exception 'portal_request_invalid_items';
    end if;

    begin
      item_service_id := nullif(item ->> 'service_id', '')::uuid;
      item_quantity := nullif(item ->> 'quantity', '')::numeric;
    exception when others then
      raise exception 'portal_request_invalid_items';
    end;

    if item_service_id is null
      or item_quantity is null
      or item_quantity <= 0
      or item_quantity > 10000
      or item_quantity <> round(item_quantity, 3)
      or item_service_id = any(selected_service_ids) then
      raise exception 'portal_request_invalid_items';
    end if;

    select
      service.name,
      service.unit_type,
      current_price.amount
    into item_service_name, item_unit_type, item_price
    from public.services service
    join lateral (
      select price.amount
      from public.service_prices price
      where price.organization_id = portal_org_id
        and price.service_id = service.id
        and price.is_active
        and price.currency = org_currency
        and price.valid_from <= (now() at time zone org_timezone)::date
        and (price.valid_to is null or price.valid_to >= (now() at time zone org_timezone)::date)
        and (price.location_id is null or price.location_id = portal_location_id)
      order by (price.location_id is not null) desc, price.valid_from desc, price.created_at desc
      limit 1
    ) current_price on true
    where service.id = item_service_id
      and service.organization_id = portal_org_id
      and service.is_active
      and (service.location_id is null or service.location_id = portal_location_id);

    if item_service_name is null or item_unit_type is null or item_price is null then
      raise exception 'portal_request_service_unavailable';
    end if;

    if item_unit_type = 'piece' and item_quantity <> trunc(item_quantity) then
      raise exception 'portal_request_invalid_items';
    end if;

    selected_service_ids := array_append(selected_service_ids, item_service_id);
    normalized_items := normalized_items || jsonb_build_array(jsonb_build_object(
      'service_id', item_service_id,
      'description', item_service_name,
      'unit_type', item_unit_type,
      'quantity', item_quantity,
      'unit_price', item_price
    ));
  end loop;

  new_order_number := 'EW-' || lpad(nextval('public.order_number_sequence')::text, 6, '0');

  perform set_config('app.order_create', 'on', true);

  insert into public.orders (
    organization_id,
    location_id,
    order_number,
    customer_id,
    property_id,
    production_status,
    priority,
    customer_notes,
    internal_notes,
    currency,
    assigned_to,
    created_by,
    updated_by
  )
  values (
    portal_org_id,
    portal_location_id,
    new_order_number,
    portal_customer_id,
    target_property_id,
    'draft',
    'normal',
    left(nullif(btrim(target_customer_notes), ''), 1000),
    null,
    org_currency,
    null,
    actor_id,
    actor_id
  )
  returning orders.id into new_order_id;

  perform set_config('app.order_item_mutation', 'on', true);

  for item in select value from jsonb_array_elements(normalized_items)
  loop
    item_index := item_index + 1;

    insert into public.order_items (
      organization_id,
      order_id,
      service_id,
      description,
      unit_type,
      quantity,
      unit_price,
      line_total,
      sort_order,
      created_by,
      updated_by
    )
    values (
      portal_org_id,
      new_order_id,
      (item ->> 'service_id')::uuid,
      item ->> 'description',
      (item ->> 'unit_type')::public.service_unit_type,
      (item ->> 'quantity')::numeric,
      (item ->> 'unit_price')::numeric,
      round((item ->> 'quantity')::numeric * (item ->> 'unit_price')::numeric, 2),
      item_index,
      actor_id,
      actor_id
    );
  end loop;

  perform public.recalculate_order_totals(new_order_id);

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
    portal_org_id,
    new_order_id,
    null,
    'draft',
    null,
    actor_id,
    jsonb_build_object(
      'source', 'customer_portal',
      'request_id', target_request_id::text
    )
  );

  perform set_config('app.app_007_mutation', 'on', true);

  insert into public.pickups (
    organization_id,
    order_id,
    status,
    scheduled_at,
    assigned_to,
    address_line1,
    address_line2,
    city,
    postal_code,
    country_code,
    contact_name,
    contact_phone,
    notes,
    fee,
    created_by,
    updated_by
  )
  values (
    portal_org_id,
    new_order_id,
    'scheduled',
    portal_pickup_at,
    null,
    nullif(btrim(property_address_line1), ''),
    nullif(btrim(property_address_line2), ''),
    nullif(btrim(property_city), ''),
    nullif(btrim(property_postal_code), ''),
    nullif(upper(btrim(property_country_code)), ''),
    nullif(btrim(property_contact_name), ''),
    nullif(btrim(property_contact_phone), ''),
    left(nullif(btrim(property_access_instructions), ''), 600),
    0,
    actor_id,
    actor_id
  );

  return query select new_order_id, new_order_number;
end;
$$;
