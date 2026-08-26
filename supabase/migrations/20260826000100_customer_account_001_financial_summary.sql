create function public.get_customer_account_summary(target_customer_id uuid)
returns table (
  currency text,
  order_count bigint,
  gross_order_value numeric,
  confirmed_payments numeric,
  refunded_payments numeric,
  net_paid numeric,
  outstanding_balance numeric,
  outstanding_order_count bigint,
  outstanding_order_value numeric,
  average_order_value numeric,
  last_order_at timestamptz,
  last_payment_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid;
begin
  org_id := public.app_current_organization_id();

  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'customer_account_not_authorized' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.customers customer
    where customer.organization_id = org_id
      and customer.id = target_customer_id
  ) then
    raise exception 'customer_account_invalid_customer' using errcode = '22023';
  end if;

  return query
  with eligible_orders as (
    select
      orders.id,
      orders.currency,
      orders.total,
      orders.created_at
    from public.orders orders
    where orders.organization_id = org_id
      and orders.customer_id = target_customer_id
      and orders.is_active
      and orders.production_status <> 'cancelled'
  ), payment_totals as (
    select
      eligible_orders.id as order_id,
      coalesce(sum(payments.amount) filter (where payments.status = 'confirmed'), 0) as confirmed_total,
      coalesce(sum(payments.amount) filter (where payments.status = 'refunded'), 0) as refunded_total,
      max(payments.paid_at) as last_payment_at
    from eligible_orders
    left join public.payments payments
      on payments.organization_id = org_id
     and payments.order_id = eligible_orders.id
    group by eligible_orders.id
  ), order_financials as (
    select
      eligible_orders.currency,
      eligible_orders.total,
      eligible_orders.created_at,
      payment_totals.confirmed_total,
      payment_totals.refunded_total,
      payment_totals.confirmed_total - payment_totals.refunded_total as net_paid,
      greatest(
        eligible_orders.total - (payment_totals.confirmed_total - payment_totals.refunded_total),
        0
      ) as balance_due,
      payment_totals.last_payment_at
    from eligible_orders
    join payment_totals on payment_totals.order_id = eligible_orders.id
  )
  select
    order_financials.currency,
    count(*)::bigint,
    round(sum(order_financials.total), 2),
    round(sum(order_financials.confirmed_total), 2),
    round(sum(order_financials.refunded_total), 2),
    round(sum(order_financials.net_paid), 2),
    round(sum(order_financials.balance_due), 2),
    count(*) filter (where order_financials.balance_due > 0)::bigint,
    round(coalesce(sum(order_financials.total) filter (where order_financials.balance_due > 0), 0), 2),
    round(avg(order_financials.total), 2),
    max(order_financials.created_at),
    max(order_financials.last_payment_at)
  from order_financials
  group by order_financials.currency
  order by order_financials.currency;
end;
$$;

create function public.list_customer_account_orders(
  target_customer_id uuid,
  target_period text default 'recent',
  target_limit integer default 8
)
returns table (
  id uuid,
  order_number text,
  property_id uuid,
  property_name text,
  production_status public.production_status,
  created_at timestamptz,
  total numeric,
  currency text,
  total_paid numeric,
  balance_due numeric,
  payment_status text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid;
  org_timezone text;
  safe_limit integer;
begin
  org_id := public.app_current_organization_id();

  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'customer_account_not_authorized' using errcode = '42501';
  end if;

  if target_period not in ('recent', 'year', 'all') then
    raise exception 'customer_account_invalid_period' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.customers customer
    where customer.organization_id = org_id
      and customer.id = target_customer_id
  ) then
    raise exception 'customer_account_invalid_customer' using errcode = '22023';
  end if;

  select organizations.timezone
  into org_timezone
  from public.organizations
  where organizations.id = org_id;

  safe_limit := greatest(1, least(coalesce(target_limit, 8), 100));

  return query
  with eligible_orders as (
    select
      orders.id,
      orders.order_number,
      orders.property_id,
      properties.name as property_name,
      orders.production_status,
      orders.created_at,
      orders.total,
      orders.currency
    from public.orders orders
    left join public.properties properties
      on properties.organization_id = orders.organization_id
     and properties.id = orders.property_id
    where orders.organization_id = org_id
      and orders.customer_id = target_customer_id
      and orders.is_active
      and orders.production_status <> 'cancelled'
      and (
        target_period <> 'year'
        or orders.created_at >= (
          date_trunc('year', now() at time zone org_timezone) at time zone org_timezone
        )
      )
  ), payment_totals as (
    select
      eligible_orders.id as order_id,
      coalesce(sum(payments.amount) filter (where payments.status = 'confirmed'), 0) as confirmed_total,
      coalesce(sum(payments.amount) filter (where payments.status = 'refunded'), 0) as refunded_total,
      count(payments.id) filter (where payments.status = 'void') as void_count
    from eligible_orders
    left join public.payments payments
      on payments.organization_id = org_id
     and payments.order_id = eligible_orders.id
    group by eligible_orders.id
  )
  select
    eligible_orders.id,
    eligible_orders.order_number,
    eligible_orders.property_id,
    eligible_orders.property_name,
    eligible_orders.production_status,
    eligible_orders.created_at,
    round(eligible_orders.total, 2),
    eligible_orders.currency,
    round(payment_totals.confirmed_total - payment_totals.refunded_total, 2),
    round(greatest(
      eligible_orders.total - (payment_totals.confirmed_total - payment_totals.refunded_total),
      0
    ), 2),
    case
      when eligible_orders.total <= 0 then 'paid'
      when payment_totals.confirmed_total - payment_totals.refunded_total <= 0
        and payment_totals.refunded_total > 0 then 'refunded'
      when payment_totals.confirmed_total - payment_totals.refunded_total <= 0
        and payment_totals.confirmed_total = 0
        and payment_totals.void_count > 0 then 'void'
      when payment_totals.confirmed_total - payment_totals.refunded_total <= 0 then 'unpaid'
      when payment_totals.confirmed_total - payment_totals.refunded_total < eligible_orders.total then 'partially_paid'
      else 'paid'
    end
  from eligible_orders
  join payment_totals on payment_totals.order_id = eligible_orders.id
  order by eligible_orders.created_at desc, eligible_orders.id desc
  limit safe_limit;
end;
$$;

create function public.list_customer_account_payments(
  target_customer_id uuid,
  target_period text default 'recent',
  target_limit integer default 12
)
returns table (
  id uuid,
  order_id uuid,
  order_number text,
  amount numeric,
  method public.payment_method,
  status public.payment_record_status,
  paid_at timestamptz,
  refunded_from_payment_id uuid,
  currency text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid;
  org_timezone text;
  safe_limit integer;
begin
  org_id := public.app_current_organization_id();

  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'customer_account_not_authorized' using errcode = '42501';
  end if;

  if target_period not in ('recent', 'year', 'all') then
    raise exception 'customer_account_invalid_period' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.customers customer
    where customer.organization_id = org_id
      and customer.id = target_customer_id
  ) then
    raise exception 'customer_account_invalid_customer' using errcode = '22023';
  end if;

  select organizations.timezone
  into org_timezone
  from public.organizations
  where organizations.id = org_id;

  safe_limit := greatest(1, least(coalesce(target_limit, 12), 100));

  return query
  select
    payments.id,
    payments.order_id,
    orders.order_number,
    round(payments.amount, 2),
    payments.method,
    payments.status,
    payments.paid_at,
    payments.refunded_from_payment_id,
    orders.currency
  from public.payments payments
  join public.orders orders
    on orders.organization_id = payments.organization_id
   and orders.id = payments.order_id
  where orders.organization_id = org_id
    and orders.customer_id = target_customer_id
    and orders.is_active
    and orders.production_status <> 'cancelled'
    and (
      target_period <> 'year'
      or payments.paid_at >= (
        date_trunc('year', now() at time zone org_timezone) at time zone org_timezone
      )
    )
  order by payments.paid_at desc, payments.created_at desc, payments.id desc
  limit safe_limit;
end;
$$;

revoke all on function public.get_customer_account_summary(uuid) from public, anon, authenticated;
revoke all on function public.list_customer_account_orders(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.list_customer_account_payments(uuid, text, integer) from public, anon, authenticated;

grant execute on function public.get_customer_account_summary(uuid) to authenticated;
grant execute on function public.list_customer_account_orders(uuid, text, integer) to authenticated;
grant execute on function public.list_customer_account_payments(uuid, text, integer) to authenticated;
