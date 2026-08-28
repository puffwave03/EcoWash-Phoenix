-- POS-001 extends the canonical payments ledger. It never rewrites historical payments.
alter type public.operational_capability add value if not exists 'pos';

create type public.pos_session_status as enum ('open', 'closed');

create table public.pos_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  location_id uuid references public.locations(id) on delete restrict,
  opened_by uuid not null references public.profiles(id) on delete restrict,
  opened_at timestamptz not null default now(),
  opening_cash numeric(12,2) not null,
  status public.pos_session_status not null default 'open',
  closed_by uuid references public.profiles(id) on delete restrict,
  closed_at timestamptz,
  expected_cash numeric(12,2),
  counted_cash numeric(12,2),
  difference numeric(12,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pos_sessions_org_id_unique unique (organization_id, id),
  constraint pos_sessions_location_same_org foreign key (organization_id, location_id)
    references public.locations(organization_id, id) on delete restrict,
  constraint pos_sessions_opening_cash_non_negative check (opening_cash >= 0),
  constraint pos_sessions_counted_cash_non_negative check (counted_cash is null or counted_cash >= 0),
  constraint pos_sessions_notes_limit check (notes is null or char_length(notes) <= 600),
  constraint pos_sessions_closure_consistent check (
    (status = 'open' and closed_by is null and closed_at is null and expected_cash is null and counted_cash is null and difference is null)
    or
    (status = 'closed' and closed_by is not null and closed_at is not null and expected_cash is not null and counted_cash is not null and difference is not null)
  )
);

create unique index pos_sessions_one_open_till_idx
on public.pos_sessions (organization_id)
where status = 'open';

create index pos_sessions_history_idx
on public.pos_sessions (organization_id, opened_at desc);

alter table public.payments
  add column pos_session_id uuid,
  add column channel text not null default 'order',
  add column provider text,
  add column provider_reference text,
  add column external_status text,
  add column idempotency_key uuid,
  add constraint payments_pos_session_same_org foreign key (organization_id, pos_session_id)
    references public.pos_sessions(organization_id, id) on delete restrict,
  add constraint payments_channel_check check (channel in ('order', 'pos')),
  add constraint payments_provider_limit check (provider is null or char_length(provider) <= 64),
  add constraint payments_provider_reference_limit check (provider_reference is null or char_length(provider_reference) <= 180),
  add constraint payments_external_status_limit check (external_status is null or char_length(external_status) <= 64);

create unique index payments_pos_idempotency_idx
on public.payments (organization_id, idempotency_key)
where idempotency_key is not null;

create index payments_pos_session_idx
on public.payments (organization_id, pos_session_id, created_at)
where pos_session_id is not null;

insert into public.organization_entitlements (organization_id, feature_key, enabled, source)
select organization.id, 'pos', true, 'pos_001_reference_bootstrap'
from public.organizations organization
where organization.slug = 'ecowash-la-tejita'
  and organization.deleted_at is null
on conflict (organization_id, feature_key) do nothing;

create trigger pos_sessions_set_updated_at
before update on public.pos_sessions
for each row execute function public.set_updated_at();

create function public.prevent_pos_direct_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('app.pos_001_mutation', true) <> 'on' then
    raise exception 'pos_mutation_requires_rpc' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    raise exception 'pos_hard_delete_not_allowed' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.organization_id <> old.organization_id then
    raise exception 'pos_organization_immutable' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger pos_sessions_controlled_mutation
before insert or update or delete on public.pos_sessions
for each row execute function public.prevent_pos_direct_mutation();

create function public.has_pos_capability(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = target_organization_id
      and membership.profile_id = auth.uid()
      and membership.is_active
      and (
        membership.role in ('owner', 'manager')
        or (
          membership.role = 'staff'
          and 'pos' = any(membership.operational_capabilities::text[])
        )
      )
  );
$$;

create function public.require_pos_access(target_organization_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if target_organization_id is null
    or target_organization_id <> public.app_current_organization_id()
    or not public.has_pos_capability(target_organization_id) then
    raise exception 'pos_not_authorized' using errcode = '42501';
  end if;
  if not public.organization_entitlement_is_enabled(target_organization_id, 'pos', now()) then
    raise exception 'pos_entitlement_required' using errcode = '42501';
  end if;
end;
$$;

create function public.open_pos_session(
  target_location_id uuid,
  target_opening_cash numeric,
  target_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid := public.app_current_organization_id();
  result_id uuid;
begin
  perform public.require_pos_access(org_id);
  if target_opening_cash is null or target_opening_cash < 0 then
    raise exception 'pos_opening_cash_invalid' using errcode = '22023';
  end if;
  if target_location_id is not null and not exists (
    select 1 from public.locations location
    where location.id = target_location_id and location.organization_id = org_id
      and location.is_active and location.deleted_at is null
  ) then
    raise exception 'pos_location_invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(org_id::text || ':pos-current-till', 0));
  if exists (
    select 1 from public.pos_sessions session
    where session.organization_id = org_id and session.status = 'open'
  ) then
    raise exception 'pos_session_already_open' using errcode = '23505';
  end if;

  perform set_config('app.pos_001_mutation', 'on', true);
  insert into public.pos_sessions (organization_id, location_id, opened_by, opening_cash, notes)
  values (org_id, target_location_id, auth.uid(), round(target_opening_cash, 2), nullif(btrim(target_notes), ''))
  returning id into result_id;
  return result_id;
end;
$$;

create function public.record_pos_payment(
  target_order_id uuid,
  target_amount numeric,
  target_method public.payment_method,
  target_pos_session_id uuid,
  target_reference text,
  target_notes text,
  target_idempotency_key uuid,
  target_provider text default null,
  target_provider_reference text default null,
  target_external_status text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid := public.app_current_organization_id();
  target_order public.orders%rowtype;
  target_session public.pos_sessions%rowtype;
  paid_total numeric(12,2);
  existing_payment public.payments%rowtype;
  result_id uuid;
  normalized_amount numeric(12,2) := round(target_amount, 2);
begin
  perform public.require_pos_access(org_id);
  if target_idempotency_key is null or target_amount is null or normalized_amount <= 0 or target_method is null then
    raise exception 'pos_payment_invalid' using errcode = '22023';
  end if;
  if target_provider is not null and btrim(target_provider) <> 'manual' then
    raise exception 'pos_provider_not_supported' using errcode = '22023';
  end if;
  if target_external_status is not null and btrim(target_external_status) <> 'recorded_manual' then
    raise exception 'pos_external_status_not_supported' using errcode = '22023';
  end if;

  if target_pos_session_id is not null then
    select * into target_session from public.pos_sessions session
    where session.id = target_pos_session_id and session.organization_id = org_id
    for update;
    if target_session.id is null or target_session.status <> 'open' then
      raise exception 'pos_session_not_open' using errcode = '55000';
    end if;
    if not public.has_organization_role(org_id, array['owner','manager']::public.app_role[])
      and target_session.opened_by <> auth.uid() then
      raise exception 'pos_session_not_assigned' using errcode = '42501';
    end if;
  end if;

  select * into target_order from public.orders orders
  where orders.id = target_order_id and orders.organization_id = org_id
  for update;
  if target_order.id is null or not target_order.is_active or target_order.production_status = 'cancelled' then
    raise exception 'pos_order_invalid' using errcode = '22023';
  end if;
  if target_session.id is not null and target_session.location_id is not null
    and target_order.location_id is not null
    and target_order.location_id <> target_session.location_id then
    raise exception 'pos_location_mismatch' using errcode = '42501';
  end if;
  if target_method = 'cash' and target_session.id is null then
    raise exception 'pos_cash_requires_open_session' using errcode = '55000';
  end if;

  select * into existing_payment from public.payments payment
  where payment.organization_id = org_id and payment.idempotency_key = target_idempotency_key;
  if existing_payment.id is not null then
    if existing_payment.order_id <> target_order_id
      or existing_payment.amount <> normalized_amount
      or existing_payment.method <> target_method
      or existing_payment.status <> 'confirmed'
      or existing_payment.pos_session_id is distinct from target_pos_session_id then
      raise exception 'pos_idempotency_conflict' using errcode = '23505';
    end if;
    return existing_payment.id;
  end if;

  select coalesce(sum(payment.amount) filter (where payment.status = 'confirmed'), 0)
       - coalesce(sum(payment.amount) filter (where payment.status = 'refunded'), 0)
  into paid_total
  from public.payments payment
  where payment.organization_id = org_id and payment.order_id = target_order_id;
  if normalized_amount > round(target_order.total - paid_total, 2) then
    raise exception 'pos_payment_exceeds_outstanding' using errcode = '22023';
  end if;

  perform set_config('app.app_007_mutation', 'on', true);
  insert into public.payments (
    organization_id, order_id, amount, method, status, paid_at, reference, notes,
    recorded_by, confirmed_by, pos_session_id, channel, provider, provider_reference,
    external_status, idempotency_key
  ) values (
    org_id, target_order_id, normalized_amount, target_method, 'confirmed', now(),
    nullif(btrim(target_reference), ''), nullif(btrim(target_notes), ''), auth.uid(), auth.uid(),
    target_pos_session_id, 'pos',
    case when target_method = 'card' then coalesce(nullif(btrim(target_provider), ''), 'manual') else null end,
    nullif(btrim(target_provider_reference), ''),
    case when target_method = 'card' then coalesce(nullif(btrim(target_external_status), ''), 'recorded_manual') else null end,
    target_idempotency_key
  ) returning id into result_id;
  return result_id;
end;
$$;

create function public.record_pos_refund(
  target_payment_id uuid,
  target_amount numeric,
  target_reason text,
  target_pos_session_id uuid,
  target_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid := public.app_current_organization_id();
  source_payment public.payments%rowtype;
  target_session public.pos_sessions%rowtype;
  existing_payment public.payments%rowtype;
  already_refunded numeric(12,2);
  normalized_amount numeric(12,2) := round(target_amount, 2);
  result_id uuid;
begin
  perform public.require_pos_access(org_id);
  if target_idempotency_key is null or target_amount is null or normalized_amount <= 0 or nullif(btrim(target_reason), '') is null then
    raise exception 'pos_refund_invalid' using errcode = '22023';
  end if;
  if target_pos_session_id is not null then
    select * into target_session from public.pos_sessions session
    where session.id = target_pos_session_id and session.organization_id = org_id
    for update;
    if target_session.id is null or target_session.status <> 'open' then
      raise exception 'pos_session_not_open' using errcode = '55000';
    end if;
    if not public.has_organization_role(org_id, array['owner','manager']::public.app_role[])
      and target_session.opened_by <> auth.uid() then
      raise exception 'pos_session_not_assigned' using errcode = '42501';
    end if;
  end if;
  select * into source_payment from public.payments payment
  where payment.id = target_payment_id and payment.organization_id = org_id and payment.status = 'confirmed'
  for update;
  if source_payment.id is null then
    raise exception 'pos_payment_invalid' using errcode = '22023';
  end if;
  if source_payment.method = 'cash' and target_session.id is null then
    raise exception 'pos_cash_refund_requires_open_session' using errcode = '55000';
  end if;
  if target_session.id is not null and source_payment.pos_session_id is not null and exists (
    select 1 from public.pos_sessions original_session
    where original_session.id = source_payment.pos_session_id
      and original_session.organization_id = org_id
      and original_session.location_id is not null
      and original_session.location_id is distinct from target_session.location_id
  ) then
    raise exception 'pos_location_mismatch' using errcode = '42501';
  end if;

  select * into existing_payment from public.payments payment
  where payment.organization_id = org_id and payment.idempotency_key = target_idempotency_key;
  if existing_payment.id is not null then
    if existing_payment.refunded_from_payment_id <> target_payment_id
      or existing_payment.amount <> normalized_amount
      or existing_payment.status <> 'refunded'
      or existing_payment.pos_session_id is distinct from target_pos_session_id then
      raise exception 'pos_idempotency_conflict' using errcode = '23505';
    end if;
    return existing_payment.id;
  end if;

  select coalesce(sum(payment.amount), 0) into already_refunded
  from public.payments payment
  where payment.organization_id = org_id and payment.refunded_from_payment_id = target_payment_id
    and payment.status = 'refunded';
  if normalized_amount > round(source_payment.amount - already_refunded, 2) then
    raise exception 'pos_refund_exceeds_refundable' using errcode = '22023';
  end if;

  perform set_config('app.app_007_mutation', 'on', true);
  insert into public.payments (
    organization_id, order_id, amount, method, status, paid_at, reference, notes,
    recorded_by, confirmed_by, refunded_from_payment_id, refund_reason, refunded_at,
    pos_session_id, channel, provider, provider_reference, external_status, idempotency_key
  ) values (
    org_id, source_payment.order_id, normalized_amount, source_payment.method, 'refunded', now(),
    source_payment.reference, null, auth.uid(), auth.uid(), source_payment.id,
    nullif(btrim(target_reason), ''), now(), target_pos_session_id, 'pos', source_payment.provider,
    source_payment.provider_reference,
    case when source_payment.method = 'card' then 'refund_recorded_manual' else null end,
    target_idempotency_key
  ) returning id into result_id;
  return result_id;
end;
$$;

create function public.get_pos_session_summary(target_session_id uuid)
returns table (
  opening_cash numeric,
  cash_payments numeric,
  cash_refunds numeric,
  expected_cash numeric,
  transaction_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid := public.app_current_organization_id();
begin
  perform public.require_pos_access(org_id);
  if not exists (
    select 1 from public.pos_sessions session
    where session.id = target_session_id and session.organization_id = org_id
      and (public.has_organization_role(org_id, array['owner','manager']::public.app_role[]) or session.opened_by = auth.uid())
  ) then raise exception 'pos_session_invalid' using errcode = '42501'; end if;

  return query
  select session.opening_cash,
    round(coalesce(sum(payment.amount) filter (where payment.method = 'cash' and payment.status = 'confirmed'), 0), 2),
    round(coalesce(sum(payment.amount) filter (where payment.method = 'cash' and payment.status = 'refunded'), 0), 2),
    round(session.opening_cash
      + coalesce(sum(payment.amount) filter (where payment.method = 'cash' and payment.status = 'confirmed'), 0)
      - coalesce(sum(payment.amount) filter (where payment.method = 'cash' and payment.status = 'refunded'), 0), 2),
    count(payment.id)::bigint
  from public.pos_sessions session
  left join public.payments payment on payment.organization_id = session.organization_id and payment.pos_session_id = session.id
  where session.id = target_session_id and session.organization_id = org_id
  group by session.id, session.opening_cash;
end;
$$;

create function public.close_pos_session(
  target_session_id uuid,
  target_counted_cash numeric,
  target_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid := public.app_current_organization_id();
  target_session public.pos_sessions%rowtype;
  calculated_expected numeric(12,2);
begin
  perform public.require_pos_access(org_id);
  if target_counted_cash is null or target_counted_cash < 0 then
    raise exception 'pos_counted_cash_invalid' using errcode = '22023';
  end if;
  select * into target_session from public.pos_sessions session
  where session.id = target_session_id and session.organization_id = org_id
    and (public.has_organization_role(org_id, array['owner','manager']::public.app_role[]) or session.opened_by = auth.uid())
  for update;
  if target_session.id is null or target_session.status <> 'open' then
    raise exception 'pos_session_not_open' using errcode = '55000';
  end if;
  select summary.expected_cash into calculated_expected
  from public.get_pos_session_summary(target_session_id) summary;

  perform set_config('app.pos_001_mutation', 'on', true);
  update public.pos_sessions set status = 'closed', closed_by = auth.uid(), closed_at = now(),
    expected_cash = calculated_expected, counted_cash = round(target_counted_cash, 2),
    difference = round(target_counted_cash - calculated_expected, 2),
    notes = coalesce(nullif(btrim(target_notes), ''), notes)
  where id = target_session_id and organization_id = org_id and status = 'open';
  if not found then raise exception 'pos_session_not_open' using errcode = '55000'; end if;
end;
$$;

create function public.list_pos_orders_due(target_query text default null, target_limit integer default 30)
returns table (
  id uuid, order_number text, customer_name text, location_id uuid, production_status public.production_status,
  total numeric, currency text, total_paid numeric, outstanding numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid := public.app_current_organization_id();
begin
  perform public.require_pos_access(org_id);
  return query
  with totals as (
    select orders.id,
      coalesce(sum(payment.amount) filter (where payment.status = 'confirmed'), 0)
      - coalesce(sum(payment.amount) filter (where payment.status = 'refunded'), 0) as paid
    from public.orders orders
    left join public.payments payment on payment.organization_id = orders.organization_id and payment.order_id = orders.id
    where orders.organization_id = org_id and orders.is_active and orders.production_status <> 'cancelled'
    group by orders.id
  )
  select orders.id, orders.order_number, customer.display_name, orders.location_id, orders.production_status,
    round(orders.total, 2), orders.currency, round(totals.paid, 2), round(greatest(orders.total - totals.paid, 0), 2)
  from public.orders orders
  join public.customers customer on customer.organization_id = orders.organization_id and customer.id = orders.customer_id
  join totals on totals.id = orders.id
  where orders.organization_id = org_id and orders.is_active and orders.production_status <> 'cancelled'
    and orders.total - totals.paid > 0
    and (nullif(btrim(target_query), '') is null
      or orders.order_number ilike '%' || replace(nullif(btrim(target_query), ''), '%', '') || '%'
      or customer.display_name ilike '%' || replace(nullif(btrim(target_query), ''), '%', '') || '%')
  order by orders.created_at desc
  limit least(greatest(coalesce(target_limit, 30), 1), 50);
end;
$$;

create function public.get_pos_receipt_data(target_payment_id uuid)
returns table (
  payment_id uuid, organization_name text, location_name text, paid_at timestamptz,
  order_id uuid, order_number text, customer_name text, amount numeric, method public.payment_method,
  status public.payment_record_status, reference text, actor_name text, remaining_balance numeric,
  provider text, provider_reference text, external_status text, refunded_from_payment_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid := public.app_current_organization_id();
begin
  perform public.require_pos_access(org_id);
  return query
  select payment.id, organization.name, location.name, payment.paid_at, orders.id, orders.order_number,
    customer.display_name, payment.amount, payment.method, payment.status, payment.reference, profile.display_name,
    round(greatest(orders.total - (
      select coalesce(sum(p.amount) filter (where p.status = 'confirmed'), 0)
        - coalesce(sum(p.amount) filter (where p.status = 'refunded'), 0)
      from public.payments p where p.organization_id = org_id and p.order_id = orders.id
    ), 0), 2), payment.provider, payment.provider_reference, payment.external_status,
    payment.refunded_from_payment_id
  from public.payments payment
  join public.organizations organization on organization.id = payment.organization_id
  join public.orders orders on orders.organization_id = payment.organization_id and orders.id = payment.order_id
  join public.customers customer on customer.organization_id = orders.organization_id and customer.id = orders.customer_id
  join public.profiles profile on profile.id = payment.recorded_by
  left join public.pos_sessions session on session.organization_id = payment.organization_id and session.id = payment.pos_session_id
  left join public.locations location on location.organization_id = session.organization_id and location.id = session.location_id
  where payment.id = target_payment_id and payment.organization_id = org_id;
end;
$$;

alter table public.pos_sessions enable row level security;

create policy pos_sessions_select_authorized on public.pos_sessions
for select to authenticated
using (
  public.has_organization_entitlement(organization_id, 'pos')
  and public.has_pos_capability(organization_id)
  and (public.has_organization_role(organization_id, array['owner','manager']::public.app_role[]) or opened_by = auth.uid())
);

revoke all on public.pos_sessions from public, anon, authenticated;
grant select on public.pos_sessions to authenticated;
grant usage on type public.pos_session_status to authenticated;

-- Retire the legacy mutation entry points so every new payment/refund passes
-- through the entitlement, capability, session and idempotency boundary.
revoke execute on function public.record_payment(uuid, numeric, public.payment_method, timestamptz, text, text, uuid) from authenticated;
revoke execute on function public.refund_payment(uuid, numeric, text) from authenticated;
revoke execute on function public.void_payment(uuid, text) from authenticated;

revoke all on function public.prevent_pos_direct_mutation() from public, anon, authenticated;
revoke all on function public.has_pos_capability(uuid) from public, anon, authenticated;
revoke all on function public.require_pos_access(uuid) from public, anon, authenticated;
revoke all on function public.open_pos_session(uuid, numeric, text) from public, anon, authenticated;
revoke all on function public.record_pos_payment(uuid, numeric, public.payment_method, uuid, text, text, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.record_pos_refund(uuid, numeric, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_pos_session_summary(uuid) from public, anon, authenticated;
revoke all on function public.close_pos_session(uuid, numeric, text) from public, anon, authenticated;
revoke all on function public.list_pos_orders_due(text, integer) from public, anon, authenticated;
revoke all on function public.get_pos_receipt_data(uuid) from public, anon, authenticated;

grant execute on function public.open_pos_session(uuid, numeric, text) to authenticated;
grant execute on function public.has_pos_capability(uuid) to authenticated;
grant execute on function public.record_pos_payment(uuid, numeric, public.payment_method, uuid, text, text, uuid, text, text, text) to authenticated;
grant execute on function public.record_pos_refund(uuid, numeric, text, uuid, uuid) to authenticated;
grant execute on function public.get_pos_session_summary(uuid) to authenticated;
grant execute on function public.close_pos_session(uuid, numeric, text) to authenticated;
grant execute on function public.list_pos_orders_due(text, integer) to authenticated;
grant execute on function public.get_pos_receipt_data(uuid) to authenticated;
