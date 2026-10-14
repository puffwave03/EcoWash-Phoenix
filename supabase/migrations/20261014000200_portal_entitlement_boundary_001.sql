-- PORTAL-ENTITLEMENT-BOUNDARY-001
-- No entitlement rows or historical Portal access/order records are changed.
-- CREATE OR REPLACE preserves function signatures, ownership and grants.

create or replace function public.customer_portal_current_access()
returns table (access_id uuid, organization_id uuid, customer_id uuid, customer_name text, customer_email text)
language sql stable security definer set search_path = public
as $$
  -- Select the existing first active context before enforcing entitlement.
  -- Do not switch to a later entitled context when the first is denied.
  with selected_access as materialized (
    select access.id, access.organization_id, access.customer_id,
      customer.display_name, coalesce(customer.email, access.email) as customer_email
    from public.customer_portal_access access
    join public.customers customer
      on customer.organization_id = access.organization_id and customer.id = access.customer_id
    where access.user_id = auth.uid() and access.is_active and customer.is_active
    order by access.created_at
    limit 1
  )
  select selected_access.id, selected_access.organization_id,
    selected_access.customer_id, selected_access.display_name,
    selected_access.customer_email
  from selected_access
  join public.organizations organization
    on organization.id = selected_access.organization_id
   and organization.status = 'active'
   and organization.deleted_at is null
   and organization.platform_service_status = 'active'
  where public.organization_entitlement_is_enabled(
    selected_access.organization_id, 'core.portal', now()
  );
$$;

create or replace function public.get_customer_portal_ordering_context()
returns table (timezone text, currency text)
language sql stable security definer set search_path = public
as $$
  select organization.timezone, organization.default_currency::text
  from public.customer_portal_current_access() portal_context
  join public.organizations organization
    on organization.id = portal_context.organization_id;
$$;

CREATE OR REPLACE FUNCTION "public"."list_customer_portal_services"() RETURNS TABLE("id" "uuid", "name" "text", "description" "text", "unit_type" "public"."service_unit_type", "category" "text", "category_title" "text", "amount" numeric, "currency" "text", "price_is_from" boolean, "pricing_source" "text", "portal_featured" boolean, "category_featured" boolean, "customer_orderable" boolean, "portal_image_path" "text", "segment_id" "uuid", "segment_name" "text", "segment_description" "text", "segment_match" boolean, "segment_featured" boolean, "segment_sort_order" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with portal_context as (
    select
      portal_context.organization_id,
      portal_context.customer_id,
      customer.catalog_segment_id,
      organization.timezone,
      (select location.id from public.locations location
       where location.organization_id = portal_context.organization_id
         and location.is_active and location.deleted_at is null
       order by location.created_at, location.id limit 1) as location_id
    from public.customer_portal_current_access() portal_context
    join public.customers customer
      on customer.organization_id = portal_context.organization_id
     and customer.id = portal_context.customer_id
    join public.organizations organization
      on organization.id = portal_context.organization_id
  )
  select
    service.id,
    service.name,
    coalesce(service.portal_description, service.description),
    service.unit_type,
    service.portal_category_key,
    category.portal_title,
    current_price.amount,
    current_price.currency,
    current_price.price_is_from,
    current_price.pricing_source,
    service.portal_featured,
    category.portal_featured,
    service.customer_orderable,
    service.portal_image_path,
    segment.id,
    segment.name,
    segment.description,
    segment.id is not null and service.customer_orderable
      and (segment_service.service_id is not null or segment_category.category_key is not null),
    coalesce(segment_service.featured, false),
    case
      when segment_service.service_id is not null then segment_service.display_order
      when segment_category.category_key is not null then 100000 + segment_category.display_order
      else 200000 + service.portal_sort_order
    end
  from portal_context context
  join public.services service
    on service.organization_id = context.organization_id
   and service.is_active and service.portal_visible
   and (service.location_id is null or service.location_id = context.location_id)
  join public.organization_portal_categories category
    on category.organization_id = context.organization_id
   and category.category_key = service.portal_category_key
   and category.portal_visible
  left join public.catalog_segments segment
    on segment.organization_id = context.organization_id
   and segment.id = context.catalog_segment_id
   and segment.is_active and segment.portal_visible
  left join public.catalog_segment_services segment_service
    on segment_service.organization_id = context.organization_id
   and segment_service.segment_id = segment.id and segment_service.service_id = service.id
  left join public.catalog_segment_categories segment_category
    on segment_category.organization_id = context.organization_id
   and segment_category.segment_id = segment.id
   and segment_category.category_key = service.portal_category_key
  join lateral public.resolve_effective_service_price(
    context.organization_id,
    context.customer_id,
    service.id,
    context.location_id,
    (now() at time zone context.timezone)::date
  ) current_price on true
  order by
    case when segment.id is not null and service.customer_orderable
      and (segment_service.service_id is not null or segment_category.category_key is not null)
      then 0 else 1 end,
    case
      when segment_service.service_id is not null then segment_service.display_order
      when segment_category.category_key is not null then 100000 + segment_category.display_order
      else 200000 + category.portal_sort_order
    end,
    category.portal_sort_order, service.portal_sort_order, service.name, service.id;
$$;

CREATE OR REPLACE FUNCTION "public"."get_catalog_presentation"("target_locale" "text", "target_service_ids" "uuid"[]) RETURNS TABLE("service_id" "uuid", "display_name" "text", "display_description" "text", "category_title" "text", "order_mode" "text", "manual_sort_order" integer, "category_sort_order" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  org_id uuid;
begin
  if target_locale not in ('en', 'it', 'es', 'fr', 'de')
    or coalesce(cardinality(target_service_ids), 0) > 500 then
    raise exception 'catalog_presentation_invalid' using errcode = '22023';
  end if;

  select membership.organization_id into org_id
  from public.organization_memberships membership
  join public.organizations organization on organization.id = membership.organization_id
  where membership.profile_id = auth.uid() and membership.is_active
    and organization.status = 'active' and organization.deleted_at is null
  limit 1;

  if org_id is null then
    select portal_context.organization_id into org_id
    from public.customer_portal_current_access() portal_context;
  end if;

  if org_id is null then
    raise exception 'catalog_presentation_denied' using errcode = '42501';
  end if;

  return query
  select
    service.id,
    coalesce(local_service.name, default_service.name, service.name),
    coalesce(local_service.description, default_service.description, service.portal_description, service.description),
    coalesce(local_category.title, default_category.title, category.portal_title,
      initcap(replace(category.category_key, '_', ' '))),
    organization.catalog_order_mode,
    service.portal_sort_order,
    category.portal_sort_order
  from public.services service
  join public.organizations organization on organization.id = service.organization_id
  left join public.organization_portal_categories category
    on category.organization_id = service.organization_id
   and category.category_key = service.portal_category_key
  left join public.service_catalog_translations local_service
    on local_service.organization_id = service.organization_id
   and local_service.service_id = service.id and local_service.locale = target_locale
  left join public.service_catalog_translations default_service
    on default_service.organization_id = service.organization_id
   and default_service.service_id = service.id and default_service.locale = 'en'
  left join public.category_catalog_translations local_category
    on local_category.organization_id = category.organization_id
   and local_category.category_key = category.category_key and local_category.locale = target_locale
  left join public.category_catalog_translations default_category
    on default_category.organization_id = category.organization_id
   and default_category.category_key = category.category_key and default_category.locale = 'en'
  where service.organization_id = org_id and service.id = any(target_service_ids);
end;
$$;

CREATE OR REPLACE FUNCTION "public"."create_customer_portal_order_request"("target_request_id" "uuid", "target_property_id" "uuid", "target_items" "jsonb", "target_requested_pickup_at" timestamp without time zone, "target_customer_notes" "text") RETURNS TABLE("id" "uuid", "order_number" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  portal_org_id uuid;
  active_location_count bigint;
  item jsonb;
  item_service_id uuid;
begin
  select portal_context.organization_id into portal_org_id
  from public.customer_portal_current_access() portal_context;

  if portal_org_id is null
    or not public.organization_entitlement_is_enabled(portal_org_id, 'core.portal', now()) then
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

  perform set_config('app.portal_after_close_intake', 'on', true);

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

CREATE OR REPLACE FUNCTION "public"."create_customer_portal_order_request_catalog_001"("target_request_id" "uuid", "target_property_id" "uuid", "target_items" "jsonb", "target_requested_pickup_at" timestamp without time zone, "target_customer_notes" "text") RETURNS TABLE("id" "uuid", "order_number" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
  from public.customer_portal_current_access() portal_context
  join public.customer_portal_access access
    on access.id = portal_context.access_id
  join public.organizations organization
    on organization.id = portal_context.organization_id;

  if portal_org_id is null or portal_customer_id is null
    or not public.organization_entitlement_is_enabled(portal_org_id, 'core.portal', now()) then
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
      and service.portal_visible
      and (service.location_id is null or service.location_id = portal_location_id);

    if item_service_name is null or item_unit_type is null or item_price is null then
      raise exception 'portal_request_service_unavailable';
    end if;

    if item_unit_type in ('piece', 'cycle', 'service', 'day') and item_quantity <> trunc(item_quantity) then
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

  new_order_number := public.allocate_order_reference(portal_org_id);

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

CREATE OR REPLACE FUNCTION "public"."assign_portal_order_operational_business_date"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  organization_timezone text;
  submission_business_date date;
begin
  if current_setting('app.portal_after_close_intake', true) is distinct from 'on' then
    return new;
  end if;

  if not exists (
    select 1
    from public.customer_portal_access access
    join public.customers customer
      on customer.organization_id = access.organization_id
     and customer.id = access.customer_id
    where access.user_id = auth.uid()
      and access.organization_id = new.organization_id
      and access.customer_id = new.customer_id
      and access.is_active
      and customer.is_active
  ) then
    raise exception 'portal_request_unauthorized' using errcode = '42501';
  end if;

  select organization.timezone
  into organization_timezone
  from public.organizations organization
  where organization.id = new.organization_id
    and organization.status = 'active'
    and organization.deleted_at is null;

  if organization_timezone is null
    or not public.organization_entitlement_is_enabled(new.organization_id, 'core.portal', now()) then
    raise exception 'portal_request_unauthorized' using errcode = '42501';
  end if;

  submission_business_date :=
    (new.created_at at time zone organization_timezone)::date;

  perform pg_advisory_xact_lock_shared(hashtextextended(
    new.organization_id::text || ':daily-close-scope:' ||
      submission_business_date::text || ':organization',
    0
  ));

  if new.location_id is not null then
    perform pg_advisory_xact_lock_shared(hashtextextended(
      new.organization_id::text || ':daily-close-scope:' ||
        submission_business_date::text || ':' || new.location_id::text,
      0
    ));
  end if;

  if exists (
    select 1
    from public.daily_closes daily_close
    where daily_close.organization_id = new.organization_id
      and daily_close.business_date = submission_business_date
      and (
        daily_close.location_id is null
        or daily_close.location_id = new.location_id
      )
  ) then
    new.operational_business_date := submission_business_date + 1;
  end if;

  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."get_customer_portal_online_payment_availability"("target_order_id" "uuid") RETURNS TABLE("entitlement_enabled" boolean, "provider_configured" boolean, "eligible" boolean, "provider" "text", "amount" numeric, "currency" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  portal_access public.customer_portal_access%rowtype;
  target_order public.orders%rowtype;
  paid_total numeric(12,2);
  configured_provider text;
  configured_enabled boolean := false;
begin
  select access.* into portal_access
  from public.customer_portal_current_access() portal_context
  join public.customer_portal_access access
    on access.id = portal_context.access_id;

  if portal_access.id is null
    or not public.organization_entitlement_is_enabled(portal_access.organization_id, 'core.portal', now()) then
    raise exception 'customer_portal_access_required' using errcode = '42501';
  end if;

  select orders.* into target_order
  from public.orders orders
  where orders.id = target_order_id
    and orders.organization_id = portal_access.organization_id
    and orders.customer_id = portal_access.customer_id
    and orders.is_active
    and orders.production_status <> 'cancelled';

  if target_order.id is null then
    raise exception 'online_payment_order_invalid' using errcode = '42501';
  end if;

  select
    config.provider,
    config.enabled
  into configured_provider, configured_enabled
  from public.organization_online_payment_configs config
  where config.organization_id = portal_access.organization_id;

  select coalesce(sum(payment.amount) filter (where payment.status = 'confirmed'), 0)
       - coalesce(sum(payment.amount) filter (where payment.status = 'refunded'), 0)
  into paid_total
  from public.payments payment
  where payment.organization_id = target_order.organization_id
    and payment.order_id = target_order.id;

  entitlement_enabled := public.organization_entitlement_is_enabled(
    portal_access.organization_id,
    'payments.online',
    now()
  );
  provider_configured := coalesce(configured_enabled, false) and configured_provider is not null;
  amount := round(greatest(target_order.total - paid_total, 0), 2);
  currency := target_order.currency;
  provider := configured_provider;
  eligible := entitlement_enabled and provider_configured and amount > 0;
  return next;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."create_customer_online_payment_attempt"("target_order_id" "uuid", "target_idempotency_key" "uuid") RETURNS TABLE("attempt_id" "uuid", "amount" numeric, "currency" "text", "provider" "text", "provider_session_id" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  portal_access public.customer_portal_access%rowtype;
  target_order public.orders%rowtype;
  existing_attempt public.online_payment_attempts%rowtype;
  configured_provider text;
  paid_total numeric(12,2);
  outstanding numeric(12,2);
  result_id uuid;
begin
  if target_idempotency_key is null then
    raise exception 'online_payment_idempotency_required' using errcode = '22023';
  end if;

  select access.* into portal_access
  from public.customer_portal_current_access() portal_context
  join public.customer_portal_access access
    on access.id = portal_context.access_id;

  if portal_access.id is null
    or not public.organization_entitlement_is_enabled(portal_access.organization_id, 'core.portal', now()) then
    raise exception 'customer_portal_access_required' using errcode = '42501';
  end if;

  if not public.organization_entitlement_is_enabled(
    portal_access.organization_id,
    'payments.online',
    now()
  ) then
    raise exception 'online_payment_entitlement_required' using errcode = '42501';
  end if;

  select config.provider into configured_provider
  from public.organization_online_payment_configs config
  where config.organization_id = portal_access.organization_id
    and config.enabled;

  if configured_provider is null then
    raise exception 'online_payment_provider_not_configured' using errcode = '55000';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    portal_access.organization_id::text || ':online-payment:' || target_order_id::text,
    0
  ));

  select attempt.* into existing_attempt
  from public.online_payment_attempts attempt
  where attempt.organization_id = portal_access.organization_id
    and attempt.idempotency_key = target_idempotency_key;

  if existing_attempt.id is not null then
    if existing_attempt.order_id <> target_order_id
      or existing_attempt.customer_id <> portal_access.customer_id
      or existing_attempt.provider <> configured_provider then
      raise exception 'online_payment_idempotency_conflict' using errcode = '23505';
    end if;

    attempt_id := existing_attempt.id;
    amount := existing_attempt.amount;
    currency := existing_attempt.currency;
    provider := existing_attempt.provider;
    provider_session_id := existing_attempt.provider_session_id;
    return next;
    return;
  end if;

  select orders.* into target_order
  from public.orders orders
  where orders.id = target_order_id
    and orders.organization_id = portal_access.organization_id
    and orders.customer_id = portal_access.customer_id
    and orders.is_active
    and orders.production_status <> 'cancelled'
  for update;

  if target_order.id is null then
    raise exception 'online_payment_order_invalid' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.online_payment_attempts attempt
    where attempt.organization_id = portal_access.organization_id
      and attempt.order_id = target_order_id
      and attempt.status = 'pending'
      and (attempt.expires_at is null or attempt.expires_at > now())
  ) then
    raise exception 'online_payment_attempt_in_progress' using errcode = '55000';
  end if;

  perform set_config('app.payments_online_001_mutation', 'on', true);
  update public.online_payment_attempts attempt
  set status = 'expired', failure_code = 'session_expired'
  where attempt.organization_id = portal_access.organization_id
    and attempt.order_id = target_order_id
    and attempt.status = 'pending'
    and attempt.expires_at <= now();

  select coalesce(sum(payment.amount) filter (where payment.status = 'confirmed'), 0)
       - coalesce(sum(payment.amount) filter (where payment.status = 'refunded'), 0)
  into paid_total
  from public.payments payment
  where payment.organization_id = target_order.organization_id
    and payment.order_id = target_order.id;

  outstanding := round(greatest(target_order.total - paid_total, 0), 2);
  if outstanding <= 0 then
    raise exception 'online_payment_no_balance' using errcode = '22023';
  end if;

  insert into public.online_payment_attempts (
    organization_id,
    customer_id,
    order_id,
    initiated_by_user_id,
    amount,
    currency,
    provider,
    idempotency_key,
    expires_at
  ) values (
    portal_access.organization_id,
    portal_access.customer_id,
    target_order.id,
    auth.uid(),
    outstanding,
    target_order.currency,
    configured_provider,
    target_idempotency_key,
    now() + interval '30 minutes'
  ) returning id into result_id;

  attempt_id := result_id;
  amount := outstanding;
  currency := target_order.currency;
  provider := configured_provider;
  provider_session_id := null;
  return next;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."upsert_customer_portal_access"("target_customer_id" "uuid", "target_user_id" "uuid", "target_email" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  actor_profile_id uuid := auth.uid();
  org_id uuid;
  access_id uuid;
begin
  select customer.organization_id
  into org_id
  from public.customers customer
  where customer.id = target_customer_id
    and customer.is_active;

  if org_id is null then
    raise exception 'invalid customer';
  end if;

  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'not authorized';
  end if;

  if not public.organization_entitlement_is_enabled(org_id, 'core.portal', now()) then
    raise exception 'portal_entitlement_required' using errcode = '42501';
  end if;

  insert into public.customer_portal_access (
    organization_id,
    customer_id,
    user_id,
    email,
    is_active,
    invited_by,
    disabled_by,
    disabled_at
  )
  values (
    org_id,
    target_customer_id,
    target_user_id,
    lower(btrim(target_email)),
    true,
    actor_profile_id,
    null,
    null
  )
  on conflict (organization_id, customer_id)
  do update
  set user_id = excluded.user_id,
      email = excluded.email,
      is_active = true,
      invited_by = excluded.invited_by,
      disabled_by = null,
      disabled_at = null
  returning id into access_id;

  return access_id;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."update_customer_portal_access"("target_access_id" "uuid", "target_is_active" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  actor_profile_id uuid := auth.uid();
  org_id uuid;
  customer_active boolean;
begin
  select access.organization_id, customer.is_active
  into org_id, customer_active
  from public.customer_portal_access access
  join public.customers customer
    on customer.organization_id = access.organization_id
   and customer.id = access.customer_id
  where access.id = target_access_id;

  if org_id is null then
    raise exception 'invalid customer access';
  end if;

  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'not authorized';
  end if;

  if target_is_active
    and not public.organization_entitlement_is_enabled(org_id, 'core.portal', now()) then
    raise exception 'portal_entitlement_required' using errcode = '42501';
  end if;

  if target_is_active and not customer_active then
    raise exception 'customer_lifecycle_inactive_customer' using errcode = '55000';
  end if;

  update public.customer_portal_access
  set is_active = target_is_active,
      disabled_by = case when target_is_active then null else actor_profile_id end,
      disabled_at = case when target_is_active then null else now() end
  where id = target_access_id
    and organization_id = org_id;
end;
$$;

-- Keep management inspection/disable available; gate direct customer reads.
drop policy if exists customer_portal_access_select_self_or_manager on public.customer_portal_access;
create policy customer_portal_access_select_self_or_manager
on public.customer_portal_access for select to authenticated
using (
  public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[])
  or (user_id = auth.uid()
      and public.is_customer_portal_user_for_organization(organization_id))
);

drop policy if exists online_payment_attempts_select_customer_or_management on public.online_payment_attempts;
create policy online_payment_attempts_select_customer_or_management
on public.online_payment_attempts for select to authenticated
using (
  public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[])
  or exists (
    select 1 from public.customer_portal_current_access() portal_context
    where portal_context.organization_id = online_payment_attempts.organization_id
      and portal_context.customer_id = online_payment_attempts.customer_id
  )
);
