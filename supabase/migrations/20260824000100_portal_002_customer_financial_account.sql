create function public.list_customer_portal_order_financials()
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
    where orders.is_active
      and orders.production_status <> 'cancelled'
      and exists (
        select 1
        from public.customer_portal_access access
        join public.customers customer
          on customer.organization_id = access.organization_id
         and customer.id = access.customer_id
        where access.organization_id = orders.organization_id
          and access.customer_id = orders.customer_id
          and access.user_id = auth.uid()
          and access.is_active
          and customer.is_active
      )
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

create function public.list_customer_portal_order_payments(target_order_id uuid)
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
  where payments.order_id = target_order_id
    and payments.status in ('confirmed', 'refunded')
    and orders.is_active
    and orders.production_status <> 'cancelled'
    and exists (
      select 1
      from public.customer_portal_access access
      join public.customers customer
        on customer.organization_id = access.organization_id
       and customer.id = access.customer_id
      where access.organization_id = orders.organization_id
        and access.customer_id = orders.customer_id
        and access.user_id = auth.uid()
        and access.is_active
        and customer.is_active
    )
  order by payments.paid_at desc, payments.created_at desc;
$$;

revoke all on function public.list_customer_portal_order_financials() from public, anon, authenticated;
revoke all on function public.list_customer_portal_order_payments(uuid) from public, anon, authenticated;

grant execute on function public.list_customer_portal_order_financials() to authenticated;
grant execute on function public.list_customer_portal_order_payments(uuid) to authenticated;
