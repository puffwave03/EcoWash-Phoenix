-- POS-SESSION-PAYMENT-BOUNDARY-001: require an open till for every new POS payment method.
create or replace function public.record_pos_payment(
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
