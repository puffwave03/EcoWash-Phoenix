-- PORTAL-AFTER-CLOSE-INTAKE-001
-- Preserve the true Portal submission timestamp while assigning only a newly
-- inserted post-close Portal order to the next tenant-local operational date.
-- Existing rows and persisted Daily Close snapshots are untouched.

alter table public.orders
add column operational_business_date date;

comment on column public.orders.operational_business_date is
  'Explicit tenant-local operational date for deferred Portal intake; NULL preserves created_at attribution.';

create index orders_operational_business_date_idx
on public.orders (organization_id, operational_business_date, location_id)
where operational_business_date is not null;

create function public.assign_portal_order_operational_business_date()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

  if organization_timezone is null then
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

create trigger portal_order_operational_business_date
before insert on public.orders
for each row execute function public.assign_portal_order_operational_business_date();

create function public.protect_order_operational_business_date()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.operational_business_date is distinct from old.operational_business_date then
    raise exception 'orders.operational_business_date cannot be changed'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger orders_protect_operational_business_date
before update of operational_business_date on public.orders
for each row execute function public.protect_order_operational_business_date();

revoke all on function public.assign_portal_order_operational_business_date()
from public, anon, authenticated;

revoke all on function public.protect_order_operational_business_date()
from public, anon, authenticated;

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

create or replace function public.calculate_daily_close_snapshot(
  target_organization_id uuid,
  target_business_date date,
  target_location_id uuid,
  target_timezone text,
  target_day_start timestamptz,
  target_day_end_exclusive timestamptz,
  target_default_currency text
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with
sales_orders as (
  select orders.id, orders.currency, orders.subtotal, orders.total
  from public.orders orders
  where orders.organization_id = target_organization_id
    and orders.is_active
    and orders.production_status <> 'cancelled'
    and coalesce(orders.operational_business_date, (orders.created_at at time zone target_timezone)::date) = target_business_date
    and (target_location_id is null or orders.location_id = target_location_id)
    and (
      not exists (
        select 1 from public.order_status_history history
        where history.organization_id = target_organization_id
          and history.order_id = orders.id
          and history.metadata @> '{"source":"quick_drop"}'::jsonb
      )
      or exists (
        select 1 from public.order_items item
        where item.organization_id = target_organization_id
          and item.order_id = orders.id
          and item.is_active
      )
    )
),
sales_balances as (
  select sales.id, sales.currency, sales.subtotal, sales.total,
    greatest(
      sales.total - coalesce((
        select sum(payment.amount)
        from public.payments payment
        where payment.organization_id = target_organization_id
          and payment.order_id = sales.id
          and payment.status = 'confirmed'
      ), 0),
      0
    )::numeric(12,2) as outstanding
  from sales_orders sales
),
period_payments as (
  select payment.id, payment.order_id, payment.amount, payment.method, payment.status,
    payment.channel, payment.pos_session_id, orders.currency, orders.location_id
  from public.payments payment
  join public.orders orders
    on orders.organization_id = payment.organization_id
   and orders.id = payment.order_id
  where payment.organization_id = target_organization_id
    and orders.is_active
    and payment.paid_at >= target_day_start
    and payment.paid_at < target_day_end_exclusive
    and (target_location_id is null or orders.location_id = target_location_id)
),
period_sessions as (
  select session.*
  from public.pos_sessions session
  where session.organization_id = target_organization_id
    and session.opened_at >= target_day_start
    and session.opened_at < target_day_end_exclusive
    and (target_location_id is null or session.location_id = target_location_id)
),
session_cash as (
  select session.id,
    coalesce(sum(payment.amount) filter (
      where payment.method = 'cash' and payment.status = 'confirmed'
    ), 0)::numeric(12,2) as cash_in,
    coalesce(sum(payment.amount) filter (
      where payment.method = 'cash' and payment.status = 'refunded'
    ), 0)::numeric(12,2) as cash_out
  from period_sessions session
  left join public.payments payment
    on payment.organization_id = session.organization_id
   and payment.pos_session_id = session.id
  group by session.id
),
currencies as (
  select currency from sales_orders
  union
  select currency from period_payments
  union
  select target_default_currency where exists (select 1 from period_sessions)
),
accounting_by_currency as (
  select currencies.currency,
    (select count(*) from sales_balances sales where sales.currency = currencies.currency)::integer as order_count,
    coalesce((select sum(sales.subtotal) from sales_balances sales where sales.currency = currencies.currency), 0)::numeric(12,2) as sales_gross,
    coalesce((select sum(sales.total) from sales_balances sales where sales.currency = currencies.currency), 0)::numeric(12,2) as sales_net,
    coalesce((select sum(sales.outstanding) from sales_balances sales where sales.currency = currencies.currency), 0)::numeric(12,2) as outstanding,
    (select count(*) from sales_balances sales where sales.currency = currencies.currency and sales.outstanding > 0)::integer as outstanding_order_count,
    coalesce((select jsonb_agg(sales.id order by sales.id) from sales_balances sales where sales.currency = currencies.currency and sales.outstanding > 0), '[]'::jsonb) as outstanding_order_ids,
    (select count(*) from period_payments payment where payment.currency = currencies.currency and payment.status = 'confirmed')::integer as confirmed_payment_count,
    (select count(*) from period_payments payment where payment.currency = currencies.currency and payment.status = 'refunded')::integer as refund_count,
    coalesce((select sum(payment.amount) from period_payments payment where payment.currency = currencies.currency and payment.status = 'confirmed'), 0)::numeric(12,2) as collected_gross,
    coalesce((select sum(payment.amount) from period_payments payment where payment.currency = currencies.currency and payment.status = 'refunded'), 0)::numeric(12,2) as refunds,
    coalesce((select sum(payment.amount) from period_payments payment where payment.currency = currencies.currency and payment.status = 'confirmed' and payment.method = 'cash'), 0)::numeric(12,2) as cash_collected,
    coalesce((select sum(payment.amount) from period_payments payment where payment.currency = currencies.currency and payment.status = 'confirmed' and payment.method = 'card' and payment.channel <> 'online'), 0)::numeric(12,2) as card_collected,
    coalesce((select sum(payment.amount) from period_payments payment where payment.currency = currencies.currency and payment.status = 'confirmed' and payment.method = 'bank_transfer'), 0)::numeric(12,2) as bank_transfer_collected,
    coalesce((select sum(payment.amount) from period_payments payment where payment.currency = currencies.currency and payment.status = 'confirmed' and payment.method = 'other'), 0)::numeric(12,2) as other_collected,
    coalesce((select sum(payment.amount) from period_payments payment where payment.currency = currencies.currency and payment.status = 'confirmed' and payment.channel = 'online'), 0)::numeric(12,2) as online_collected,
    coalesce((select jsonb_agg(payment.id order by payment.id) from period_payments payment where payment.currency = currencies.currency and payment.status = 'confirmed'), '[]'::jsonb) as payment_ids,
    coalesce((select jsonb_agg(payment.id order by payment.id) from period_payments payment where payment.currency = currencies.currency and payment.status = 'refunded'), '[]'::jsonb) as refund_ids
  from currencies
),
order_events as (
  select
    coalesce(jsonb_agg(orders.id order by orders.id) filter (where coalesce(orders.operational_business_date, (orders.created_at at time zone target_timezone)::date) = target_business_date), '[]'::jsonb) as created_ids,
    coalesce(jsonb_agg(orders.id order by orders.id) filter (where orders.completed_at >= target_day_start and orders.completed_at < target_day_end_exclusive), '[]'::jsonb) as production_completed_ids,
    coalesce(jsonb_agg(orders.id order by orders.id) filter (where orders.cancelled_at >= target_day_start and orders.cancelled_at < target_day_end_exclusive), '[]'::jsonb) as cancelled_ids
  from public.orders orders
  where orders.organization_id = target_organization_id
    and (target_location_id is null or orders.location_id = target_location_id)
    and (
      (coalesce(orders.operational_business_date, (orders.created_at at time zone target_timezone)::date) = target_business_date)
      or (orders.completed_at >= target_day_start and orders.completed_at < target_day_end_exclusive)
      or (orders.cancelled_at >= target_day_start and orders.cancelled_at < target_day_end_exclusive)
    )
),
open_orders as (
  select orders.id, orders.production_status, orders.due_at
  from public.orders orders
  where orders.organization_id = target_organization_id
    and orders.is_active
    and orders.production_status in ('draft', 'received', 'washing', 'drying', 'ironing', 'quality_check', 'packing', 'ready', 'on_hold')
    and coalesce(orders.operational_business_date, (orders.created_at at time zone target_timezone)::date) <= target_business_date
    and (target_location_id is null or orders.location_id = target_location_id)
),
logistics_facts as (
  select 'pickup'::text as kind, pickup.id, pickup.order_id, pickup.status,
    pickup.scheduled_at, pickup.completed_at, orders.location_id
  from public.pickups pickup
  join public.orders orders on orders.organization_id = pickup.organization_id and orders.id = pickup.order_id
  where pickup.organization_id = target_organization_id
    and orders.is_active and orders.production_status not in ('draft', 'cancelled')
    and (target_location_id is null or orders.location_id = target_location_id)
  union all
  select 'delivery'::text, delivery.id, delivery.order_id, delivery.status,
    delivery.scheduled_at, delivery.completed_at, orders.location_id
  from public.deliveries delivery
  join public.orders orders on orders.organization_id = delivery.organization_id and orders.id = delivery.order_id
  where delivery.organization_id = target_organization_id
    and orders.is_active and orders.production_status not in ('draft', 'cancelled')
    and (target_location_id is null or orders.location_id = target_location_id)
),
due_logistics as (
  select * from logistics_facts
  where status in ('scheduled', 'in_progress')
    and (status = 'in_progress' or scheduled_at < target_day_end_exclusive)
),
completed_logistics as (
  select * from logistics_facts
  where status = 'completed'
    and completed_at >= target_day_start
    and completed_at < target_day_end_exclusive
),
final_fulfillment as (
  select delivery.order_id, 'delivery'::text as kind, delivery.id as fact_id
  from public.deliveries delivery
  join public.orders orders on orders.organization_id = delivery.organization_id and orders.id = delivery.order_id
  where delivery.organization_id = target_organization_id
    and delivery.status = 'completed'
    and delivery.completed_at >= target_day_start and delivery.completed_at < target_day_end_exclusive
    and orders.is_active and orders.production_status = 'completed'
    and (target_location_id is null or orders.location_id = target_location_id)
  union all
  select handoff.order_id, 'customer_handoff'::text, handoff.id
  from public.order_customer_handoffs handoff
  join public.orders orders on orders.organization_id = handoff.organization_id and orders.id = handoff.order_id
  where handoff.organization_id = target_organization_id
    and handoff.completed_at >= target_day_start and handoff.completed_at < target_day_end_exclusive
    and orders.is_active and orders.production_status = 'completed'
    and (target_location_id is null or handoff.location_id = target_location_id)
),
open_session_blocker as (
  select count(*)::integer as count
  from public.pos_sessions session
  where session.organization_id = target_organization_id
    and session.status = 'open'
    and session.opened_at < target_day_end_exclusive
    and (target_location_id is null or session.location_id = target_location_id or session.location_id is null)
),
cash_without_session_blocker as (
  select count(*)::integer as count
  from public.payments payment
  join public.orders orders on orders.organization_id = payment.organization_id and orders.id = payment.order_id
  where payment.organization_id = target_organization_id
    and payment.method = 'cash' and payment.status in ('confirmed', 'refunded')
    and payment.paid_at >= target_day_start and payment.paid_at < target_day_end_exclusive
    and payment.pos_session_id is null
    and (target_location_id is null or orders.location_id = target_location_id or orders.location_id is null)
),
location_mismatch_blocker as (
  select count(*)::integer as count from (
    select payment.id
    from public.payments payment
    join public.orders orders on orders.organization_id = payment.organization_id and orders.id = payment.order_id
    join public.pos_sessions session on session.organization_id = payment.organization_id and session.id = payment.pos_session_id
    where payment.organization_id = target_organization_id
      and payment.status in ('confirmed', 'refunded')
      and payment.paid_at >= target_day_start and payment.paid_at < target_day_end_exclusive
      and orders.location_id is not null and session.location_id is not null
      and orders.location_id <> session.location_id
      and (target_location_id is null or orders.location_id = target_location_id or session.location_id = target_location_id)
    union all
    select handoff.id
    from public.order_customer_handoffs handoff
    join public.orders orders on orders.organization_id = handoff.organization_id and orders.id = handoff.order_id
    where handoff.organization_id = target_organization_id
      and handoff.completed_at >= target_day_start and handoff.completed_at < target_day_end_exclusive
      and handoff.location_id is distinct from orders.location_id
      and (target_location_id is null or handoff.location_id = target_location_id or orders.location_id = target_location_id)
  ) mismatches
),
null_location_facts as (
  select count(*)::integer as count from (
    select 'order:' || orders.id::text as fact
    from public.orders orders
    where orders.organization_id = target_organization_id and orders.location_id is null
      and (
        (coalesce(orders.operational_business_date, (orders.created_at at time zone target_timezone)::date) = target_business_date)
        or (orders.completed_at >= target_day_start and orders.completed_at < target_day_end_exclusive)
        or (orders.cancelled_at >= target_day_start and orders.cancelled_at < target_day_end_exclusive)
        or (orders.is_active and orders.production_status in ('draft', 'received', 'washing', 'drying', 'ironing', 'quality_check', 'packing', 'ready', 'on_hold') and coalesce(orders.operational_business_date, (orders.created_at at time zone target_timezone)::date) <= target_business_date)
      )
    union
    select 'payment:' || payment.id::text
    from public.payments payment
    join public.orders orders on orders.organization_id = payment.organization_id and orders.id = payment.order_id
    where payment.organization_id = target_organization_id and orders.location_id is null
      and payment.status in ('confirmed', 'refunded')
      and payment.paid_at >= target_day_start and payment.paid_at < target_day_end_exclusive
    union
    select 'session:' || session.id::text
    from public.pos_sessions session
    where session.organization_id = target_organization_id and session.location_id is null
      and ((session.opened_at >= target_day_start and session.opened_at < target_day_end_exclusive)
        or (session.status = 'open' and session.opened_at < target_day_start))
    union
    select 'pickup:' || pickup.id::text
    from public.pickups pickup
    join public.orders orders on orders.organization_id = pickup.organization_id and orders.id = pickup.order_id
    where pickup.organization_id = target_organization_id and orders.location_id is null
      and orders.is_active and orders.production_status not in ('draft', 'cancelled')
      and ((pickup.status in ('scheduled', 'in_progress') and (pickup.status = 'in_progress' or pickup.scheduled_at < target_day_end_exclusive))
        or (pickup.status = 'completed' and pickup.completed_at >= target_day_start and pickup.completed_at < target_day_end_exclusive))
    union
    select 'delivery:' || delivery.id::text
    from public.deliveries delivery
    join public.orders orders on orders.organization_id = delivery.organization_id and orders.id = delivery.order_id
    where delivery.organization_id = target_organization_id and orders.location_id is null
      and orders.is_active and orders.production_status not in ('draft', 'cancelled')
      and ((delivery.status in ('scheduled', 'in_progress') and (delivery.status = 'in_progress' or delivery.scheduled_at < target_day_end_exclusive))
        or (delivery.status = 'completed' and delivery.completed_at >= target_day_start and delivery.completed_at < target_day_end_exclusive))
    union
    select 'handoff:' || handoff.id::text
    from public.order_customer_handoffs handoff
    where handoff.organization_id = target_organization_id and handoff.location_id is null
      and handoff.completed_at >= target_day_start and handoff.completed_at < target_day_end_exclusive
  ) facts
),
non_session_non_cash as (
  select count(*)::integer as count
  from period_payments payment
  where payment.method <> 'cash'
    and payment.status in ('confirmed', 'refunded')
    and payment.pos_session_id is null
),
warning_rows as (
  select 'unpaid_or_partially_paid_orders'::text as code,
    (select count(*)::integer from sales_balances where outstanding > 0) as count
  union all select 'overdue_logistics', (select count(*)::integer from due_logistics where status = 'scheduled' and scheduled_at < least(now(), target_day_end_exclusive))
  union all select 'open_production', (select count(*)::integer from open_orders)
  union all select 'on_hold_production', (select count(*)::integer from open_orders where production_status = 'on_hold')
  union all select 'cash_variance', (select count(*)::integer from period_sessions where coalesce(difference, 0) <> 0)
  union all select 'non_session_non_cash_activity', (select count from non_session_non_cash)
  union all select 'null_location_organization_wide', case when target_location_id is null then (select count from null_location_facts) else 0 end
  union all select 'historical_late_close', case when target_business_date < (now() at time zone target_timezone)::date then 1 else 0 end
),
blocker_rows as (
  select 'open_pos_session'::text as code, (select count from open_session_blocker) as count
  union all select 'cash_without_valid_session', (select count from cash_without_session_blocker)
  union all select 'location_mismatch', (select count from location_mismatch_blocker)
  union all select 'null_location_in_location_close', case when target_location_id is not null then (select count from null_location_facts) else 0 end
),
warnings as (
  select coalesce(jsonb_agg(jsonb_build_object('code', code, 'count', count) order by code) filter (where count > 0), '[]'::jsonb) as value
  from warning_rows
),
blockers as (
  select coalesce(jsonb_agg(jsonb_build_object('code', code, 'count', count) order by code) filter (where count > 0), '[]'::jsonb) as value
  from blocker_rows
),
accounting_json as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'currency', currency,
    'orderCount', order_count,
    'salesGross', sales_gross,
    'salesNet', sales_net,
    'discountTotal', sales_gross - sales_net,
    'outstanding', outstanding,
    'outstandingOrderCount', outstanding_order_count,
    'outstandingOrderIds', outstanding_order_ids,
    'confirmedPaymentCount', confirmed_payment_count,
    'paymentIds', payment_ids,
    'refundCount', refund_count,
    'refundIds', refund_ids,
    'collectedGross', collected_gross,
    'refunds', refunds,
    'collectedNet', collected_gross - refunds,
    'cashCollected', cash_collected,
    'cardCollected', card_collected,
    'bankTransferCollected', bank_transfer_collected,
    'otherCollected', other_collected,
    'onlineCollected', online_collected
  ) order by currency), '[]'::jsonb) as value
  from accounting_by_currency
),
pos_json as (
  select jsonb_build_object(
    'sessionCount', count(*),
    'openSessions', count(*) filter (where session.status = 'open'),
    'closedSessions', count(*) filter (where session.status = 'closed'),
    'sessionIds', coalesce(jsonb_agg(session.id order by session.id), '[]'::jsonb),
    'currency', target_default_currency,
    'openingCash', coalesce(sum(session.opening_cash), 0),
    'expectedCash', coalesce(sum(coalesce(session.expected_cash, session.opening_cash + cash.cash_in - cash.cash_out)), 0),
    'countedCash', coalesce(sum(coalesce(session.counted_cash, 0)), 0),
    'variance', coalesce(sum(coalesce(session.difference, 0)), 0),
    'cashPaymentsWithoutValidSession', (select count from cash_without_session_blocker)
  ) as value
  from period_sessions session
  join session_cash cash on cash.id = session.id
),
logistics_json as (
  select jsonb_build_object(
    'pickupsDueOpen', (select count(*) from due_logistics where kind = 'pickup'),
    'deliveriesDueOpen', (select count(*) from due_logistics where kind = 'delivery'),
    'inProgress', (select count(*) from due_logistics where status = 'in_progress'),
    'overduePickups', (select count(*) from due_logistics where kind = 'pickup' and status = 'scheduled' and scheduled_at < least(now(), target_day_end_exclusive)),
    'overdueDeliveries', (select count(*) from due_logistics where kind = 'delivery' and status = 'scheduled' and scheduled_at < least(now(), target_day_end_exclusive)),
    'completedPickupIds', coalesce((select jsonb_agg(id order by id) from completed_logistics where kind = 'pickup'), '[]'::jsonb),
    'completedDeliveryIds', coalesce((select jsonb_agg(id order by id) from completed_logistics where kind = 'delivery'), '[]'::jsonb)
  ) as value
),
final_json as (
  select jsonb_build_object(
    'completedOrderCount', count(distinct order_id),
    'deliveryIds', coalesce(jsonb_agg(fact_id order by fact_id) filter (where kind = 'delivery'), '[]'::jsonb),
    'customerHandoffIds', coalesce(jsonb_agg(fact_id order by fact_id) filter (where kind = 'customer_handoff'), '[]'::jsonb)
  ) as value
  from final_fulfillment
)
select jsonb_build_object(
  'schemaVersion', 1,
  'calculationVersion', 'pos-daily-close-p2a-v1',
  'scope', jsonb_build_object('organizationId', target_organization_id, 'locationId', target_location_id),
  'businessDay', jsonb_build_object(
    'date', target_business_date,
    'timezone', target_timezone,
    'start', target_day_start,
    'endExclusive', target_day_end_exclusive
  ),
  'orders', jsonb_build_object(
    'createdIds', order_events.created_ids,
    'created', jsonb_array_length(order_events.created_ids),
    'productionCompletedIds', order_events.production_completed_ids,
    'productionCompleted', jsonb_array_length(order_events.production_completed_ids),
    'cancelledIds', order_events.cancelled_ids,
    'cancelled', jsonb_array_length(order_events.cancelled_ids),
    'currentlyOpenIds', coalesce((select jsonb_agg(id order by id) from open_orders), '[]'::jsonb),
    'currentlyOpen', (select count(*) from open_orders),
    'currentlyOnHold', (select count(*) from open_orders where production_status = 'on_hold'),
    'currentlyLate', (select count(*) from open_orders where due_at is not null and due_at < least(now(), target_day_end_exclusive))
  ),
  'payments', accounting_json.value,
  'pos', pos_json.value,
  'logistics', logistics_json.value,
  'finalFulfillment', final_json.value,
  'warnings', warnings.value,
  'blockers', blockers.value,
  'historicalSemantics', jsonb_build_object(
    'selectedDateFacts', jsonb_build_array('orders.operational_business_date ?? orders.created_at', 'orders.completed_at', 'orders.cancelled_at', 'payments.paid_at', 'pos_sessions.opened_at', 'logistics.completed_at', 'order_customer_handoffs.completed_at'),
    'currentLinkedState', jsonb_build_array('open production', 'on-hold production', 'open logistics', 'open POS sessions'),
    'isHistoricalLateClose', target_business_date < (now() at time zone target_timezone)::date,
    'asOfStateReconstructed', false
  )
)
from order_events, accounting_json, pos_json, logistics_json, final_json, warnings, blockers;
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

revoke all on function public.calculate_daily_close_snapshot(
  uuid,
  date,
  uuid,
  text,
  timestamptz,
  timestamptz,
  text
) from public, anon, authenticated;
