-- POS refunds require a POS source and an open till for every method. Historical rows remain unchanged.
create or replace function public.record_pos_refund(
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
  if target_pos_session_id is null then
    raise exception 'pos_session_not_open' using errcode = '55000';
  end if;
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
  select * into source_payment from public.payments payment
  where payment.id = target_payment_id and payment.organization_id = org_id and payment.status = 'confirmed'
  for update;
  if source_payment.id is null then
    raise exception 'pos_payment_invalid' using errcode = '22023';
  end if;
  if source_payment.channel <> 'pos' then
    raise exception 'pos_payment_invalid' using errcode = '22023';
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
