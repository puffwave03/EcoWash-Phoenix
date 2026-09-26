-- WAREHOUSE-001B-2: exit storage only within canonical final fulfillment RPCs.
-- CREATE OR REPLACE retains the existing function signatures, owners and grants.

create or replace function public.complete_customer_handoff(
  target_order_id uuid,
  target_confirm_unpaid boolean,
  target_notes text
)
returns public.order_customer_handoffs
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  org_id uuid := public.app_current_organization_id();
  target_order public.orders%rowtype;
  canonical_handoff public.order_customer_handoffs%rowtype;
  current_balance numeric(12,2);
begin
  if actor_id is null then
    raise exception 'customer_handoff_not_authorized' using errcode = '42501';
  end if;

  perform public.require_pos_access(org_id);

  select * into target_order
  from public.orders orders
  where orders.id = target_order_id
    and orders.organization_id = org_id
  for update;

  if target_order.id is null or not target_order.is_active or target_order.production_status = 'cancelled' then
    raise exception 'customer_handoff_invalid_order' using errcode = '22023';
  end if;

  if target_order.production_status <> 'completed' then
    raise exception 'customer_handoff_production_incomplete' using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.deliveries delivery
    where delivery.organization_id = org_id
      and delivery.order_id = target_order_id
      and delivery.status in ('scheduled', 'in_progress', 'completed')
  ) then
    raise exception 'customer_handoff_delivery_conflict' using errcode = '55000';
  end if;

  select * into canonical_handoff
  from public.order_customer_handoffs handoff
  where handoff.organization_id = org_id
    and handoff.order_id = target_order_id;

  if canonical_handoff.id is not null then
    return canonical_handoff;
  end if;

  select summary.balance_due
  into current_balance
  from public.get_order_payment_summary(target_order_id) summary;

  if current_balance > 0 and not coalesce(target_confirm_unpaid, false) then
    raise exception 'customer_handoff_unpaid_confirmation_required' using errcode = '55000';
  end if;

  perform set_config('app.customer_handoff_mutation', 'on', true);

  insert into public.order_customer_handoffs (
    organization_id,
    order_id,
    location_id,
    completed_at,
    completed_by,
    notes,
    balance_due_at_handoff,
    balance_currency,
    unpaid_balance_acknowledged
  )
  values (
    org_id,
    target_order_id,
    target_order.location_id,
    now(),
    actor_id,
    nullif(left(btrim(target_notes), 1000), ''),
    current_balance,
    target_order.currency,
    current_balance > 0
  )
  returning * into canonical_handoff;

  delete from public.order_storage
  where organization_id = org_id
    and order_id = target_order_id;

  return canonical_handoff;
end;
$$;

create or replace function public.transition_delivery_status(
  target_delivery_id uuid,
  target_status public.fulfillment_status,
  target_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  actor_role public.app_role;
  current_status public.fulfillment_status;
  current_assigned_to uuid;
  parent_order_id uuid;
  parent_is_active boolean;
  parent_production_status public.production_status;
  allowed boolean := false;
begin
  org_id := public.app_current_organization_id();

  select membership.role into actor_role
  from public.organization_memberships membership
  where membership.organization_id = org_id
    and membership.profile_id = auth.uid()
    and membership.is_active;

  select delivery.status,
         delivery.assigned_to,
         orders.id,
         orders.is_active,
         orders.production_status
  into current_status,
       current_assigned_to,
       parent_order_id,
       parent_is_active,
       parent_production_status
  from public.deliveries delivery
  join public.orders orders
    on orders.organization_id = delivery.organization_id
   and orders.id = delivery.order_id
  where delivery.id = target_delivery_id
    and delivery.organization_id = org_id
  for update of delivery, orders;

  if current_status is null
    or not public.has_operational_capability(org_id, 'delivery')
    or (actor_role = 'staff' and current_assigned_to is distinct from auth.uid()) then
    raise exception 'not authorized';
  end if;

  if target_status in ('in_progress', 'completed')
    and exists (
      select 1
      from public.order_customer_handoffs handoff
      where handoff.organization_id = org_id
        and handoff.order_id = parent_order_id
    ) then
    raise exception 'customer_handoff_already_completed' using errcode = '55000';
  end if;

  if target_status in ('in_progress', 'completed')
    and (not parent_is_active or parent_production_status in ('draft', 'cancelled')) then
    raise exception 'logistics parent not operational';
  end if;

  if current_status = 'scheduled' then
    allowed := target_status in ('in_progress', 'cancelled');
  elsif current_status = 'in_progress' then
    allowed := target_status in ('completed', 'cancelled');
  end if;

  if not allowed then
    raise exception 'transition not allowed';
  end if;

  if target_status = 'cancelled' and nullif(btrim(target_reason), '') is null then
    raise exception 'reason required';
  end if;

  perform set_config('app.app_007_mutation', 'on', true);

  update public.deliveries
  set status = target_status,
      started_at = case when target_status = 'in_progress' and started_at is null then now() else started_at end,
      completed_at = case when target_status = 'completed' then now() else completed_at end,
      cancellation_reason = case when target_status = 'cancelled' then nullif(btrim(target_reason), '') else cancellation_reason end,
      updated_by = auth.uid()
  where id = target_delivery_id and organization_id = org_id;

  if target_status = 'completed' then
    delete from public.order_storage
    where organization_id = org_id
      and order_id = parent_order_id;
  end if;
end;
$$;
