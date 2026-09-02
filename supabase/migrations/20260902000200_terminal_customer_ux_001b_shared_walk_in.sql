-- TERMINAL-CUSTOMER-UX-001B adds one tenant-scoped technical walk-in anchor and order-local visitor snapshots.
alter table public.orders
  add column walk_in_name text,
  add column walk_in_phone text,
  add constraint orders_walk_in_name_valid check (
    walk_in_name is null or (
      walk_in_name = btrim(walk_in_name)
      and char_length(walk_in_name) between 1 and 160
    )
  ),
  add constraint orders_walk_in_phone_valid check (
    walk_in_phone is null or (
      walk_in_phone = btrim(walk_in_phone)
      and char_length(walk_in_phone) between 1 and 40
    )
  );

create function public.protect_shared_walk_in_customer()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
    and old.customer_code = 'WALKIN-SHARED'
    and new.customer_code is distinct from old.customer_code then
    raise exception 'shared_walk_in_identity_immutable' using errcode = '22023';
  end if;

  if new.customer_code = 'WALKIN-SHARED' and (
    new.customer_type <> 'individual'
    or not new.is_active
    or new.catalog_segment_id is not null
    or new.first_name is not null
    or new.last_name is not null
    or new.company_name is not null
    or new.tax_id is not null
    or new.email is not null
    or new.phone is not null
    or new.alternate_phone is not null
    or new.billing_address_line1 is not null
    or new.billing_address_line2 is not null
    or new.billing_city is not null
    or new.billing_postal_code is not null
    or new.billing_country_code is not null
  ) then
    raise exception 'shared_walk_in_customer_fields_denied' using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger customers_protect_shared_walk_in
before insert or update on public.customers
for each row execute function public.protect_shared_walk_in_customer();

create function public.enforce_order_walk_in_snapshot()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  resolved_customer_code text;
begin
  select customer.customer_code into resolved_customer_code
  from public.customers customer
  where customer.organization_id = new.organization_id
    and customer.id = new.customer_id;

  if resolved_customer_code is distinct from 'WALKIN-SHARED'
    and (new.walk_in_name is not null or new.walk_in_phone is not null) then
    raise exception 'order_walk_in_snapshot_customer_invalid' using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger orders_enforce_walk_in_snapshot
before insert or update of customer_id, walk_in_name, walk_in_phone on public.orders
for each row execute function public.enforce_order_walk_in_snapshot();

create function public.resolve_shared_walk_in_customer()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid := public.app_current_organization_id();
  shared_customer public.customers%rowtype;
begin
  perform public.require_shop_terminal_access(org_id);
  perform pg_advisory_xact_lock(hashtextextended(org_id::text || ':WALKIN-SHARED', 0));

  insert into public.customers (
    organization_id, customer_code, customer_type, display_name,
    first_name, last_name, company_name, tax_id, email, phone, alternate_phone,
    billing_address_line1, billing_address_line2, billing_city, billing_postal_code,
    billing_country_code, catalog_segment_id, is_active, created_by, updated_by
  ) values (
    org_id, 'WALKIN-SHARED', 'individual', 'Walk-in customer',
    null, null, null, null, null, null, null,
    null, null, null, null,
    null, null, true, auth.uid(), auth.uid()
  )
  on conflict (organization_id, customer_code) where customer_code is not null do nothing;

  select customer.* into shared_customer
  from public.customers customer
  where customer.organization_id = org_id
    and customer.customer_code = 'WALKIN-SHARED'
  for update;

  if shared_customer.id is null
    or shared_customer.customer_type <> 'individual'
    or not shared_customer.is_active
    or shared_customer.catalog_segment_id is not null
    or shared_customer.tax_id is not null
    or shared_customer.email is not null
    or shared_customer.phone is not null
    or shared_customer.billing_address_line1 is not null
    or shared_customer.billing_city is not null
    or shared_customer.billing_postal_code is not null
    or shared_customer.billing_country_code is not null then
    raise exception 'shared_walk_in_customer_invalid' using errcode = '22023';
  end if;

  return shared_customer.id;
end;
$$;

revoke all on function public.resolve_shared_walk_in_customer() from public, anon, authenticated;
grant execute on function public.resolve_shared_walk_in_customer() to authenticated;

create function public.prevent_shared_walk_in_invoice()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1 from public.customers customer
    where customer.organization_id = new.organization_id
      and customer.id = new.customer_id
      and customer.customer_code = 'WALKIN-SHARED'
  ) then
    raise exception 'billing_registered_customer_required' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger invoices_prevent_shared_walk_in
before insert or update of customer_id on public.invoices
for each row execute function public.prevent_shared_walk_in_invoice();

drop function public.submit_shop_terminal_order(uuid, uuid, uuid, timestamptz, text, text, jsonb, numeric, uuid, jsonb);

create function public.submit_shop_terminal_order(
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
  target_walk_in_phone text
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
  normalized_walk_in_name text := nullif(btrim(target_walk_in_name), '');
  normalized_walk_in_phone text := nullif(btrim(target_walk_in_phone), '');
begin
  perform public.require_shop_terminal_access(org_id);

  if target_idempotency_key is null
    or jsonb_typeof(target_items) <> 'array'
    or jsonb_array_length(target_items) < 1
    or jsonb_array_length(target_items) > 100
    or jsonb_typeof(coalesce(target_payments, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(target_payments, '[]'::jsonb)) > 2
    or target_discount_amount is null
    or target_discount_amount < 0
    or char_length(coalesce(normalized_walk_in_name, '')) > 160
    or char_length(coalesce(normalized_walk_in_phone, '')) > 40 then
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
    'walkInPhone', normalized_walk_in_phone
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

revoke all on function public.submit_shop_terminal_order(uuid, uuid, uuid, timestamptz, text, text, jsonb, numeric, uuid, jsonb, text, text)
from public, anon, authenticated;
grant execute on function public.submit_shop_terminal_order(uuid, uuid, uuid, timestamptz, text, text, jsonb, numeric, uuid, jsonb, text, text)
to authenticated;

drop function public.create_quick_drop_order(uuid, uuid, uuid, timestamptz, text);

create function public.create_quick_drop_order(
  target_idempotency_key uuid,
  target_customer_id uuid,
  target_location_id uuid,
  target_due_at timestamptz,
  target_note text,
  target_walk_in_name text,
  target_walk_in_phone text
)
returns table (order_id uuid, order_number text, received_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid := public.app_current_organization_id();
  fingerprint text;
  existing_submission public.shop_terminal_submissions%rowtype;
  created_order record;
  received_order public.orders%rowtype;
  selected_customer_code text;
  normalized_walk_in_name text := nullif(btrim(target_walk_in_name), '');
  normalized_walk_in_phone text := nullif(btrim(target_walk_in_phone), '');
begin
  perform public.require_shop_terminal_access(org_id);

  if target_idempotency_key is null
    or target_customer_id is null
    or target_location_id is null
    or char_length(coalesce(target_note, '')) > 600
    or char_length(coalesce(normalized_walk_in_name, '')) > 160
    or char_length(coalesce(normalized_walk_in_phone, '')) > 40 then
    raise exception 'quick_drop_submission_invalid' using errcode = '22023';
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
    raise exception 'quick_drop_customer_invalid' using errcode = '22023';
  end if;

  fingerprint := md5(jsonb_build_object(
    'kind', 'quick_drop',
    'customerId', target_customer_id,
    'locationId', target_location_id,
    'dueAt', target_due_at,
    'note', nullif(btrim(target_note), ''),
    'walkInName', normalized_walk_in_name,
    'walkInPhone', normalized_walk_in_phone
  )::text);

  perform pg_advisory_xact_lock(hashtextextended(org_id::text || ':' || target_idempotency_key::text, 0));
  select * into existing_submission
  from public.shop_terminal_submissions submission
  where submission.organization_id = org_id
    and submission.idempotency_key = target_idempotency_key;

  if existing_submission.idempotency_key is not null then
    if existing_submission.request_fingerprint <> fingerprint or existing_submission.order_id is null then
      raise exception 'quick_drop_idempotency_conflict' using errcode = '23505';
    end if;

    return query
    select orders.id, orders.order_number, orders.received_at
    from public.orders orders
    where orders.organization_id = org_id
      and orders.id = existing_submission.order_id;
    return;
  end if;

  insert into public.shop_terminal_submissions (
    organization_id, idempotency_key, request_fingerprint, created_by
  ) values (
    org_id, target_idempotency_key, fingerprint, auth.uid()
  );

  select created.id, created.order_number into created_order
  from public.create_order(
    target_customer_id,
    null,
    target_location_id,
    'normal',
    target_due_at,
    null,
    nullif(btrim(target_note), '')
  ) created;

  perform set_config('app.workflow_transition', 'on', true);
  update public.orders orders
  set production_status = 'received',
      received_at = now(),
      walk_in_name = normalized_walk_in_name,
      walk_in_phone = normalized_walk_in_phone,
      updated_by = auth.uid()
  where orders.organization_id = org_id
    and orders.id = created_order.id
    and orders.production_status = 'draft'
  returning orders.* into received_order;

  if received_order.id is null then
    raise exception 'quick_drop_transition_failed' using errcode = 'P0001';
  end if;

  insert into public.order_status_history (
    organization_id, order_id, from_status, to_status, reason, changed_by, metadata
  ) values (
    org_id,
    received_order.id,
    'draft',
    'received',
    null,
    auth.uid(),
    jsonb_build_object('source', 'quick_drop')
  );

  update public.shop_terminal_submissions submission
  set order_id = received_order.id
  where submission.organization_id = org_id
    and submission.idempotency_key = target_idempotency_key;

  return query select received_order.id, received_order.order_number, received_order.received_at;
end;
$$;

revoke all on function public.create_quick_drop_order(uuid, uuid, uuid, timestamptz, text, text, text)
from public, anon, authenticated;
grant execute on function public.create_quick_drop_order(uuid, uuid, uuid, timestamptz, text, text, text)
to authenticated;
