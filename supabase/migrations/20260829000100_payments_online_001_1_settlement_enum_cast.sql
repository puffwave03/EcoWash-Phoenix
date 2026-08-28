-- PAYMENTS-ONLINE-001.1: PostgreSQL requires an explicit enum cast for the
-- conditional canonical payment status. No data is rewritten.

create or replace function public.settle_online_payment_attempt(
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
    if not exists (
      select 1 from public.online_payment_provider_events event
      where event.provider = target_provider
        and event.provider_event_id = target_provider_event_id
        and event.attempt_id = target_attempt.id
    ) then
      raise exception 'online_payment_event_conflict' using errcode = '23505';
    end if;
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
      (case when result_status = 'confirmed' then 'confirmed' else 'pending' end)::public.payment_record_status,
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

revoke all on function public.settle_online_payment_attempt(text, text, text, text, numeric, text, timestamptz)
from public, anon, authenticated;
grant execute on function public.settle_online_payment_attempt(text, text, text, text, numeric, text, timestamptz)
to service_role;
