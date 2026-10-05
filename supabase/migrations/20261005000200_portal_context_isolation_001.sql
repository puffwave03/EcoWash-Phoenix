-- PORTAL-CONTEXT-ISOLATION-001: bind every customer-facing Portal read to
-- the single canonical context returned by customer_portal_current_access().

create or replace function public.list_customer_portal_orders()
returns table (
  id uuid,
  order_number text,
  production_status public.production_status,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz,
  property_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    orders.id,
    orders.order_number,
    orders.production_status,
    orders.due_at,
    orders.completed_at,
    orders.created_at,
    property.name
  from public.orders orders
  join public.customer_portal_current_access() portal_context
    on portal_context.organization_id = orders.organization_id
   and portal_context.customer_id = orders.customer_id
  left join public.properties property
    on property.organization_id = orders.organization_id
   and property.id = orders.property_id
  where orders.is_active
    and orders.production_status <> 'cancelled'
  order by orders.created_at desc
  limit 100;
$$;

create or replace function public.get_customer_portal_order(target_order_id uuid)
returns table (
  id uuid,
  order_number text,
  production_status public.production_status,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz,
  property_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    orders.id,
    orders.order_number,
    orders.production_status,
    orders.due_at,
    orders.completed_at,
    orders.created_at,
    property.name
  from public.orders orders
  join public.customer_portal_current_access() portal_context
    on portal_context.organization_id = orders.organization_id
   and portal_context.customer_id = orders.customer_id
  left join public.properties property
    on property.organization_id = orders.organization_id
   and property.id = orders.property_id
  where orders.id = target_order_id
    and orders.is_active
    and orders.production_status <> 'cancelled'
  limit 1;
$$;

create or replace function public.list_customer_portal_order_items(target_order_id uuid)
returns table (
  id uuid,
  description text,
  unit_type public.service_unit_type,
  quantity numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    item.id,
    item.description,
    item.unit_type,
    item.quantity
  from public.order_items item
  join public.orders orders
    on orders.organization_id = item.organization_id
   and orders.id = item.order_id
  join public.customer_portal_current_access() portal_context
    on portal_context.organization_id = orders.organization_id
   and portal_context.customer_id = orders.customer_id
  where item.order_id = target_order_id
    and item.is_active
    and orders.is_active
    and orders.production_status <> 'cancelled'
  order by item.sort_order;
$$;

create or replace function public.list_customer_portal_order_history(target_order_id uuid)
returns table (
  id uuid,
  to_status public.production_status,
  changed_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    history.id,
    history.to_status,
    history.changed_at
  from public.order_status_history history
  join public.orders orders
    on orders.organization_id = history.organization_id
   and orders.id = history.order_id
  join public.customer_portal_current_access() portal_context
    on portal_context.organization_id = orders.organization_id
   and portal_context.customer_id = orders.customer_id
  where history.order_id = target_order_id
    and orders.is_active
    and orders.production_status <> 'cancelled'
  order by history.changed_at desc;
$$;

create or replace function public.list_customer_portal_logistics(target_order_id uuid)
returns table (
  kind text,
  status public.fulfillment_status,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  address_line1 text,
  address_line2 text,
  city text,
  postal_code text,
  country_code character,
  contact_phone text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    'pickup'::text,
    pickup.status,
    pickup.scheduled_at,
    pickup.started_at,
    pickup.completed_at,
    pickup.address_line1,
    pickup.address_line2,
    pickup.city,
    pickup.postal_code,
    pickup.country_code,
    pickup.contact_phone
  from public.pickups pickup
  join public.orders orders
    on orders.organization_id = pickup.organization_id
   and orders.id = pickup.order_id
  join public.customer_portal_current_access() portal_context
    on portal_context.organization_id = orders.organization_id
   and portal_context.customer_id = orders.customer_id
  where pickup.order_id = target_order_id
    and pickup.status <> 'cancelled'
    and orders.is_active
    and orders.production_status <> 'cancelled'
  union all
  select
    'delivery'::text,
    delivery.status,
    delivery.scheduled_at,
    delivery.started_at,
    delivery.completed_at,
    delivery.address_line1,
    delivery.address_line2,
    delivery.city,
    delivery.postal_code,
    delivery.country_code,
    delivery.contact_phone
  from public.deliveries delivery
  join public.orders orders
    on orders.organization_id = delivery.organization_id
   and orders.id = delivery.order_id
  join public.customer_portal_current_access() portal_context
    on portal_context.organization_id = orders.organization_id
   and portal_context.customer_id = orders.customer_id
  where delivery.order_id = target_order_id
    and delivery.status <> 'cancelled'
    and orders.is_active
    and orders.production_status <> 'cancelled';
$$;

create or replace function public.list_customer_portal_order_photos(target_order_id uuid)
returns table (
  id uuid,
  category public.photo_category,
  storage_bucket text,
  storage_path text,
  original_filename text,
  mime_type text,
  size_bytes bigint,
  caption text,
  created_at timestamptz,
  is_active boolean,
  customer_visible boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    photo.id,
    photo.category,
    photo.storage_bucket,
    photo.storage_path,
    photo.original_filename,
    photo.mime_type,
    photo.size_bytes,
    photo.caption,
    photo.created_at,
    photo.is_active,
    photo.customer_visible
  from public.order_photos photo
  join public.orders orders
    on orders.organization_id = photo.organization_id
   and orders.id = photo.order_id
  join public.customer_portal_current_access() portal_context
    on portal_context.organization_id = orders.organization_id
   and portal_context.customer_id = orders.customer_id
  where photo.order_id = target_order_id
    and photo.is_active
    and photo.customer_visible
    and orders.is_active
    and orders.production_status <> 'cancelled'
  order by photo.created_at desc;
$$;

create or replace function public.list_customer_portal_next_tasks()
returns table (
  kind text,
  order_id uuid,
  order_number text,
  status public.fulfillment_status,
  scheduled_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select *
  from (
    select
      'pickup'::text as kind,
      orders.id as order_id,
      orders.order_number,
      pickup.status,
      pickup.scheduled_at
    from public.pickups pickup
    join public.orders orders
      on orders.organization_id = pickup.organization_id
     and orders.id = pickup.order_id
    join public.customer_portal_current_access() portal_context
      on portal_context.organization_id = orders.organization_id
     and portal_context.customer_id = orders.customer_id
    where pickup.status in ('scheduled', 'in_progress')
      and pickup.scheduled_at >= now()
      and orders.is_active
      and orders.production_status <> 'cancelled'
    union all
    select
      'delivery'::text as kind,
      orders.id as order_id,
      orders.order_number,
      delivery.status,
      delivery.scheduled_at
    from public.deliveries delivery
    join public.orders orders
      on orders.organization_id = delivery.organization_id
     and orders.id = delivery.order_id
    join public.customer_portal_current_access() portal_context
      on portal_context.organization_id = orders.organization_id
     and portal_context.customer_id = orders.customer_id
    where delivery.status in ('scheduled', 'in_progress')
      and delivery.scheduled_at >= now()
      and orders.is_active
      and orders.production_status <> 'cancelled'
  ) tasks
  order by tasks.scheduled_at
  limit 1;
$$;

create or replace function public.can_access_customer_order_photo(
  target_bucket text,
  target_path text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.order_photos photo
    join public.orders orders
      on orders.organization_id = photo.organization_id
     and orders.id = photo.order_id
    join public.customer_portal_current_access() portal_context
      on portal_context.organization_id = orders.organization_id
     and portal_context.customer_id = orders.customer_id
    where photo.storage_bucket = target_bucket
      and photo.storage_path = target_path
      and photo.is_active
      and photo.customer_visible
      and orders.is_active
      and orders.production_status <> 'cancelled'
  );
$$;

create or replace function public.list_customer_portal_order_financials()
returns table (
  order_id uuid,
  subtotal numeric,
  discount_amount numeric,
  total_due numeric,
  total_paid numeric,
  balance_due numeric,
  payment_status text,
  currency text
)
language sql
stable
security definer
set search_path = public
as $$
  with authorized_orders as (
    select
      orders.id,
      orders.organization_id,
      orders.subtotal,
      orders.discount_amount,
      orders.total,
      orders.currency
    from public.orders orders
    join public.customer_portal_current_access() portal_context
      on portal_context.organization_id = orders.organization_id
     and portal_context.customer_id = orders.customer_id
    where orders.is_active
      and orders.production_status <> 'cancelled'
  ), payment_totals as (
    select
      authorized_orders.id as order_id,
      coalesce(sum(payments.amount) filter (where payments.status = 'confirmed'), 0) as confirmed_total,
      coalesce(sum(payments.amount) filter (where payments.status = 'refunded'), 0) as refunded_total,
      count(payments.id) filter (where payments.status = 'void') as void_count
    from authorized_orders
    left join public.payments payments
      on payments.organization_id = authorized_orders.organization_id
     and payments.order_id = authorized_orders.id
    group by authorized_orders.id
  )
  select
    authorized_orders.id,
    round(authorized_orders.subtotal, 2),
    round(authorized_orders.discount_amount, 2),
    round(authorized_orders.total, 2),
    round(payment_totals.confirmed_total - payment_totals.refunded_total, 2),
    round(greatest(
      authorized_orders.total - (payment_totals.confirmed_total - payment_totals.refunded_total),
      0
    ), 2),
    case
      when authorized_orders.total <= 0 then 'paid'
      when payment_totals.confirmed_total - payment_totals.refunded_total <= 0
        and payment_totals.refunded_total > 0 then 'refunded'
      when payment_totals.confirmed_total - payment_totals.refunded_total <= 0
        and payment_totals.confirmed_total = 0
        and payment_totals.void_count > 0 then 'void'
      when payment_totals.confirmed_total - payment_totals.refunded_total <= 0 then 'unpaid'
      when payment_totals.confirmed_total - payment_totals.refunded_total < authorized_orders.total then 'partially_paid'
      else 'paid'
    end,
    authorized_orders.currency
  from authorized_orders
  join payment_totals on payment_totals.order_id = authorized_orders.id
  order by authorized_orders.id;
$$;

create or replace function public.list_customer_portal_order_payments(target_order_id uuid)
returns table (
  id uuid,
  order_id uuid,
  amount numeric,
  method public.payment_method,
  status public.payment_record_status,
  paid_at timestamptz,
  currency text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    payments.id,
    payments.order_id,
    payments.amount,
    payments.method,
    payments.status,
    payments.paid_at,
    orders.currency
  from public.payments payments
  join public.orders orders
    on orders.organization_id = payments.organization_id
   and orders.id = payments.order_id
  join public.customer_portal_current_access() portal_context
    on portal_context.organization_id = orders.organization_id
   and portal_context.customer_id = orders.customer_id
  where payments.order_id = target_order_id
    and payments.status in ('confirmed', 'refunded')
    and orders.is_active
    and orders.production_status <> 'cancelled'
  order by payments.paid_at desc, payments.created_at desc;
$$;

create or replace function public.list_customer_portal_properties()
returns table (
  id uuid,
  name text,
  address_line1 text,
  address_line2 text,
  city text,
  postal_code text,
  country_code character,
  contact_name text,
  contact_phone text,
  access_instructions text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    property.id,
    property.name,
    property.address_line1,
    property.address_line2,
    property.city,
    property.postal_code,
    property.country_code,
    coalesce(property.contact_name, customer.display_name),
    coalesce(property.contact_phone, customer.phone),
    property.access_instructions
  from public.customer_portal_current_access() portal_context
  join public.customers customer
    on customer.organization_id = portal_context.organization_id
   and customer.id = portal_context.customer_id
  join public.organizations organization
    on organization.id = portal_context.organization_id
  join public.properties property
    on property.organization_id = portal_context.organization_id
   and property.customer_id = portal_context.customer_id
  where organization.status = 'active'
    and organization.deleted_at is null
    and property.is_active
  order by property.name, property.id;
$$;

create or replace function public.is_customer_portal_user_for_organization(
  target_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.customer_portal_current_access() portal_context
    join public.organizations organization
      on organization.id = portal_context.organization_id
    where portal_context.organization_id = target_organization_id
      and organization.platform_service_status = 'active'
      and organization.deleted_at is null
  );
$$;

revoke all on function public.list_customer_portal_orders() from public, anon, authenticated;
revoke all on function public.get_customer_portal_order(uuid) from public, anon, authenticated;
revoke all on function public.list_customer_portal_order_items(uuid) from public, anon, authenticated;
revoke all on function public.list_customer_portal_order_history(uuid) from public, anon, authenticated;
revoke all on function public.list_customer_portal_logistics(uuid) from public, anon, authenticated;
revoke all on function public.list_customer_portal_order_photos(uuid) from public, anon, authenticated;
revoke all on function public.list_customer_portal_next_tasks() from public, anon, authenticated;
revoke all on function public.can_access_customer_order_photo(text, text) from public, anon, authenticated;
revoke all on function public.list_customer_portal_order_financials() from public, anon, authenticated;
revoke all on function public.list_customer_portal_order_payments(uuid) from public, anon, authenticated;
revoke all on function public.list_customer_portal_properties() from public, anon, authenticated;
revoke all on function public.is_customer_portal_user_for_organization(uuid) from public, anon, authenticated;

grant execute on function public.list_customer_portal_orders() to authenticated;
grant execute on function public.get_customer_portal_order(uuid) to authenticated;
grant execute on function public.list_customer_portal_order_items(uuid) to authenticated;
grant execute on function public.list_customer_portal_order_history(uuid) to authenticated;
grant execute on function public.list_customer_portal_logistics(uuid) to authenticated;
grant execute on function public.list_customer_portal_order_photos(uuid) to authenticated;
grant execute on function public.list_customer_portal_next_tasks() to authenticated;
grant execute on function public.can_access_customer_order_photo(text, text) to authenticated;
grant execute on function public.list_customer_portal_order_financials() to authenticated;
grant execute on function public.list_customer_portal_order_payments(uuid) to authenticated;
grant execute on function public.list_customer_portal_properties() to authenticated;
grant execute on function public.is_customer_portal_user_for_organization(uuid) to authenticated;
