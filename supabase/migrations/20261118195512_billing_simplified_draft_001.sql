-- BILLING-SIMPLIFIED-DRAFT-001: atomic, internal draft preparation only.
-- Existing Billing RPCs own snapshots, discount allocation and inclusive IGIC.
-- No existing RPC, RLS policy, fiscal gate or definitive counter is changed.
begin;

create function public.create_simplified_billing_draft(
  target_order_id uuid,
  target_series text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid := public.app_current_organization_id();
  order_row public.orders%rowtype;
  invoice_row public.invoices%rowtype;
  customer_row public.customers%rowtype;
  summary record;
  totals record;
  draft_id uuid;
  normalized_series text := upper(btrim(target_series));
begin
  if auth.uid() is null or not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'billing_not_authorized' using errcode = '42501';
  end if;
  if not public.organization_entitlement_is_enabled(org_id, 'billing.invoicing', now()) then
    raise exception 'billing_entitlement_required' using errcode = '42501';
  end if;
  perform public.require_pos_access(org_id);
  if normalized_series is null or normalized_series !~ '^[A-Z0-9-]{1,12}$' then
    raise exception 'billing_invalid_tax_or_series' using errcode = '22023';
  end if;

  -- Serialize repeated/concurrent preparation for this tenant/order. The
  -- existing partial unique invoice_orders index also protects ordinary races.
  select * into order_row from public.orders customer_order
  where customer_order.organization_id = org_id and customer_order.id = target_order_id
  for update;
  if order_row.id is null or not order_row.is_active or order_row.production_status = 'cancelled' then
    raise exception 'billing_invalid_orders' using errcode = '22023';
  end if;
  select * into customer_row from public.customers customer
  where customer.organization_id = org_id and customer.id = order_row.customer_id
  for share;
  if customer_row.id is null then
    raise exception 'billing_invalid_customer' using errcode = '22023';
  end if;
  perform 1 from public.order_items item
  where item.organization_id = org_id and item.order_id = target_order_id
  order by item.id for share;

  -- Read financial facts only. Lock originals against concurrent POS refunds;
  -- record_pos_payment already locks the order before adding a new payment.
  perform 1 from public.payments payment
  where payment.organization_id = org_id and payment.order_id = target_order_id
  order by payment.id for share;
  if exists (
    select 1 from public.payments payment
    left join public.pos_sessions session on session.organization_id = org_id
      and session.id = payment.pos_session_id
    where payment.organization_id = org_id and payment.order_id = target_order_id
      and payment.status in ('confirmed', 'refunded')
      and (payment.channel <> 'pos' or payment.pos_session_id is null
        or payment.recorded_by is null or payment.confirmed_by is null
        or payment.paid_at is null or not isfinite(payment.paid_at)
        or payment.amount <= 0 or session.id is null or session.status not in ('open', 'closed')
        or (order_row.location_id is not null and session.location_id is not null
          and order_row.location_id <> session.location_id))
  ) then
    raise exception 'billing_pos_registration_unverified' using errcode = '55000';
  end if;
  if exists (
    select 1 from public.payments refund
    left join public.payments original on original.organization_id = org_id
      and original.order_id = target_order_id and original.id = refund.refunded_from_payment_id
      and original.status = 'confirmed' and original.method = refund.method
    where refund.organization_id = org_id and refund.order_id = target_order_id
      and refund.status = 'refunded' and (original.id is null or original.amount < (
        select sum(other.amount) from public.payments other
        where other.organization_id = org_id and other.order_id = target_order_id
          and other.status = 'refunded' and other.refunded_from_payment_id = original.id
      ))
  ) then
    raise exception 'billing_payment_reconciliation_failed' using errcode = '55000';
  end if;
  select * into summary from public.get_order_payment_summary(target_order_id);
  if summary.total_due is distinct from order_row.total
    or summary.total_paid is distinct from order_row.total
    or summary.balance_due is distinct from 0::numeric
    or summary.payment_status is distinct from 'paid'
    or not exists (
      select 1 from public.payments payment where payment.organization_id = org_id
        and payment.order_id = target_order_id and payment.status = 'confirmed'
    ) then
    -- Partial/unpaid orders do not create drafts or automatic fiscal advances.
    raise exception 'billing_order_not_fully_paid' using errcode = '55000';
  end if;

  select link.invoice_id into draft_id from public.invoice_orders link
  where link.organization_id = org_id and link.order_id = target_order_id and link.is_active
  for update;
  if draft_id is not null then
    select * into invoice_row from public.invoices invoice
    where invoice.organization_id = org_id and invoice.id = draft_id for update;
    if invoice_row.id is null or invoice_row.document_status <> 'draft'
      or invoice_row.fiscal_document_type <> 'simplificada'
      or invoice_row.series <> normalized_series
    then
      raise exception 'billing_simplified_draft_conflict' using errcode = '55000';
    end if;
  else
    -- Create in the canonical ordinary/default series, then prepare in this
    -- SAME transaction. Inserting an ordinary draft directly into a series
    -- already used by simplified drafts would violate the existing type guard.
    draft_id := public.create_billing_draft(array[target_order_id]);
    perform public.prepare_simplified_billing_draft(draft_id, normalized_series);
    select * into invoice_row from public.invoices invoice
    where invoice.organization_id = org_id and invoice.id = draft_id;
  end if;

  perform 1 from public.invoice_items item
  where item.organization_id = org_id and item.invoice_id = draft_id
  order by item.id for share;

  -- Compatible means one order, unchanged source lines, coherent stored totals,
  -- one inclusive rate, and the recipient contract. No alternate tax formula.
  if invoice_row.customer_id <> order_row.customer_id or invoice_row.currency <> order_row.currency
    or invoice_row.invoice_number is not null or invoice_row.sequence_number is not null
    or invoice_row.issued_at is not null or not invoice_row.prices_include_tax
    or invoice_row.subtotal <> order_row.subtotal or invoice_row.discount_total <> order_row.discount_amount
    or invoice_row.total <> order_row.total
    or (select count(*) from public.invoice_orders link
      where link.organization_id = org_id and link.invoice_id = draft_id) <> 1
    or exists (
      select 1 from public.invoice_items item
      left join public.order_items source on source.organization_id = org_id
        and source.order_id = target_order_id and source.id = item.source_order_item_id and source.is_active
      where item.organization_id = org_id and item.invoice_id = draft_id
        and (item.source_order_id is distinct from target_order_id or source.id is null
          or item.description is distinct from source.description or item.unit_type is distinct from source.unit_type
          or item.quantity is distinct from source.quantity or item.unit_price is distinct from source.unit_price
          or item.line_subtotal is distinct from source.line_total or not item.prices_include_tax
          or item.line_subtotal - item.discount_amount <> item.line_total
          or item.taxable_base + item.tax_amount <> item.line_total)
    )
  then
    raise exception 'billing_simplified_draft_incompatible' using errcode = '55000';
  end if;
  select count(*) as item_count, count(distinct item.source_order_item_id) as source_count,
    count(distinct item.tax_rate) as rate_count,
    sum(item.line_subtotal) as subtotal, sum(item.discount_amount) as discount_total,
    sum(item.taxable_base) as taxable_base, sum(item.tax_amount) as tax_total, sum(item.line_total) as total
  into totals from public.invoice_items item
  where item.organization_id = org_id and item.invoice_id = draft_id;
  if totals.item_count = 0 or totals.rate_count <> 1 then
    raise exception 'billing_simplified_tax_model_unsupported' using errcode = '22023';
  end if;
  if totals.item_count <> totals.source_count or totals.source_count <> (
      select count(*) from public.order_items source
      where source.organization_id = org_id and source.order_id = target_order_id and source.is_active
    ) or totals.subtotal is distinct from invoice_row.subtotal
    or totals.discount_total is distinct from invoice_row.discount_total
    or totals.taxable_base is distinct from invoice_row.taxable_base
    or totals.tax_total is distinct from invoice_row.tax_total
    or totals.total is distinct from invoice_row.total
    or invoice_row.subtotal - invoice_row.discount_total <> invoice_row.total
    or invoice_row.taxable_base + invoice_row.tax_total <> invoice_row.total
  then
    raise exception 'billing_simplified_draft_incompatible' using errcode = '55000';
  end if;
  if (customer_row.customer_code = 'WALKIN-SHARED' and (
      invoice_row.customer_name is not null or invoice_row.customer_tax_id is not null
      or invoice_row.customer_address_line1 is not null or invoice_row.customer_address_line2 is not null
      or invoice_row.customer_city is not null or invoice_row.customer_postal_code is not null
      or invoice_row.customer_country_code is not null or invoice_row.customer_email is not null
    )) or (customer_row.customer_code is distinct from 'WALKIN-SHARED'
      and nullif(btrim(invoice_row.customer_name), '') is null)
  then
    raise exception 'billing_simplified_draft_incompatible' using errcode = '55000';
  end if;
  return draft_id;
end;
$$;

revoke all on function public.create_simplified_billing_draft(uuid, text) from public, anon, authenticated;
grant execute on function public.create_simplified_billing_draft(uuid, text) to authenticated;

commit;
