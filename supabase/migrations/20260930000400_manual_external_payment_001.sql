-- MANUAL-EXTERNAL-PAYMENT-001: a verified internal payment outside POS and online settlement.
alter table public.payments drop constraint payments_channel_check;
alter table public.payments
  add constraint payments_channel_check check (channel in ('order', 'pos', 'online', 'manual_external'));

create function public.record_manual_external_payment(
  target_order_id uuid,
  target_amount numeric,
  target_method public.payment_method,
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
  target_order public.orders%rowtype;
  existing_payment public.payments%rowtype;
  paid_total numeric(12,2);
  normalized_amount numeric(12,2) := round(target_amount, 2);
  normalized_reference text := nullif(btrim(target_reference), '');
  normalized_notes text := nullif(btrim(target_notes), '');
  result_id uuid;
begin
  if org_id is null or not public.has_organization_role(org_id, array['owner','manager']::public.app_role[]) then
    raise exception 'manual_external_payment_not_authorized' using errcode = '42501';
  end if;
  if target_idempotency_key is null or target_amount is null or normalized_amount <= 0
    or target_method is null or target_method not in ('bank_transfer', 'other')
    or normalized_reference is null or char_length(normalized_reference) > 180
    or (target_method = 'other' and normalized_notes is null) then
    raise exception 'manual_external_payment_invalid' using errcode = '22023';
  end if;

  select * into target_order from public.orders orders
  where orders.id = target_order_id and orders.organization_id = org_id
  for update;
  if target_order.id is null or not target_order.is_active or target_order.production_status = 'cancelled' then
    raise exception 'manual_external_order_invalid' using errcode = '22023';
  end if;

  select * into existing_payment from public.payments payment
  where payment.organization_id = org_id and payment.idempotency_key = target_idempotency_key;
  if existing_payment.id is not null then
    if existing_payment.order_id <> target_order_id
      or existing_payment.amount <> normalized_amount
      or existing_payment.method <> target_method
      or existing_payment.status <> 'confirmed'
      or existing_payment.channel <> 'manual_external'
      or existing_payment.pos_session_id is not null
      or existing_payment.reference is distinct from normalized_reference
      or existing_payment.notes is distinct from normalized_notes then
      raise exception 'manual_external_idempotency_conflict' using errcode = '23505';
    end if;
    return existing_payment.id;
  end if;

  select coalesce(sum(payment.amount) filter (where payment.status = 'confirmed'), 0)
       - coalesce(sum(payment.amount) filter (where payment.status = 'refunded'), 0)
  into paid_total
  from public.payments payment
  where payment.organization_id = org_id and payment.order_id = target_order_id;
  if normalized_amount > round(target_order.total - paid_total, 2) then
    raise exception 'manual_external_payment_exceeds_outstanding' using errcode = '22023';
  end if;

  perform set_config('app.app_007_mutation', 'on', true);
  insert into public.payments (
    organization_id, order_id, amount, method, status, paid_at, reference, notes,
    recorded_by, confirmed_by, pos_session_id, channel, provider, provider_reference,
    external_status, idempotency_key
  ) values (
    org_id, target_order_id, normalized_amount, target_method, 'confirmed', now(),
    normalized_reference, normalized_notes, auth.uid(), auth.uid(),
    null, 'manual_external', null, null, null, target_idempotency_key
  ) returning id into result_id;
  return result_id;
end;
$$;

revoke all on function public.record_manual_external_payment(uuid, numeric, public.payment_method, text, text, uuid)
from public, anon, authenticated;
grant execute on function public.record_manual_external_payment(uuid, numeric, public.payment_method, text, text, uuid)
to authenticated;

create or replace function public.get_pos_receipt_data(target_payment_id uuid)
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
  where payment.id = target_payment_id and payment.organization_id = org_id
    and payment.channel = 'pos';
end;
$$;
