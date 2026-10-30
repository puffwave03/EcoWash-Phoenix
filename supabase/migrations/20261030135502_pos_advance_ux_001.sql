-- POS-ADVANCE-UX-001 / POS-MIXED-PAYMENT-INPUT-001
-- Allow partial counter collections through canonical POS, preserving atomic intake and replay.
-- CREATE OR REPLACE retains the signature, owner and EXECUTE ACL.

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

  -- Only this invocation's newly created draft represents physical counter
  -- intake. Existing submissions returned above must retain their original state.
  if target_order.id is null
    or not target_order.is_active
    or target_order.production_status <> 'draft'
    or target_order.created_by is distinct from auth.uid()
    or target_order.created_at is distinct from transaction_timestamp()
    or target_order.received_at is not null then
    raise exception 'shop_terminal_receipt_invalid_order' using errcode = '22023';
  end if;

  perform public.assert_order_has_active_items(org_id, created_order.id);

  -- Preserve the canonical inbound pickup gate, including for internal intake.
  if exists (
    select 1 from public.pickups pickup
    where pickup.organization_id = org_id
      and pickup.order_id = created_order.id
      and pickup.status in ('scheduled', 'in_progress')
  ) then
    raise exception 'inbound_pickup_incomplete';
  end if;

  -- Dedicated intake, as in Quick Drop: POS authorization was checked above.
  -- This does not grant the caller production/assignment transition privileges.
  -- The existing UPDATE trigger creates inbound custody or aborts this transaction.
  perform set_config('app.workflow_transition', 'on', true);
  update public.orders orders
  set production_status = 'received',
      received_at = now(),
      updated_by = auth.uid()
  where orders.organization_id = org_id
    and orders.id = created_order.id
    and orders.production_status = 'draft'
  returning orders.* into target_order;

  if target_order.id is null then
    raise exception 'shop_terminal_receipt_invalid_order' using errcode = '22023';
  end if;

  insert into public.order_status_history (
    organization_id, order_id, from_status, to_status, reason, changed_by, metadata
  ) values (
    org_id, created_order.id, 'draft', 'received', null, auth.uid(),
    jsonb_build_object('source', 'shop_terminal')
  );

  for payment in select value from jsonb_array_elements(coalesce(target_payments, '[]'::jsonb))
  loop
    if jsonb_typeof(payment) <> 'object'
      or coalesce(payment->>'amount', '') !~ '^[0-9]+([.][0-9]+)?$'
      or round((payment->>'amount')::numeric, 2) <= 0
      or coalesce(payment->>'method', '') not in ('cash', 'card')
      or nullif(payment->>'idempotencyKey', '') is null then
      raise exception 'shop_terminal_payment_invalid' using errcode = '22023';
    end if;
    payment_total := payment_total + round((payment->>'amount')::numeric, 2);
  end loop;

  if jsonb_array_length(coalesce(target_payments, '[]'::jsonb)) > 0 then
    -- Each requested payment must have its own identity. A repeated key must
    -- not silently turn two requested installments into one ledger entry.
    if (select count(distinct (value->>'idempotencyKey')::uuid)
        from jsonb_array_elements(target_payments)) <> jsonb_array_length(target_payments) then
      raise exception 'shop_terminal_payment_invalid' using errcode = '22023';
    end if;
    if target_pos_session_id is null or payment_total <= 0 or payment_total > target_order.total then
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
