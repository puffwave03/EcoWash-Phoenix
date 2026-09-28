-- PRODUCTION-DEFAULT-ASSIGNEE-001: optional, explicit per-location fallback.
-- No existing location is assigned a default by this migration.
alter table public.locations
  add column default_production_assignee_id uuid references public.profiles(id) on delete set null;

-- Also protects the column from invalid direct writes through existing location RLS.
create function public.validate_location_default_production_assignee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.default_production_assignee_id is null then
    return new;
  end if;

  if not new.is_active or new.deleted_at is not null then
    raise exception 'default_production_location_invalid' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = new.organization_id
      and membership.profile_id = new.default_production_assignee_id
      and membership.is_active
      and membership.role = 'staff'
      and 'production'::public.operational_capability = any(membership.operational_capabilities)
  ) then
    raise exception 'default_production_assignee_invalid' using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger locations_validate_default_production_assignee
before insert or update of default_production_assignee_id, organization_id
on public.locations
for each row execute function public.validate_location_default_production_assignee();

revoke all on function public.validate_location_default_production_assignee() from public, anon, authenticated;

create function public.set_location_default_production_assignee(
  target_location_id uuid,
  target_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid := public.app_current_organization_id();
  valid_location_id uuid;
begin
  if auth.uid() is null
    or not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'default_production_not_authorized' using errcode = '42501';
  end if;

  select location.id into valid_location_id
  from public.locations location
  where location.organization_id = org_id
    and location.id = target_location_id
    and location.is_active
    and location.deleted_at is null
  for update;
  if valid_location_id is null then
    raise exception 'default_production_location_invalid' using errcode = '22023';
  end if;

  if target_profile_id is not null and not exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = org_id
      and membership.profile_id = target_profile_id
      and membership.is_active
      and membership.role = 'staff'
      and 'production'::public.operational_capability = any(membership.operational_capabilities)
  ) then
    raise exception 'default_production_assignee_invalid' using errcode = '22023';
  end if;

  update public.locations location
  set default_production_assignee_id = target_profile_id
  where location.organization_id = org_id and location.id = valid_location_id;
end;
$$;

revoke all on function public.set_location_default_production_assignee(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.set_location_default_production_assignee(uuid, uuid)
  to authenticated;

-- Replaces the latest deployed workflow body, retaining the item, pickup,
-- cancellation and READY/Warehouse guards. The order status and assignment
-- are written together after every validation succeeds.
create or replace function public.transition_order_status(
  target_order_id uuid,
  target_status public.production_status,
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
  current_status public.production_status;
  current_assigned_to uuid;
  order_location_id uuid;
  default_assignee_id uuid;
  previous_status public.production_status;
  required_capability public.operational_capability;
  reason_text text;
  allowed boolean := false;
begin
  org_id := public.app_current_organization_id();
  reason_text := nullif(btrim(target_reason), '');

  select membership.role into actor_role
  from public.organization_memberships membership
  where membership.organization_id = org_id
    and membership.profile_id = auth.uid()
    and membership.is_active;

  select production_status, assigned_to, location_id
  into current_status, current_assigned_to, order_location_id
  from public.orders
  where id = target_order_id
    and organization_id = org_id
    and is_active
  for update;

  if current_status is null then
    raise exception 'invalid order';
  end if;

  -- Resolve only on the first received -> washing transition. Lock the eligible
  -- membership so it cannot become stale before the order update commits.
  if current_status = 'received' and target_status = 'washing'
    and current_assigned_to is null then
    select location.default_production_assignee_id into default_assignee_id
    from public.locations location
    join public.organization_memberships assignee
      on assignee.organization_id = location.organization_id
     and assignee.profile_id = location.default_production_assignee_id
    where location.organization_id = org_id
      and location.id = order_location_id
      and location.is_active
      and location.deleted_at is null
      and assignee.is_active
      and assignee.role = 'staff'
      and 'production'::public.operational_capability = any(assignee.operational_capabilities)
    for share of location, assignee;
  end if;

  required_capability := case
    when current_status in ('quality_check', 'packing') then 'quality'::public.operational_capability
    else 'production'::public.operational_capability
  end;

  if not public.has_operational_capability(org_id, required_capability)
    or (actor_role = 'staff'
      and coalesce(current_assigned_to, default_assignee_id) is distinct from auth.uid()) then
    raise exception 'not authorized';
  end if;

  if current_status in ('completed', 'cancelled') then
    raise exception 'final status cannot transition';
  end if;

  if target_status in ('on_hold', 'cancelled') and reason_text is null then
    raise exception 'reason required';
  end if;

  if current_status = 'draft' then
    allowed := target_status in ('received', 'cancelled');
  elsif current_status = 'received' then
    allowed := target_status in ('washing', 'ironing', 'quality_check', 'on_hold', 'cancelled');
  elsif current_status = 'washing' then
    allowed := target_status in ('drying', 'quality_check', 'on_hold');
  elsif current_status = 'drying' then
    allowed := target_status in ('ironing', 'quality_check', 'packing', 'on_hold');
  elsif current_status = 'ironing' then
    allowed := target_status in ('quality_check', 'packing', 'on_hold');
  elsif current_status = 'quality_check' then
    allowed := target_status in ('packing', 'on_hold');
  elsif current_status = 'packing' then
    allowed := target_status in ('ready', 'on_hold');
  elsif current_status = 'ready' then
    allowed := target_status in ('completed', 'on_hold');
  elsif current_status = 'on_hold' then
    select history.to_status
    into previous_status
    from public.order_status_history history
    where history.order_id = target_order_id
      and history.organization_id = org_id
      and history.to_status not in ('on_hold', 'cancelled', 'completed')
    order by history.changed_at desc
    limit 1;

    allowed := target_status = previous_status or target_status = 'cancelled';
  end if;

  if not allowed then
    raise exception 'transition not allowed';
  end if;

  if target_status in ('washing', 'drying', 'ironing', 'quality_check', 'packing', 'ready', 'completed')
    and exists (
      select 1
      from public.pickups pickup
      where pickup.organization_id = org_id
        and pickup.order_id = target_order_id
        and pickup.status in ('scheduled', 'in_progress')
    ) then
    raise exception 'inbound_pickup_incomplete';
  end if;

  if target_status = 'ready'
    and current_setting('app.ready_storage_transition', true) is distinct from 'on' then
    raise exception 'ready_warehouse_confirmation_required' using errcode = '22023';
  end if;

  -- Quick Drop and inbound pickup receipt use their own canonical intake paths.
  -- This RPC handles manual receipt, including return from on_hold.
  if target_status = 'received'
    or target_status in ('washing', 'drying', 'ironing', 'quality_check', 'packing', 'ready', 'completed') then
    perform public.assert_order_has_active_items(org_id, target_order_id);
  end if;

  perform set_config('app.workflow_transition', 'on', true);

  update public.orders
  set production_status = target_status,
      assigned_to = case
        when current_status = 'received' and target_status = 'washing' and assigned_to is null
          then default_assignee_id
        else assigned_to
      end,
      received_at = case when target_status = 'received' and received_at is null then now() else received_at end,
      completed_at = case when target_status = 'completed' then now() else null end,
      cancelled_at = case when target_status = 'cancelled' then now() else null end,
      cancellation_reason = case when target_status = 'cancelled' then reason_text else cancellation_reason end,
      on_hold_reason = case when target_status = 'on_hold' then reason_text else null end,
      updated_by = auth.uid()
  where id = target_order_id
    and organization_id = org_id;

  if target_status = 'cancelled' then
    perform set_config('app.app_007_mutation', 'on', true);

    update public.pickups
    set status = 'cancelled',
        cancellation_reason = reason_text,
        updated_by = auth.uid()
    where organization_id = org_id
      and order_id = target_order_id
      and status in ('scheduled', 'in_progress');

    update public.deliveries
    set status = 'cancelled',
        cancellation_reason = reason_text,
        updated_by = auth.uid()
    where organization_id = org_id
      and order_id = target_order_id
      and status in ('scheduled', 'in_progress');
  end if;

  insert into public.order_status_history (
    organization_id,
    order_id,
    from_status,
    to_status,
    reason,
    changed_by
  )
  values (
    org_id,
    target_order_id,
    current_status,
    target_status,
    reason_text,
    auth.uid()
  );
end;
$$;




-- Preserve Terminal explicit assignment and all existing checkout semantics.
create or replace function public.submit_shop_terminal_order(
  target_idempotency_key uuid,
  target_customer_id uuid,
  target_location_id uuid,
  target_due_at timestamptz,
  target_customer_notes text,
  target_internal_notes text,
  target_items jsonb,
  target_discount_amount numeric,
  target_pos_session_id uuid,
  target_payments jsonb,
  target_walk_in_name text,
  target_walk_in_phone text,
  target_production_assignee_id uuid,
  target_delivery_requested boolean,
  target_delivery_scheduled_at timestamptz,
  target_delivery_assigned_to uuid,
  target_delivery_address_line1 text,
  target_delivery_address_line2 text,
  target_delivery_city text,
  target_delivery_postal_code text,
  target_delivery_country_code text,
  target_delivery_contact_name text,
  target_delivery_contact_phone text,
  target_delivery_notes text
)
returns table (
  order_id uuid,
  order_number text,
  subtotal numeric,
  discount_amount numeric,
  total numeric,
  paid numeric,
  outstanding numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid := public.app_current_organization_id();
  fingerprint text;
  existing_submission public.shop_terminal_submissions%rowtype;
  created_order record;
  target_order public.orders%rowtype;
  item jsonb;
  payment jsonb;
  payment_total numeric(12,2) := 0;
  paid_total numeric(12,2) := 0;
  member_role public.app_role;
  selected_customer_code text;
  active_location_count bigint := 0;
  production_assignee uuid;
  normalized_walk_in_name text := nullif(btrim(target_walk_in_name), '');
  normalized_walk_in_phone text := nullif(btrim(target_walk_in_phone), '');
begin
  perform public.require_shop_terminal_access(org_id);

  if target_idempotency_key is null
    or target_due_at is null
    or target_delivery_requested is null
    or jsonb_typeof(target_items) <> 'array'
    or jsonb_array_length(target_items) < 1
    or jsonb_array_length(target_items) > 100
    or jsonb_typeof(coalesce(target_payments, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(target_payments, '[]'::jsonb)) > 2
    or target_discount_amount is null
    or target_discount_amount < 0
    or char_length(coalesce(normalized_walk_in_name, '')) > 160
    or char_length(coalesce(normalized_walk_in_phone, '')) > 40
    or (target_delivery_requested and (
      target_delivery_scheduled_at is null
      or nullif(btrim(target_delivery_address_line1), '') is null
    )) then
    raise exception 'shop_terminal_submission_invalid' using errcode = '22023';
  end if;

  select customer.customer_code into selected_customer_code
  from public.customers customer
  where customer.organization_id = org_id
    and customer.id = target_customer_id
    and customer.is_active;

  if not found or (
    selected_customer_code is distinct from 'WALKIN-SHARED'
    and (normalized_walk_in_name is not null or normalized_walk_in_phone is not null)
  ) then
    raise exception 'shop_terminal_customer_invalid' using errcode = '22023';
  end if;

  select count(*) into active_location_count
  from public.locations location
  where location.organization_id = org_id
    and location.is_active
    and location.deleted_at is null;

  production_assignee := target_production_assignee_id;

  fingerprint := md5(jsonb_build_object(
    'customerId', target_customer_id,
    'locationId', target_location_id,
    'dueAt', target_due_at,
    'customerNotes', nullif(btrim(target_customer_notes), ''),
    'internalNotes', nullif(btrim(target_internal_notes), ''),
    'items', target_items,
    'discountAmount', round(target_discount_amount, 2),
    'sessionId', target_pos_session_id,
    'payments', coalesce(target_payments, '[]'::jsonb),
    'walkInName', normalized_walk_in_name,
    'walkInPhone', normalized_walk_in_phone,
    'productionAssigneeId', target_production_assignee_id,
    'deliveryRequested', target_delivery_requested,
    'deliveryScheduledAt', target_delivery_scheduled_at,
    'deliveryAssignedTo', target_delivery_assigned_to,
    'deliveryAddressLine1', nullif(btrim(target_delivery_address_line1), ''),
    'deliveryAddressLine2', nullif(btrim(target_delivery_address_line2), ''),
    'deliveryCity', nullif(btrim(target_delivery_city), ''),
    'deliveryPostalCode', nullif(btrim(target_delivery_postal_code), ''),
    'deliveryCountryCode', nullif(upper(btrim(target_delivery_country_code)), ''),
    'deliveryContactName', nullif(btrim(target_delivery_contact_name), ''),
    'deliveryContactPhone', nullif(btrim(target_delivery_contact_phone), ''),
    'deliveryNotes', nullif(btrim(target_delivery_notes), '')
  )::text);

  perform pg_advisory_xact_lock(hashtextextended(org_id::text || ':' || target_idempotency_key::text, 0));
  select * into existing_submission
  from public.shop_terminal_submissions submission
  where submission.organization_id = org_id and submission.idempotency_key = target_idempotency_key;

  if existing_submission.idempotency_key is not null then
    if existing_submission.request_fingerprint <> fingerprint or existing_submission.order_id is null then
      raise exception 'shop_terminal_idempotency_conflict' using errcode = '23505';
    end if;

    select * into target_order from public.orders orders
    where orders.id = existing_submission.order_id and orders.organization_id = org_id;
    select round(coalesce(sum(p.amount) filter (where p.status = 'confirmed'), 0)
      - coalesce(sum(p.amount) filter (where p.status = 'refunded'), 0), 2)
    into paid_total from public.payments p
    where p.organization_id = org_id and p.order_id = target_order.id;

    return query select target_order.id, target_order.order_number, target_order.subtotal,
      target_order.discount_amount, target_order.total, paid_total,
      round(greatest(target_order.total - paid_total, 0), 2);
    return;
  end if;

  if target_production_assignee_id is not null and (
    active_location_count <> 1 or not exists (
      select 1
      from public.organization_memberships membership
      where membership.organization_id = org_id
        and membership.profile_id = target_production_assignee_id
        and membership.is_active
        and membership.role = 'staff'
        and 'production' = any(membership.operational_capabilities::text[])
    )
  ) then
    raise exception 'shop_terminal_production_assignee_invalid' using errcode = '22023';
  end if;

  if target_delivery_requested and target_delivery_assigned_to is not null and not exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = org_id
      and membership.profile_id = target_delivery_assigned_to
      and membership.is_active
      and membership.role = 'staff'
      and 'delivery' = any(membership.operational_capabilities::text[])
  ) then
    raise exception 'shop_terminal_delivery_assignee_invalid' using errcode = '22023';
  end if;

  insert into public.shop_terminal_submissions (
    organization_id, idempotency_key, request_fingerprint, created_by
  ) values (org_id, target_idempotency_key, fingerprint, auth.uid());

  select membership.role into member_role
  from public.organization_memberships membership
  where membership.organization_id = org_id and membership.profile_id = auth.uid() and membership.is_active;

  if member_role = 'staff' and round(target_discount_amount, 2) > 0 then
    raise exception 'shop_terminal_staff_discount_denied' using errcode = '42501';
  end if;

  select created.id, created.order_number into created_order
  from public.create_order(
    target_customer_id, null, target_location_id, 'normal', target_due_at,
    target_customer_notes, target_internal_notes
  ) created;

  update public.orders orders
  set walk_in_name = normalized_walk_in_name,
      walk_in_phone = normalized_walk_in_phone,
      assigned_to = production_assignee,
      updated_by = auth.uid()
  where orders.organization_id = org_id and orders.id = created_order.id;

  for item in select value from jsonb_array_elements(target_items)
  loop
    if jsonb_typeof(item) <> 'object'
      or nullif(item->>'serviceId', '') is null
      or nullif(item->>'quantity', '') is null
      or (item->>'quantity')::numeric <= 0 then
      raise exception 'shop_terminal_item_invalid' using errcode = '22023';
    end if;

    if not public.shop_terminal_service_is_eligible(
      org_id,
      target_customer_id,
      (item->>'serviceId')::uuid,
      target_location_id
    ) then
      raise exception 'shop_terminal_service_not_eligible' using errcode = '42501';
    end if;

    perform public.save_order_item(
      null,
      created_order.id,
      (item->>'serviceId')::uuid,
      null,
      'piece'::public.service_unit_type,
      (item->>'quantity')::numeric,
      0,
      nullif(btrim(item->>'notes'), '')
    );
  end loop;

  if round(target_discount_amount, 2) > 0 then
    perform public.update_order_discount(created_order.id, round(target_discount_amount, 2));
  end if;

  if target_delivery_requested then
    perform public.create_or_update_delivery(
      created_order.id,
      null,
      target_delivery_scheduled_at,
      target_delivery_assigned_to,
      target_delivery_address_line1,
      target_delivery_address_line2,
      target_delivery_city,
      target_delivery_postal_code,
      target_delivery_country_code,
      target_delivery_contact_name,
      target_delivery_contact_phone,
      target_delivery_notes,
      0
    );
  end if;

  select * into target_order from public.orders orders
  where orders.id = created_order.id and orders.organization_id = org_id for update;

  for payment in select value from jsonb_array_elements(coalesce(target_payments, '[]'::jsonb))
  loop
    if jsonb_typeof(payment) <> 'object'
      or nullif(payment->>'amount', '') is null
      or (payment->>'amount')::numeric <= 0
      or payment->>'method' not in ('cash', 'card')
      or nullif(payment->>'idempotencyKey', '') is null then
      raise exception 'shop_terminal_payment_invalid' using errcode = '22023';
    end if;
    payment_total := round(payment_total + (payment->>'amount')::numeric, 2);
  end loop;

  if jsonb_array_length(coalesce(target_payments, '[]'::jsonb)) > 0 then
    if target_pos_session_id is null or payment_total <> target_order.total then
      raise exception 'shop_terminal_payment_total_mismatch' using errcode = '22023';
    end if;

    for payment in select value from jsonb_array_elements(target_payments)
    loop
      perform public.record_pos_payment(
        created_order.id,
        (payment->>'amount')::numeric,
        (payment->>'method')::public.payment_method,
        target_pos_session_id,
        nullif(btrim(payment->>'reference'), ''),
        'Shop terminal payment',
        (payment->>'idempotencyKey')::uuid,
        case when payment->>'method' = 'card' then 'manual' else null end,
        case when payment->>'method' = 'card' then nullif(btrim(payment->>'reference'), '') else null end,
        case when payment->>'method' = 'card' then 'recorded_manual' else null end
      );
    end loop;
  end if;

  select round(coalesce(sum(p.amount) filter (where p.status = 'confirmed'), 0)
    - coalesce(sum(p.amount) filter (where p.status = 'refunded'), 0), 2)
  into paid_total from public.payments p
  where p.organization_id = org_id and p.order_id = created_order.id;

  update public.shop_terminal_submissions submission
  set order_id = created_order.id
  where submission.organization_id = org_id and submission.idempotency_key = target_idempotency_key;

  return query select target_order.id, target_order.order_number, target_order.subtotal,
    target_order.discount_amount, target_order.total, paid_total,
    round(greatest(target_order.total - paid_total, 0), 2);
end;
$$;

