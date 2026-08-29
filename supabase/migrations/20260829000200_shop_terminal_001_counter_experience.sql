-- SHOP-TERMINAL-001 adds a gated counter workflow over the canonical order and POS RPCs.
insert into public.platform_feature_catalog (feature_key, category, description)
values ('shop_terminal', 'commerce', 'Touch-first laundry counter order taking')
on conflict (feature_key) do nothing;

insert into public.organization_entitlements (organization_id, feature_key, enabled, source)
select organization.id, 'shop_terminal', true, 'shop_terminal_001_reference_bootstrap'
from public.organizations organization
where organization.slug = 'ecowash-la-tejita'
  and organization.deleted_at is null
on conflict (organization_id, feature_key) do nothing;

create table public.shop_terminal_submissions (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  idempotency_key uuid not null,
  request_fingerprint text not null,
  order_id uuid references public.orders(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (organization_id, idempotency_key),
  constraint shop_terminal_submissions_fingerprint_length check (char_length(request_fingerprint) = 32),
  constraint shop_terminal_submissions_order_same_org foreign key (organization_id, order_id)
    references public.orders(organization_id, id) on delete restrict
);

alter table public.shop_terminal_submissions enable row level security;
revoke all on public.shop_terminal_submissions from public, anon, authenticated;

create function public.require_shop_terminal_access(target_organization_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.require_pos_access(target_organization_id);
  if not public.organization_entitlement_is_enabled(target_organization_id, 'shop_terminal', now()) then
    raise exception 'shop_terminal_entitlement_required' using errcode = '42501';
  end if;
end;
$$;

create function public.list_shop_terminal_services(
  target_customer_id uuid,
  target_location_id uuid default null
)
returns table (
  id uuid,
  code text,
  name text,
  description text,
  unit_type public.service_unit_type,
  category text,
  amount numeric,
  currency text,
  price_is_from boolean,
  pricing_source text,
  pricing_segment_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid := public.app_current_organization_id();
  effective_date date;
begin
  perform public.require_shop_terminal_access(org_id);

  if not exists (
    select 1 from public.customers customer
    where customer.id = target_customer_id
      and customer.organization_id = org_id
      and customer.is_active
  ) then
    raise exception 'shop_terminal_customer_invalid' using errcode = '22023';
  end if;

  if target_location_id is not null and not exists (
    select 1 from public.locations location
    where location.id = target_location_id
      and location.organization_id = org_id
      and location.is_active
      and location.deleted_at is null
  ) then
    raise exception 'shop_terminal_location_invalid' using errcode = '22023';
  end if;

  select (now() at time zone organization.timezone)::date into effective_date
  from public.organizations organization
  where organization.id = org_id and organization.status = 'active' and organization.deleted_at is null;

  return query
  select service.id, service.code, service.name, service.description, service.unit_type,
    service.category, price.amount, price.currency, price.price_is_from,
    price.pricing_source, price.segment_name
  from public.services service
  join lateral public.resolve_effective_service_price(
    org_id, target_customer_id, service.id, target_location_id, effective_date
  ) price on true
  where service.organization_id = org_id
    and service.is_active
    and (service.location_id is null or service.location_id = target_location_id)
  order by service.sort_order, service.name, service.id;
end;
$$;

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
  target_payments jsonb
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
begin
  perform public.require_shop_terminal_access(org_id);

  if target_idempotency_key is null
    or jsonb_typeof(target_items) <> 'array'
    or jsonb_array_length(target_items) < 1
    or jsonb_array_length(target_items) > 100
    or jsonb_typeof(coalesce(target_payments, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(target_payments, '[]'::jsonb)) > 2
    or target_discount_amount is null
    or target_discount_amount < 0 then
    raise exception 'shop_terminal_submission_invalid' using errcode = '22023';
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
    'payments', coalesce(target_payments, '[]'::jsonb)
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

  for item in select value from jsonb_array_elements(target_items)
  loop
    if jsonb_typeof(item) <> 'object'
      or nullif(item->>'serviceId', '') is null
      or nullif(item->>'quantity', '') is null
      or (item->>'quantity')::numeric <= 0 then
      raise exception 'shop_terminal_item_invalid' using errcode = '22023';
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

revoke all on function public.require_shop_terminal_access(uuid) from public, anon, authenticated;
revoke all on function public.list_shop_terminal_services(uuid, uuid) from public, anon, authenticated;
revoke all on function public.submit_shop_terminal_order(uuid, uuid, uuid, timestamptz, text, text, jsonb, numeric, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.list_shop_terminal_services(uuid, uuid) to authenticated;
grant execute on function public.submit_shop_terminal_order(uuid, uuid, uuid, timestamptz, text, text, jsonb, numeric, uuid, jsonb) to authenticated;
