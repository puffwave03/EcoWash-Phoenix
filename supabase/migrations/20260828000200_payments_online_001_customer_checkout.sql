-- PAYMENTS-ONLINE-001: provider-neutral customer checkout foundation.
-- Confirmed financial truth remains in public.payments. These tables only
-- describe external attempts, non-secret tenant configuration and event IDs.

insert into public.platform_feature_catalog (feature_key, category, description)
values ('payments.online', 'commerce', 'Hosted online payments from the authenticated Customer Portal')
on conflict (feature_key) do nothing;

create type public.online_payment_attempt_status as enum (
  'pending',
  'confirmed',
  'failed',
  'cancelled',
  'expired',
  'reconciliation_required'
);

create table public.organization_online_payment_configs (
  organization_id uuid primary key references public.organizations (id) on delete restrict,
  provider text not null,
  enabled boolean not null default false,
  merchant_account_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_online_payment_configs_provider_format check (
    provider ~ '^[a-z][a-z0-9_-]{1,63}$'
  ),
  constraint organization_online_payment_configs_merchant_reference_limit check (
    merchant_account_reference is null
    or char_length(merchant_account_reference) between 1 and 180
  )
);

create table public.online_payment_attempts (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  customer_id uuid not null,
  order_id uuid not null,
  initiated_by_user_id uuid not null references auth.users (id) on delete restrict,
  amount numeric(12,2) not null,
  currency text not null,
  provider text not null,
  provider_session_id text,
  provider_payment_reference text,
  status public.online_payment_attempt_status not null default 'pending',
  idempotency_key uuid not null,
  settled_amount numeric(12,2),
  settled_currency text,
  canonical_payment_id uuid references public.payments (id) on delete restrict,
  external_status text,
  failure_code text,
  expires_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint online_payment_attempts_customer_same_org foreign key (organization_id, customer_id)
    references public.customers (organization_id, id) on delete restrict,
  constraint online_payment_attempts_order_same_org foreign key (organization_id, order_id)
    references public.orders (organization_id, id) on delete restrict,
  constraint online_payment_attempts_amount_positive check (amount > 0),
  constraint online_payment_attempts_settled_amount_positive check (
    settled_amount is null or settled_amount > 0
  ),
  constraint online_payment_attempts_currency_format check (
    currency = upper(currency) and char_length(currency) = 3
  ),
  constraint online_payment_attempts_settled_currency_format check (
    settled_currency is null
    or (settled_currency = upper(settled_currency) and char_length(settled_currency) = 3)
  ),
  constraint online_payment_attempts_provider_format check (
    provider ~ '^[a-z][a-z0-9_-]{1,63}$'
  ),
  constraint online_payment_attempts_provider_session_limit check (
    provider_session_id is null or char_length(provider_session_id) between 1 and 180
  ),
  constraint online_payment_attempts_provider_payment_limit check (
    provider_payment_reference is null or char_length(provider_payment_reference) between 1 and 180
  ),
  constraint online_payment_attempts_external_status_limit check (
    external_status is null or char_length(external_status) between 1 and 64
  ),
  constraint online_payment_attempts_failure_code_limit check (
    failure_code is null or char_length(failure_code) between 1 and 64
  ),
  constraint online_payment_attempts_confirmation_audit check (
    status not in ('confirmed', 'reconciliation_required')
    or (provider_payment_reference is not null and confirmed_at is not null)
  ),
  constraint online_payment_attempts_org_id_unique unique (organization_id, id)
);

create unique index online_payment_attempts_idempotency_idx
on public.online_payment_attempts (organization_id, idempotency_key);

create unique index online_payment_attempts_provider_session_idx
on public.online_payment_attempts (provider, provider_session_id)
where provider_session_id is not null;

create unique index online_payment_attempts_provider_payment_idx
on public.online_payment_attempts (provider, provider_payment_reference)
where provider_payment_reference is not null;

create unique index online_payment_attempts_one_pending_order_idx
on public.online_payment_attempts (organization_id, order_id)
where status = 'pending';

create index online_payment_attempts_customer_history_idx
on public.online_payment_attempts (organization_id, customer_id, created_at desc);

create table public.online_payment_provider_events (
  id uuid primary key default extensions.gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  attempt_id uuid not null references public.online_payment_attempts (id) on delete restrict,
  mapped_status public.online_payment_attempt_status not null,
  processed_at timestamptz not null default now(),
  constraint online_payment_provider_events_provider_format check (
    provider ~ '^[a-z][a-z0-9_-]{1,63}$'
  ),
  constraint online_payment_provider_events_event_limit check (
    char_length(provider_event_id) between 1 and 180
  ),
  constraint online_payment_provider_events_unique unique (provider, provider_event_id)
);

alter table public.payments drop constraint payments_channel_check;
alter table public.payments
  add constraint payments_channel_check check (channel in ('order', 'pos', 'online'));

create unique index payments_online_provider_reference_idx
on public.payments (provider, provider_reference)
where channel = 'online' and provider is not null and provider_reference is not null;

create trigger organization_online_payment_configs_set_updated_at
before update on public.organization_online_payment_configs
for each row execute function public.set_updated_at();

create trigger online_payment_attempts_set_updated_at
before update on public.online_payment_attempts
for each row execute function public.set_updated_at();

create function public.prevent_payments_online_direct_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('app.payments_online_001_mutation', true) <> 'on' then
    raise exception 'online_payment_mutation_requires_rpc' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    raise exception 'online_payment_hard_delete_not_allowed' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and new.organization_id <> old.organization_id then
    raise exception 'online_payment_organization_immutable' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger online_payment_attempts_controlled_mutation
before insert or update or delete on public.online_payment_attempts
for each row execute function public.prevent_payments_online_direct_mutation();

create function public.get_customer_portal_online_payment_availability(target_order_id uuid)
returns table (
  entitlement_enabled boolean,
  provider_configured boolean,
  eligible boolean,
  provider text,
  amount numeric,
  currency text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  portal_access public.customer_portal_access%rowtype;
  target_order public.orders%rowtype;
  paid_total numeric(12,2);
  configured_provider text;
  configured_enabled boolean := false;
begin
  select access.* into portal_access
  from public.customer_portal_access access
  join public.customers customer
    on customer.organization_id = access.organization_id
   and customer.id = access.customer_id
  join public.organizations organization on organization.id = access.organization_id
  where access.user_id = auth.uid()
    and access.is_active
    and customer.is_active
    and organization.deleted_at is null
    and organization.platform_service_status = 'active'
  order by access.created_at
  limit 1;

  if portal_access.id is null then
    raise exception 'customer_portal_access_required' using errcode = '42501';
  end if;

  select orders.* into target_order
  from public.orders orders
  where orders.id = target_order_id
    and orders.organization_id = portal_access.organization_id
    and orders.customer_id = portal_access.customer_id
    and orders.is_active
    and orders.production_status <> 'cancelled';

  if target_order.id is null then
    raise exception 'online_payment_order_invalid' using errcode = '42501';
  end if;

  select
    config.provider,
    config.enabled
  into configured_provider, configured_enabled
  from public.organization_online_payment_configs config
  where config.organization_id = portal_access.organization_id;

  select coalesce(sum(payment.amount) filter (where payment.status = 'confirmed'), 0)
       - coalesce(sum(payment.amount) filter (where payment.status = 'refunded'), 0)
  into paid_total
  from public.payments payment
  where payment.organization_id = target_order.organization_id
    and payment.order_id = target_order.id;

  entitlement_enabled := public.organization_entitlement_is_enabled(
    portal_access.organization_id,
    'payments.online',
    now()
  );
  provider_configured := coalesce(configured_enabled, false) and configured_provider is not null;
  amount := round(greatest(target_order.total - paid_total, 0), 2);
  currency := target_order.currency;
  provider := configured_provider;
  eligible := entitlement_enabled and provider_configured and amount > 0;
  return next;
end;
$$;

create function public.create_customer_online_payment_attempt(
  target_order_id uuid,
  target_idempotency_key uuid
)
returns table (
  attempt_id uuid,
  amount numeric,
  currency text,
  provider text,
  provider_session_id text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  portal_access public.customer_portal_access%rowtype;
  target_order public.orders%rowtype;
  existing_attempt public.online_payment_attempts%rowtype;
  configured_provider text;
  paid_total numeric(12,2);
  outstanding numeric(12,2);
  result_id uuid;
begin
  if target_idempotency_key is null then
    raise exception 'online_payment_idempotency_required' using errcode = '22023';
  end if;

  select access.* into portal_access
  from public.customer_portal_access access
  join public.customers customer
    on customer.organization_id = access.organization_id
   and customer.id = access.customer_id
  join public.organizations organization on organization.id = access.organization_id
  where access.user_id = auth.uid()
    and access.is_active
    and customer.is_active
    and organization.deleted_at is null
    and organization.platform_service_status = 'active'
  order by access.created_at
  limit 1;

  if portal_access.id is null then
    raise exception 'customer_portal_access_required' using errcode = '42501';
  end if;

  if not public.organization_entitlement_is_enabled(
    portal_access.organization_id,
    'payments.online',
    now()
  ) then
    raise exception 'online_payment_entitlement_required' using errcode = '42501';
  end if;

  select config.provider into configured_provider
  from public.organization_online_payment_configs config
  where config.organization_id = portal_access.organization_id
    and config.enabled;

  if configured_provider is null then
    raise exception 'online_payment_provider_not_configured' using errcode = '55000';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    portal_access.organization_id::text || ':online-payment:' || target_order_id::text,
    0
  ));

  select attempt.* into existing_attempt
  from public.online_payment_attempts attempt
  where attempt.organization_id = portal_access.organization_id
    and attempt.idempotency_key = target_idempotency_key;

  if existing_attempt.id is not null then
    if existing_attempt.order_id <> target_order_id
      or existing_attempt.customer_id <> portal_access.customer_id
      or existing_attempt.provider <> configured_provider then
      raise exception 'online_payment_idempotency_conflict' using errcode = '23505';
    end if;

    attempt_id := existing_attempt.id;
    amount := existing_attempt.amount;
    currency := existing_attempt.currency;
    provider := existing_attempt.provider;
    provider_session_id := existing_attempt.provider_session_id;
    return next;
    return;
  end if;

  select orders.* into target_order
  from public.orders orders
  where orders.id = target_order_id
    and orders.organization_id = portal_access.organization_id
    and orders.customer_id = portal_access.customer_id
    and orders.is_active
    and orders.production_status <> 'cancelled'
  for update;

  if target_order.id is null then
    raise exception 'online_payment_order_invalid' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.online_payment_attempts attempt
    where attempt.organization_id = portal_access.organization_id
      and attempt.order_id = target_order_id
      and attempt.status = 'pending'
      and (attempt.expires_at is null or attempt.expires_at > now())
  ) then
    raise exception 'online_payment_attempt_in_progress' using errcode = '55000';
  end if;

  perform set_config('app.payments_online_001_mutation', 'on', true);
  update public.online_payment_attempts attempt
  set status = 'expired', failure_code = 'session_expired'
  where attempt.organization_id = portal_access.organization_id
    and attempt.order_id = target_order_id
    and attempt.status = 'pending'
    and attempt.expires_at <= now();

  select coalesce(sum(payment.amount) filter (where payment.status = 'confirmed'), 0)
       - coalesce(sum(payment.amount) filter (where payment.status = 'refunded'), 0)
  into paid_total
  from public.payments payment
  where payment.organization_id = target_order.organization_id
    and payment.order_id = target_order.id;

  outstanding := round(greatest(target_order.total - paid_total, 0), 2);
  if outstanding <= 0 then
    raise exception 'online_payment_no_balance' using errcode = '22023';
  end if;

  insert into public.online_payment_attempts (
    organization_id,
    customer_id,
    order_id,
    initiated_by_user_id,
    amount,
    currency,
    provider,
    idempotency_key,
    expires_at
  ) values (
    portal_access.organization_id,
    portal_access.customer_id,
    target_order.id,
    auth.uid(),
    outstanding,
    target_order.currency,
    configured_provider,
    target_idempotency_key,
    now() + interval '30 minutes'
  ) returning id into result_id;

  attempt_id := result_id;
  amount := outstanding;
  currency := target_order.currency;
  provider := configured_provider;
  provider_session_id := null;
  return next;
end;
$$;

create function public.attach_online_payment_provider_session(
  target_attempt_id uuid,
  target_provider text,
  target_provider_session_id text,
  target_expires_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if nullif(btrim(target_provider_session_id), '') is null then
    raise exception 'provider_session_required' using errcode = '22023';
  end if;

  perform set_config('app.payments_online_001_mutation', 'on', true);
  update public.online_payment_attempts attempt
  set provider_session_id = btrim(target_provider_session_id),
      expires_at = coalesce(target_expires_at, attempt.expires_at)
  where attempt.id = target_attempt_id
    and attempt.provider = target_provider
    and attempt.status = 'pending'
    and attempt.provider_session_id is null;

  if not found then
    raise exception 'online_payment_attempt_not_attachable' using errcode = '55000';
  end if;
end;
$$;

create function public.mark_online_payment_attempt_creation_failed(
  target_attempt_id uuid,
  target_failure_code text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  perform set_config('app.payments_online_001_mutation', 'on', true);
  update public.online_payment_attempts
  set status = 'failed',
      failure_code = coalesce(nullif(btrim(target_failure_code), ''), 'checkout_creation_failed'),
      external_status = 'failed'
  where id = target_attempt_id
    and status = 'pending';
end;
$$;

create function public.record_online_payment_attempt_outcome(
  target_provider text,
  target_provider_event_id text,
  target_provider_session_id text,
  target_status public.online_payment_attempt_status,
  target_failure_code text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_attempt public.online_payment_attempts%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if target_status not in ('failed', 'cancelled', 'expired') then
    raise exception 'online_payment_outcome_invalid' using errcode = '22023';
  end if;

  select attempt.* into target_attempt
  from public.online_payment_attempts attempt
  where attempt.provider = target_provider
    and attempt.provider_session_id = target_provider_session_id
  for update;

  if target_attempt.id is null then
    raise exception 'online_payment_attempt_not_found' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.online_payment_provider_events event
    where event.provider = target_provider
      and event.provider_event_id = target_provider_event_id
  ) then
    if not exists (
      select 1 from public.online_payment_provider_events event
      where event.provider = target_provider
        and event.provider_event_id = target_provider_event_id
        and event.attempt_id = target_attempt.id
    ) then
      raise exception 'online_payment_event_conflict' using errcode = '23505';
    end if;
    return;
  end if;

  perform set_config('app.payments_online_001_mutation', 'on', true);
  if target_attempt.status = 'pending' then
    update public.online_payment_attempts
    set status = target_status,
        failure_code = coalesce(nullif(btrim(target_failure_code), ''), target_status::text),
        external_status = target_status::text
    where id = target_attempt.id;
  end if;

  insert into public.online_payment_provider_events (
    provider, provider_event_id, attempt_id, mapped_status
  ) values (
    target_provider, target_provider_event_id, target_attempt.id, target_status
  ) on conflict (provider, provider_event_id) do nothing;
end;
$$;

create function public.settle_online_payment_attempt(
  target_provider text,
  target_provider_event_id text,
  target_provider_session_id text,
  target_provider_payment_reference text,
  target_amount numeric,
  target_currency text,
  target_paid_at timestamptz default null
)
returns table (
  attempt_id uuid,
  canonical_payment_id uuid,
  settlement_status public.online_payment_attempt_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_attempt public.online_payment_attempts%rowtype;
  target_order public.orders%rowtype;
  paid_total numeric(12,2);
  outstanding numeric(12,2);
  normalized_amount numeric(12,2) := round(target_amount, 2);
  normalized_currency text := upper(btrim(target_currency));
  result_payment_id uuid;
  result_status public.online_payment_attempt_status;
  confirmation_matches boolean;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if target_amount is null
    or target_currency is null
    or nullif(btrim(target_provider_event_id), '') is null
    or nullif(btrim(target_provider_session_id), '') is null
    or nullif(btrim(target_provider_payment_reference), '') is null
    or normalized_amount <= 0
    or char_length(normalized_currency) <> 3 then
    raise exception 'online_payment_confirmation_invalid' using errcode = '22023';
  end if;

  select attempt.* into target_attempt
  from public.online_payment_attempts attempt
  where attempt.provider = target_provider
    and attempt.provider_session_id = target_provider_session_id
  for update;

  if target_attempt.id is null then
    raise exception 'online_payment_attempt_not_found' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.online_payment_provider_events event
    where event.provider = target_provider
      and event.provider_event_id = target_provider_event_id
  ) then
    attempt_id := target_attempt.id;
    canonical_payment_id := target_attempt.canonical_payment_id;
    settlement_status := target_attempt.status;
    return next;
    return;
  end if;

  if target_attempt.status in ('confirmed', 'reconciliation_required') then
    if target_attempt.provider_payment_reference <> target_provider_payment_reference then
      raise exception 'online_payment_reference_conflict' using errcode = '23505';
    end if;
    insert into public.online_payment_provider_events (
      provider, provider_event_id, attempt_id, mapped_status
    ) values (
      target_provider, target_provider_event_id, target_attempt.id, target_attempt.status
    ) on conflict (provider, provider_event_id) do nothing;
    attempt_id := target_attempt.id;
    canonical_payment_id := target_attempt.canonical_payment_id;
    settlement_status := target_attempt.status;
    return next;
    return;
  end if;

  -- A later verified success is authoritative even if an earlier, reordered
  -- failure/cancellation/expiry event was already received.
  if target_attempt.status not in ('pending', 'failed', 'cancelled', 'expired') then
    raise exception 'online_payment_attempt_not_settleable' using errcode = '55000';
  end if;

  select orders.* into target_order
  from public.orders orders
  where orders.id = target_attempt.order_id
    and orders.organization_id = target_attempt.organization_id
  for update;

  if target_order.id is null then
    raise exception 'online_payment_order_missing' using errcode = '55000';
  end if;

  select coalesce(sum(payment.amount) filter (where payment.status = 'confirmed'), 0)
       - coalesce(sum(payment.amount) filter (where payment.status = 'refunded'), 0)
  into paid_total
  from public.payments payment
  where payment.organization_id = target_attempt.organization_id
    and payment.order_id = target_attempt.order_id;

  outstanding := round(greatest(target_order.total - paid_total, 0), 2);
  confirmation_matches := normalized_amount = target_attempt.amount
    and normalized_currency = target_attempt.currency;
  result_status := case
    when confirmation_matches and normalized_amount <= outstanding then 'confirmed'
    else 'reconciliation_required'
  end;

  perform set_config('app.app_007_mutation', 'on', true);
  if normalized_currency = target_order.currency then
    insert into public.payments (
      organization_id,
      order_id,
      amount,
      method,
      status,
      paid_at,
      reference,
      notes,
      recorded_by,
      confirmed_by,
      channel,
      provider,
      provider_reference,
      external_status,
      idempotency_key
    ) values (
      target_attempt.organization_id,
      target_attempt.order_id,
      normalized_amount,
      'card',
      case when result_status = 'confirmed' then 'confirmed' else 'pending' end,
      coalesce(target_paid_at, now()),
      btrim(target_provider_payment_reference),
      case when result_status = 'confirmed'
        then 'Hosted online payment verified server-side'
        else 'External payment requires manual reconciliation'
      end,
      target_attempt.initiated_by_user_id,
      case when result_status = 'confirmed' then target_attempt.initiated_by_user_id else null end,
      'online',
      target_provider,
      btrim(target_provider_payment_reference),
      result_status::text,
      target_attempt.idempotency_key
    ) returning id into result_payment_id;
  end if;

  perform set_config('app.payments_online_001_mutation', 'on', true);
  update public.online_payment_attempts
  set status = result_status,
      provider_payment_reference = btrim(target_provider_payment_reference),
      settled_amount = normalized_amount,
      settled_currency = normalized_currency,
      canonical_payment_id = result_payment_id,
      external_status = result_status::text,
      failure_code = case when result_status = 'reconciliation_required'
        then case
          when normalized_currency <> target_attempt.currency then 'currency_mismatch'
          when normalized_amount <> target_attempt.amount then 'amount_mismatch'
          else 'outstanding_changed'
        end
        else null
      end,
      confirmed_at = coalesce(target_paid_at, now())
  where id = target_attempt.id;

  insert into public.online_payment_provider_events (
    provider, provider_event_id, attempt_id, mapped_status
  ) values (
    target_provider, target_provider_event_id, target_attempt.id, result_status
  );

  attempt_id := target_attempt.id;
  canonical_payment_id := result_payment_id;
  settlement_status := result_status;
  return next;
end;
$$;

alter table public.organization_online_payment_configs enable row level security;
alter table public.online_payment_attempts enable row level security;
alter table public.online_payment_provider_events enable row level security;

create policy organization_online_payment_configs_select_management
on public.organization_online_payment_configs
for select to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['owner', 'manager']::public.app_role[]
  )
);

create policy online_payment_attempts_select_customer_or_management
on public.online_payment_attempts
for select to authenticated
using (
  exists (
    select 1 from public.customer_portal_access access
    where access.organization_id = online_payment_attempts.organization_id
      and access.customer_id = online_payment_attempts.customer_id
      and access.user_id = auth.uid()
      and access.is_active
  )
  or public.has_organization_role(
    organization_id,
    array['owner', 'manager']::public.app_role[]
  )
);

revoke all on public.organization_online_payment_configs from public, anon, authenticated;
revoke all on public.online_payment_attempts from public, anon, authenticated;
revoke all on public.online_payment_provider_events from public, anon, authenticated;
grant select on public.organization_online_payment_configs to authenticated;
grant select on public.online_payment_attempts to authenticated;
grant usage on type public.online_payment_attempt_status to authenticated;

revoke all on function public.prevent_payments_online_direct_mutation() from public, anon, authenticated;
revoke all on function public.get_customer_portal_online_payment_availability(uuid) from public, anon, authenticated;
revoke all on function public.create_customer_online_payment_attempt(uuid, uuid) from public, anon, authenticated;
revoke all on function public.attach_online_payment_provider_session(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.mark_online_payment_attempt_creation_failed(uuid, text) from public, anon, authenticated;
revoke all on function public.record_online_payment_attempt_outcome(text, text, text, public.online_payment_attempt_status, text) from public, anon, authenticated;
revoke all on function public.settle_online_payment_attempt(text, text, text, text, numeric, text, timestamptz) from public, anon, authenticated;

grant execute on function public.get_customer_portal_online_payment_availability(uuid) to authenticated;
grant execute on function public.create_customer_online_payment_attempt(uuid, uuid) to authenticated;
grant execute on function public.attach_online_payment_provider_session(uuid, text, text, timestamptz) to service_role;
grant execute on function public.mark_online_payment_attempt_creation_failed(uuid, text) to service_role;
grant execute on function public.record_online_payment_attempt_outcome(text, text, text, public.online_payment_attempt_status, text) to service_role;
grant execute on function public.settle_online_payment_attempt(text, text, text, text, numeric, text, timestamptz) to service_role;
