-- ORDER-FINANCIAL-INTEGRITY-GUARD-001 (Phase 2A)
-- Prevent order line and total changes after a persisted payment or document
-- has made the order's economic snapshot authoritative. This migration does
-- not mutate existing orders, payments, Billing documents, or REC snapshots.

create or replace function public.assert_order_financially_mutable(target_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  org_id uuid;
  source_org_id uuid;
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'order_financial_conflict' using errcode = '40001';
  end if;

  -- Portal creation has no Staff membership. Admit only its own draft while
  -- the canonical RPC is building it in this transaction, before history is
  -- recorded. Caller-set flags alone never establish tenant authorization.
  select o.organization_id into org_id
  from public.orders o
  join public.customer_portal_current_access() portal_context
    on portal_context.organization_id = o.organization_id
   and portal_context.customer_id = o.customer_id
  where o.id = target_order_id
    and o.created_by = auth.uid()
    and o.production_status = 'draft'
    and o.created_at = transaction_timestamp()
    and o.xmin = pg_current_xact_id()::xid
    and current_setting('app.order_create', true) = 'on'
    and current_setting('app.order_item_mutation', true) = 'on'
    and not exists (
      select 1 from public.order_status_history h
      where h.organization_id = o.organization_id and h.order_id = o.id
    );

  if org_id is null then
    org_id := public.app_current_organization_id();
  end if;

  if org_id is null then
    raise exception 'order_financial_conflict' using errcode = '42501';
  end if;

  select o.organization_id into source_org_id
  from public.orders o
  where o.organization_id = org_id
    and o.id = target_order_id;

  if source_org_id is null then
    raise exception 'order_financial_conflict' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.payments p
    where p.organization_id = org_id
      and p.order_id = target_order_id
      and p.status <> 'void'
  ) then
    raise exception 'order_financial_payment_locked' using errcode = '55000';
  end if;

  -- Keep all invoice links, including inactive and cancelled historical rows.
  if exists (
    select 1 from public.invoice_orders l
    where l.organization_id = org_id
      and l.order_id = target_order_id
  ) then
    raise exception 'order_financial_document_locked' using errcode = '55000';
  end if;

  if exists (
    select 1 from public.operational_receipts r
    where r.organization_id = org_id
      and r.order_id = target_order_id
      and r.document_status = 'issued'
  ) then
    raise exception 'order_financial_document_locked' using errcode = '55000';
  end if;
end;
$$;

create or replace function public.guard_order_item_financial_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform public.assert_order_financially_mutable(old.order_id);
    return old;
  end if;

  if tg_op = 'UPDATE' then
    -- Only audit metadata is outside the economic/document snapshot. Notes
    -- and sort order are included in REC; protect them along with every other
    -- field, including future columns, unless explicitly reviewed otherwise.
    if (to_jsonb(new) - array['updated_at', 'updated_by'])
      is not distinct from (to_jsonb(old) - array['updated_at', 'updated_by']) then
      return new;
    end if;
    perform public.assert_order_financially_mutable(old.order_id);
    if new.order_id is distinct from old.order_id then
      perform public.assert_order_financially_mutable(new.order_id);
    end if;
    return new;
  end if;

  perform public.assert_order_financially_mutable(new.order_id);
  return new;
end;
$$;

create or replace function public.guard_order_total_financial_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.subtotal is distinct from old.subtotal
    or new.discount_amount is distinct from old.discount_amount
    or new.total is distinct from old.total then
    perform public.assert_order_financially_mutable(old.id);
  end if;
  return new;
end;
$$;

drop trigger if exists order_items_financial_integrity_guard on public.order_items;
drop trigger if exists order_items_zz_financial_integrity_guard on public.order_items;
-- PostgreSQL runs same-event triggers alphabetically. Check the final NEW
-- values after order_items_resolve_effective_price, including indirect repricing
-- from an UPDATE that explicitly targets an unchanged quantity/service/price.
create trigger order_items_zz_financial_integrity_guard
before insert or update or delete on public.order_items
for each row execute function public.guard_order_item_financial_integrity();

drop trigger if exists orders_financial_integrity_guard on public.orders;
create trigger orders_financial_integrity_guard
before update of subtotal, discount_amount, total on public.orders
for each row execute function public.guard_order_total_financial_integrity();

-- recalculation remains internal to trusted RPCs; the trigger guards its writes.
revoke all on function public.assert_order_financially_mutable(uuid)
  from public, anon, authenticated;
revoke all on function public.guard_order_item_financial_integrity()
  from public, anon, authenticated;
revoke all on function public.guard_order_total_financial_integrity()
  from public, anon, authenticated;
revoke all on function public.recalculate_order_totals(uuid)
  from public, anon, authenticated;
