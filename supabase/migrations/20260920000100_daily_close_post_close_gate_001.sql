-- DAILY-CLOSE-POST-CLOSE-GATE-001
-- Prevent new internal operational and financial facts from being written into
-- an already-closed tenant-local business date. Existing history is untouched.

create function public.assert_business_day_open(
  target_organization_id uuid,
  target_location_id uuid,
  target_occurred_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  organization_timezone text;
  target_business_date date;
begin
  select organization.timezone
  into organization_timezone
  from public.organizations organization
  where organization.id = target_organization_id;

  if organization_timezone is null then
    raise exception 'daily_close_organization_invalid' using errcode = '22023';
  end if;

  target_business_date := (coalesce(target_occurred_at, now()) at time zone organization_timezone)::date;

  -- Mutations take shared locks for the organization-wide scope and, when
  -- applicable, their location. close_daily_close takes the matching exclusive
  -- scope lock, so a close and a new fact cannot pass each other concurrently.
  perform pg_advisory_xact_lock_shared(hashtextextended(
    target_organization_id::text || ':daily-close-scope:' || target_business_date::text || ':organization',
    0
  ));

  if target_location_id is not null then
    perform pg_advisory_xact_lock_shared(hashtextextended(
      target_organization_id::text || ':daily-close-scope:' || target_business_date::text || ':' || target_location_id::text,
      0
    ));
  end if;

  if exists (
    select 1
    from public.daily_closes daily_close
    where daily_close.organization_id = target_organization_id
      and daily_close.business_date = target_business_date
      and (daily_close.location_id is null or daily_close.location_id = target_location_id)
  ) then
    raise exception 'daily_close_business_day_closed' using errcode = '55000';
  end if;
end;
$$;

revoke all on function public.assert_business_day_open(uuid, uuid, timestamptz)
from public, anon, authenticated;

create function public.enforce_internal_order_business_day_open()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Customer Portal intake is deliberately deferred to
  -- PORTAL-AFTER-CLOSE-INTAKE-001. Portal users are not organization members.
  if public.has_organization_role(
    new.organization_id,
    array['owner', 'manager', 'staff']::public.app_role[]
  ) and (
    tg_op = 'INSERT'
    or new.production_status is distinct from old.production_status
    or new.subtotal is distinct from old.subtotal
    or new.discount_amount is distinct from old.discount_amount
    or new.total is distinct from old.total
  ) then
    perform public.assert_business_day_open(
      new.organization_id,
      new.location_id,
      case when tg_op = 'INSERT' then new.created_at else now() end
    );
  end if;

  return new;
end;
$$;

create trigger daily_close_internal_orders_gate
before insert or update on public.orders
for each row execute function public.enforce_internal_order_business_day_open();

create function public.enforce_pos_session_business_day_open()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.assert_business_day_open(new.organization_id, new.location_id, new.opened_at);
  end if;
  return new;
end;
$$;

create trigger daily_close_pos_sessions_gate
before insert on public.pos_sessions
for each row execute function public.enforce_pos_session_business_day_open();

create function public.enforce_internal_payment_business_day_open()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  order_location_id uuid;
begin
  -- Hosted online settlement is an external provider boundary and is not an
  -- internal intake path. Internal order/POS payments and refunds are gated.
  if new.channel <> 'online' then
    select orders.location_id
    into order_location_id
    from public.orders orders
    where orders.organization_id = new.organization_id
      and orders.id = new.order_id;

    perform public.assert_business_day_open(
      new.organization_id,
      order_location_id,
      new.paid_at
    );
  end if;

  return new;
end;
$$;

create trigger daily_close_internal_payments_gate
before insert on public.payments
for each row execute function public.enforce_internal_payment_business_day_open();

create function public.enforce_internal_logistics_business_day_open()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  order_location_id uuid;
begin
  if public.has_organization_role(
    new.organization_id,
    array['owner', 'manager', 'staff']::public.app_role[]
  ) then
    select orders.location_id
    into order_location_id
    from public.orders orders
    where orders.organization_id = new.organization_id
      and orders.id = new.order_id;

    perform public.assert_business_day_open(new.organization_id, order_location_id, now());
  end if;

  return new;
end;
$$;

create trigger daily_close_pickups_gate
before insert or update on public.pickups
for each row execute function public.enforce_internal_logistics_business_day_open();

create trigger daily_close_deliveries_gate
before insert or update on public.deliveries
for each row execute function public.enforce_internal_logistics_business_day_open();

create function public.enforce_customer_handoff_business_day_open()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_business_day_open(
    new.organization_id,
    new.location_id,
    new.completed_at
  );
  return new;
end;
$$;

create trigger daily_close_customer_handoffs_gate
before insert on public.order_customer_handoffs
for each row execute function public.enforce_customer_handoff_business_day_open();

revoke all on function public.enforce_internal_order_business_day_open() from public, anon, authenticated;
revoke all on function public.enforce_pos_session_business_day_open() from public, anon, authenticated;
revoke all on function public.enforce_internal_payment_business_day_open() from public, anon, authenticated;
revoke all on function public.enforce_internal_logistics_business_day_open() from public, anon, authenticated;
revoke all on function public.enforce_customer_handoff_business_day_open() from public, anon, authenticated;
