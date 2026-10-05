create index orders_org_created_id_export_idx
on public.orders (organization_id, created_at desc, id asc);

create index payments_org_paid_id_export_idx
on public.payments (organization_id, paid_at desc, id asc);

create index expenses_org_date_id_export_idx
on public.expenses (organization_id, expense_date asc, id asc);

create index expenses_org_location_date_id_export_idx
on public.expenses (organization_id, location_id, expense_date asc, id asc);

create function public.list_accounting_sales_export_page(
  target_start timestamptz,
  target_end_exclusive timestamptz,
  target_location_id uuid,
  target_cursor_event_date timestamptz default null,
  target_cursor_event_type text default null,
  target_cursor_event_id uuid default null,
  target_limit integer default 250
)
returns table (
  event_date timestamptz,
  event_type text,
  event_id uuid,
  order_reference text,
  customer text,
  location text,
  payment_method text,
  amount numeric,
  currency text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid := public.app_current_organization_id();
begin
  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'accounting_export_denied';
  end if;
  if target_start is null or target_end_exclusive is null or target_start >= target_end_exclusive then
    raise exception 'accounting_export_period_invalid';
  end if;
  if target_limit is null or target_limit < 1 or target_limit > 250 then
    raise exception 'accounting_export_page_size_invalid';
  end if;
  if (target_cursor_event_date is null) <> (target_cursor_event_type is null)
    or (target_cursor_event_date is null) <> (target_cursor_event_id is null)
    or (target_cursor_event_type is not null and target_cursor_event_type not in ('sale', 'payment', 'refund')) then
    raise exception 'accounting_export_cursor_invalid';
  end if;
  if target_location_id is not null and not exists (
    select 1 from public.locations location
    where location.organization_id = org_id
      and location.id = target_location_id
      and location.is_active
      and location.deleted_at is null
  ) then
    raise exception 'accounting_export_location_invalid';
  end if;

  return query
  with sale_events as (
    select
      orders.created_at as event_date,
      'sale'::text as event_type,
      orders.id as event_id,
      orders.order_number as order_reference,
      customer.display_name as customer,
      location.name as location,
      null::text as payment_method,
      orders.total as amount,
      orders.currency as currency
    from public.orders orders
    join public.customers customer
      on customer.organization_id = orders.organization_id
     and customer.id = orders.customer_id
    left join public.locations location
      on location.organization_id = orders.organization_id
     and location.id = orders.location_id
    where orders.organization_id = org_id
      and orders.is_active
      and orders.production_status <> 'cancelled'
      and orders.created_at >= target_start
      and orders.created_at < target_end_exclusive
      and (target_location_id is null or orders.location_id = target_location_id)
      and not (
        exists (
          select 1 from public.order_status_history history
          where history.organization_id = orders.organization_id
            and history.order_id = orders.id
            and history.metadata @> '{"source":"quick_drop"}'::jsonb
        )
        and not exists (
          select 1 from public.order_items item
          where item.organization_id = orders.organization_id
            and item.order_id = orders.id
            and item.is_active
        )
      )
      and (
        target_cursor_event_date is null
        or orders.created_at < target_cursor_event_date
        or (orders.created_at = target_cursor_event_date and 'sale'::text > target_cursor_event_type)
        or (orders.created_at = target_cursor_event_date and 'sale'::text = target_cursor_event_type and orders.id > target_cursor_event_id)
      )
    order by orders.created_at desc, orders.id asc
    limit target_limit
  ), payment_events as (
    select
      payments.paid_at as event_date,
      'payment'::text as event_type,
      payments.id as event_id,
      orders.order_number as order_reference,
      customer.display_name as customer,
      location.name as location,
      payments.method::text as payment_method,
      payments.amount as amount,
      orders.currency as currency
    from public.payments payments
    join public.orders orders
      on orders.organization_id = payments.organization_id
     and orders.id = payments.order_id
    join public.customers customer
      on customer.organization_id = orders.organization_id
     and customer.id = orders.customer_id
    left join public.locations location
      on location.organization_id = orders.organization_id
     and location.id = orders.location_id
    where payments.organization_id = org_id
      and payments.status = 'confirmed'
      and orders.is_active
      and payments.paid_at >= target_start
      and payments.paid_at < target_end_exclusive
      and (target_location_id is null or orders.location_id = target_location_id)
      and (
        target_cursor_event_date is null
        or payments.paid_at < target_cursor_event_date
        or (payments.paid_at = target_cursor_event_date and 'payment'::text > target_cursor_event_type)
        or (payments.paid_at = target_cursor_event_date and 'payment'::text = target_cursor_event_type and payments.id > target_cursor_event_id)
      )
    order by payments.paid_at desc, payments.id asc
    limit target_limit
  ), refund_events as (
    select
      payments.paid_at as event_date,
      'refund'::text as event_type,
      payments.id as event_id,
      orders.order_number as order_reference,
      customer.display_name as customer,
      location.name as location,
      payments.method::text as payment_method,
      payments.amount as amount,
      orders.currency as currency
    from public.payments payments
    join public.orders orders
      on orders.organization_id = payments.organization_id
     and orders.id = payments.order_id
    join public.customers customer
      on customer.organization_id = orders.organization_id
     and customer.id = orders.customer_id
    left join public.locations location
      on location.organization_id = orders.organization_id
     and location.id = orders.location_id
    where payments.organization_id = org_id
      and payments.status = 'refunded'
      and orders.is_active
      and payments.paid_at >= target_start
      and payments.paid_at < target_end_exclusive
      and (target_location_id is null or orders.location_id = target_location_id)
      and (
        target_cursor_event_date is null
        or payments.paid_at < target_cursor_event_date
        or (payments.paid_at = target_cursor_event_date and 'refund'::text > target_cursor_event_type)
        or (payments.paid_at = target_cursor_event_date and 'refund'::text = target_cursor_event_type and payments.id > target_cursor_event_id)
      )
    order by payments.paid_at desc, payments.id asc
    limit target_limit
  ), events as (
    select * from sale_events
    union all
    select * from payment_events
    union all
    select * from refund_events
  )
  select events.event_date, events.event_type, events.event_id, events.order_reference,
    events.customer, events.location, events.payment_method, events.amount, events.currency
  from events
  order by events.event_date desc, events.event_type asc, events.event_id asc
  limit target_limit;
end;
$$;

revoke all on function public.list_accounting_sales_export_page(timestamptz, timestamptz, uuid, timestamptz, text, uuid, integer) from public, anon, authenticated;
grant execute on function public.list_accounting_sales_export_page(timestamptz, timestamptz, uuid, timestamptz, text, uuid, integer) to authenticated;
