-- MANUAL-EXTERNAL-REFUND-001: record a verified reimbursement outside POS and providers.
create function public.record_manual_external_refund(
  target_payment_id uuid,
  target_amount numeric,
  target_reason text,
  target_reference text,
  target_notes text,
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
  existing_payment public.payments%rowtype;
  already_refunded numeric(12,2);
  normalized_amount numeric(12,2) := round(target_amount, 2);
  normalized_reason text := nullif(btrim(target_reason), '');
  normalized_reference text := nullif(btrim(target_reference), '');
  normalized_notes text := nullif(btrim(target_notes), '');
  recorded_at timestamptz := now();
  result_id uuid;
begin
  if org_id is null or not public.has_organization_role(org_id, array['owner','manager']::public.app_role[]) then
    raise exception 'manual_external_refund_not_authorized' using errcode = '42501';
  end if;
  if target_idempotency_key is null or target_amount is null or normalized_amount <= 0
    or normalized_reason is null or char_length(normalized_reason) > 600
    or normalized_reference is null or char_length(normalized_reference) > 180
    or char_length(coalesce(normalized_notes, '')) > 600 then
    raise exception 'manual_external_refund_invalid' using errcode = '22023';
  end if;

  select * into source_payment from public.payments payment
  where payment.id = target_payment_id
    and payment.organization_id = org_id
    and payment.status = 'confirmed'
  for update;
  if source_payment.id is null or source_payment.channel <> 'manual_external'
    or source_payment.method not in ('bank_transfer', 'other') then
    raise exception 'manual_external_refund_source_invalid' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.orders orders
    where orders.id = source_payment.order_id and orders.organization_id = org_id
  ) then
    raise exception 'manual_external_refund_order_invalid' using errcode = '22023';
  end if;
  if source_payment.method = 'other' and normalized_notes is null then
    raise exception 'manual_external_refund_notes_required' using errcode = '22023';
  end if;
  if normalized_reference = source_payment.reference then
    raise exception 'manual_external_refund_reference_not_distinct' using errcode = '22023';
  end if;

  select * into existing_payment from public.payments payment
  where payment.organization_id = org_id and payment.idempotency_key = target_idempotency_key;
  if existing_payment.id is not null then
    if existing_payment.refunded_from_payment_id is distinct from source_payment.id
      or existing_payment.order_id is distinct from source_payment.order_id
      or existing_payment.amount is distinct from normalized_amount
      or existing_payment.status is distinct from 'refunded'
      or existing_payment.channel is distinct from 'manual_external'
      or existing_payment.method is distinct from source_payment.method
      or existing_payment.reference is distinct from normalized_reference
      or existing_payment.refund_reason is distinct from normalized_reason
      or existing_payment.notes is distinct from normalized_notes
      or existing_payment.pos_session_id is not null
      or existing_payment.provider is not null
      or existing_payment.provider_reference is not null
      or existing_payment.external_status is not null then
      raise exception 'manual_external_refund_idempotency_conflict' using errcode = '23505';
    end if;
    return existing_payment.id;
  end if;

  select coalesce(sum(payment.amount), 0) into already_refunded
  from public.payments payment
  where payment.organization_id = org_id
    and payment.refunded_from_payment_id = source_payment.id
    and payment.status = 'refunded';
  if normalized_amount > round(source_payment.amount - already_refunded, 2) then
    raise exception 'manual_external_refund_exceeds_refundable' using errcode = '22023';
  end if;

  perform set_config('app.app_007_mutation', 'on', true);
  insert into public.payments (
    organization_id, order_id, amount, method, status, paid_at, reference, notes,
    recorded_by, confirmed_by, refunded_from_payment_id, refund_reason, refunded_at,
    pos_session_id, channel, provider, provider_reference, external_status, idempotency_key
  ) values (
    org_id, source_payment.order_id, normalized_amount, source_payment.method, 'refunded',
    recorded_at, normalized_reference, normalized_notes, auth.uid(), auth.uid(),
    source_payment.id, normalized_reason, recorded_at,
    null, 'manual_external', null, null, null, target_idempotency_key
  ) returning id into result_id;
  return result_id;
end;
$$;

revoke all on function public.record_manual_external_refund(uuid, numeric, text, text, text, uuid)
from public, anon, authenticated;
grant execute on function public.record_manual_external_refund(uuid, numeric, text, text, text, uuid)
to authenticated;
