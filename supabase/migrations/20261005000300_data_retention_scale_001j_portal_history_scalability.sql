-- DATA-RETENTION-AND-SCALE-001J: bounded Portal history, complete overview
-- aggregates, and targeted order financial reads within the canonical context.

create function public.list_customer_portal_orders_page(
  target_cursor_created_at timestamptz,
  target_cursor_id uuid,
  target_direction text,
  target_limit integer
)
returns table (
  id uuid,
  order_number text,
  production_status public.production_status,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz,
  property_name text,
  subtotal numeric,
  discount_amount numeric,
  total_due numeric,
  total_paid numeric,
  balance_due numeric,
  payment_status text,
  currency text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if target_direction is null or target_direction not in ('older', 'newer')
     or (target_cursor_created_at is null) <> (target_cursor_id is null)
     or (target_cursor_id is null and target_direction <> 'older')
     or target_limit is null or target_limit not between 1 and 26 then
    raise exception 'customer_portal_orders_invalid_page' using errcode = '22023';
  end if;

  return query
  with selected as materialized (
    select
      orders.id,
      orders.organization_id,
      orders.order_number,
      orders.production_status,
      orders.due_at,
      orders.completed_at,
      orders.created_at,
      orders.subtotal,
      orders.discount_amount,
      orders.total,
      orders.currency,
      property.name as property_name
    from public.orders orders
    join public.customer_portal_current_access() portal_context
      on portal_context.organization_id = orders.organization_id
     and portal_context.customer_id = orders.customer_id
    left join public.properties property
      on property.organization_id = orders.organization_id
     and property.id = orders.property_id
    where orders.is_active
      and orders.production_status <> 'cancelled'
      and (
        target_cursor_id is null
        or (target_direction = 'older' and (orders.created_at, orders.id) < (target_cursor_created_at, target_cursor_id))
        or (target_direction = 'newer' and (orders.created_at, orders.id) > (target_cursor_created_at, target_cursor_id))
      )
    order by
      case when target_direction = 'older' then orders.created_at end desc,
      case when target_direction = 'older' then orders.id end desc,
      case when target_direction = 'newer' then orders.created_at end asc,
      case when target_direction = 'newer' then orders.id end asc
    limit target_limit
  ), payment_totals as (
    select
      selected.id as order_id,
      coalesce(sum(payments.amount) filter (where payments.status = 'confirmed'), 0) as confirmed_total,
      coalesce(sum(payments.amount) filter (where payments.status = 'refunded'), 0) as refunded_total,
      count(payments.id) filter (where payments.status = 'void') as void_count
    from selected
    left join public.payments payments
      on payments.organization_id = selected.organization_id
     and payments.order_id = selected.id
    group by selected.id
  )
  select
    selected.id,
    selected.order_number,
    selected.production_status,
    selected.due_at,
    selected.completed_at,
    selected.created_at,
    selected.property_name,
    round(selected.subtotal, 2),
    round(selected.discount_amount, 2),
    round(selected.total, 2),
    round(payment_totals.confirmed_total - payment_totals.refunded_total, 2),
    round(greatest(selected.total - (payment_totals.confirmed_total - payment_totals.refunded_total), 0), 2),
    case
      when selected.total <= 0 then 'paid'
      when payment_totals.confirmed_total - payment_totals.refunded_total <= 0
        and payment_totals.refunded_total > 0 then 'refunded'
      when payment_totals.confirmed_total - payment_totals.refunded_total <= 0
        and payment_totals.confirmed_total = 0
        and payment_totals.void_count > 0 then 'void'
      when payment_totals.confirmed_total - payment_totals.refunded_total <= 0 then 'unpaid'
      when payment_totals.confirmed_total - payment_totals.refunded_total < selected.total then 'partially_paid'
      else 'paid'
    end,
    selected.currency
  from selected
  join payment_totals on payment_totals.order_id = selected.id
  order by
    case when target_direction = 'older' then selected.created_at end desc,
    case when target_direction = 'older' then selected.id end desc,
    case when target_direction = 'newer' then selected.created_at end asc,
    case when target_direction = 'newer' then selected.id end asc;
end;
$$;

create function public.count_customer_portal_orders()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)
  from public.orders orders
  join public.customer_portal_current_access() portal_context
    on portal_context.organization_id = orders.organization_id
   and portal_context.customer_id = orders.customer_id
  where orders.is_active
    and orders.production_status <> 'cancelled';
$$;

create function public.get_customer_portal_current_order()
returns table (
  id uuid,
  order_number text,
  production_status public.production_status,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz,
  property_name text,
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
  with selected as materialized (
    select
      orders.id,
      orders.organization_id,
      orders.order_number,
      orders.production_status,
      orders.due_at,
      orders.completed_at,
      orders.created_at,
      orders.subtotal,
      orders.discount_amount,
      orders.total,
      orders.currency,
      property.name as property_name
    from public.orders orders
    join public.customer_portal_current_access() portal_context
      on portal_context.organization_id = orders.organization_id
     and portal_context.customer_id = orders.customer_id
    left join public.properties property
      on property.organization_id = orders.organization_id
     and property.id = orders.property_id
    where orders.is_active
      and orders.production_status not in ('completed', 'cancelled')
    order by orders.created_at desc, orders.id desc
    limit 1
  ), payment_totals as (
    select
      selected.id as order_id,
      coalesce(sum(payments.amount) filter (where payments.status = 'confirmed'), 0) as confirmed_total,
      coalesce(sum(payments.amount) filter (where payments.status = 'refunded'), 0) as refunded_total,
      count(payments.id) filter (where payments.status = 'void') as void_count
    from selected
    left join public.payments payments
      on payments.organization_id = selected.organization_id
     and payments.order_id = selected.id
    group by selected.id
  )
  select
    selected.id,
    selected.order_number,
    selected.production_status,
    selected.due_at,
    selected.completed_at,
    selected.created_at,
    selected.property_name,
    round(selected.subtotal, 2),
    round(selected.discount_amount, 2),
    round(selected.total, 2),
    round(payment_totals.confirmed_total - payment_totals.refunded_total, 2),
    round(greatest(selected.total - (payment_totals.confirmed_total - payment_totals.refunded_total), 0), 2),
    case
      when selected.total <= 0 then 'paid'
      when payment_totals.confirmed_total - payment_totals.refunded_total <= 0
        and payment_totals.refunded_total > 0 then 'refunded'
      when payment_totals.confirmed_total - payment_totals.refunded_total <= 0
        and payment_totals.confirmed_total = 0
        and payment_totals.void_count > 0 then 'void'
      when payment_totals.confirmed_total - payment_totals.refunded_total <= 0 then 'unpaid'
      when payment_totals.confirmed_total - payment_totals.refunded_total < selected.total then 'partially_paid'
      else 'paid'
    end,
    selected.currency
  from selected
  join payment_totals on payment_totals.order_id = selected.id;
$$;

create function public.get_customer_portal_account_summary()
returns table (
  currency text,
  total_value numeric,
  total_paid numeric,
  balance_due numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with authorized_orders as (
    select orders.id, orders.organization_id, orders.total, orders.currency
    from public.orders orders
    join public.customer_portal_current_access() portal_context
      on portal_context.organization_id = orders.organization_id
     and portal_context.customer_id = orders.customer_id
    where orders.is_active
      and orders.production_status <> 'cancelled'
  ), per_order as (
    select
      authorized_orders.id,
      authorized_orders.currency,
      authorized_orders.total,
      coalesce(sum(payments.amount) filter (where payments.status = 'confirmed'), 0)
        - coalesce(sum(payments.amount) filter (where payments.status = 'refunded'), 0) as paid
    from authorized_orders
    left join public.payments payments
      on payments.organization_id = authorized_orders.organization_id
     and payments.order_id = authorized_orders.id
    group by authorized_orders.id, authorized_orders.currency, authorized_orders.total
  )
  select
    per_order.currency,
    round(sum(per_order.total), 2),
    round(sum(per_order.paid), 2),
    round(sum(greatest(per_order.total - per_order.paid, 0)), 2)
  from per_order
  group by per_order.currency
  order by per_order.currency;
$$;

create function public.get_customer_portal_order_financial(target_order_id uuid)
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
  with authorized_order as (
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
    where orders.id = target_order_id
      and orders.is_active
      and orders.production_status <> 'cancelled'
    limit 1
  ), payment_totals as (
    select
      authorized_order.id as order_id,
      coalesce(sum(payments.amount) filter (where payments.status = 'confirmed'), 0) as confirmed_total,
      coalesce(sum(payments.amount) filter (where payments.status = 'refunded'), 0) as refunded_total,
      count(payments.id) filter (where payments.status = 'void') as void_count
    from authorized_order
    left join public.payments payments
      on payments.organization_id = authorized_order.organization_id
     and payments.order_id = authorized_order.id
    group by authorized_order.id
  )
  select
    authorized_order.id,
    round(authorized_order.subtotal, 2),
    round(authorized_order.discount_amount, 2),
    round(authorized_order.total, 2),
    round(payment_totals.confirmed_total - payment_totals.refunded_total, 2),
    round(greatest(authorized_order.total - (payment_totals.confirmed_total - payment_totals.refunded_total), 0), 2),
    case
      when authorized_order.total <= 0 then 'paid'
      when payment_totals.confirmed_total - payment_totals.refunded_total <= 0
        and payment_totals.refunded_total > 0 then 'refunded'
      when payment_totals.confirmed_total - payment_totals.refunded_total <= 0
        and payment_totals.confirmed_total = 0
        and payment_totals.void_count > 0 then 'void'
      when payment_totals.confirmed_total - payment_totals.refunded_total <= 0 then 'unpaid'
      when payment_totals.confirmed_total - payment_totals.refunded_total < authorized_order.total then 'partially_paid'
      else 'paid'
    end,
    authorized_order.currency
  from authorized_order
  join payment_totals on payment_totals.order_id = authorized_order.id;
$$;

revoke all on function public.list_customer_portal_orders_page(timestamptz,uuid,text,integer) from public, anon, authenticated;
revoke all on function public.count_customer_portal_orders() from public, anon, authenticated;
revoke all on function public.get_customer_portal_current_order() from public, anon, authenticated;
revoke all on function public.get_customer_portal_account_summary() from public, anon, authenticated;
revoke all on function public.get_customer_portal_order_financial(uuid) from public, anon, authenticated;

grant execute on function public.list_customer_portal_orders_page(timestamptz,uuid,text,integer) to authenticated;
grant execute on function public.count_customer_portal_orders() to authenticated;
grant execute on function public.get_customer_portal_current_order() to authenticated;
grant execute on function public.get_customer_portal_account_summary() to authenticated;
grant execute on function public.get_customer_portal_order_financial(uuid) to authenticated;
