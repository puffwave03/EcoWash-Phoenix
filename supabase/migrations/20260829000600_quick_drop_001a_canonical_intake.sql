-- QUICK-DROP-001A creates an idempotent canonical order intake with no provisional lines or money.
-- Pending detail is represented by a quick_drop history source plus zero active canonical order items.
create function public.create_quick_drop_order(
  target_idempotency_key uuid,
  target_customer_id uuid,
  target_location_id uuid,
  target_due_at timestamptz,
  target_note text
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
begin
  perform public.require_shop_terminal_access(org_id);

  if target_idempotency_key is null
    or target_customer_id is null
    or target_location_id is null
    or char_length(coalesce(target_note, '')) > 600 then
    raise exception 'quick_drop_submission_invalid' using errcode = '22023';
  end if;

  fingerprint := md5(jsonb_build_object(
    'kind', 'quick_drop',
    'customerId', target_customer_id,
    'locationId', target_location_id,
    'dueAt', target_due_at,
    'note', nullif(btrim(target_note), '')
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

revoke all on function public.create_quick_drop_order(uuid, uuid, uuid, timestamptz, text)
from public, anon, authenticated;
grant execute on function public.create_quick_drop_order(uuid, uuid, uuid, timestamptz, text)
to authenticated;

create function public.prevent_pending_quick_drop_production()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.production_status = 'received'
    and new.production_status not in ('received', 'on_hold', 'cancelled')
    and exists (
      select 1
      from public.order_status_history history
      where history.organization_id = old.organization_id
        and history.order_id = old.id
        and history.metadata @> '{"source":"quick_drop"}'::jsonb
    )
    and not exists (
      select 1
      from public.order_items item
      where item.organization_id = old.organization_id
        and item.order_id = old.id
        and item.is_active
    ) then
    raise exception 'quick_drop_detail_required' using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger orders_prevent_pending_quick_drop_production
before update of production_status on public.orders
for each row execute function public.prevent_pending_quick_drop_production();
