-- BILLING-SIMPLIFIED-UI-001: typed insertion for shared walk-in customers.
-- Proposed only. No historical rows, payments, numbering or issue RPC changed.
begin;

-- Keep the existing trigger active. Its replacement is transactional and covers
-- type/recipient edits as well as insertion; no session flag grants an exception.
create or replace function public.prevent_shared_walk_in_invoice()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1 from public.customers customer
    where customer.organization_id = new.organization_id and customer.id = new.customer_id
      and customer.customer_code = 'WALKIN-SHARED'
  ) then
    if new.fiscal_document_type is distinct from 'simplificada' then
      raise exception 'billing_registered_customer_required' using errcode = '22023';
    end if;
    if new.customer_name is not null or new.customer_tax_id is not null
      or new.customer_address_line1 is not null or new.customer_address_line2 is not null
      or new.customer_city is not null or new.customer_postal_code is not null
      or new.customer_country_code is not null or new.customer_email is not null then
      raise exception 'billing_simplified_recipient_mismatch' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger invoices_prevent_shared_walk_in
before insert or update of organization_id, customer_id, fiscal_document_type,
  customer_name, customer_tax_id, customer_address_line1, customer_address_line2,
  customer_city, customer_postal_code, customer_country_code, customer_email
on public.invoices
for each row execute function public.prevent_shared_walk_in_invoice();

-- One implementation of the canonical builder. The economic loop/totals below
-- are unchanged from 20261007000200. This internal helper is not an RPC grant;
-- only the fixed-type ordinary wrapper and guarded simplified RPC can call it.
create function public.create_billing_draft_for_type(
  target_order_ids uuid[],
  target_series text,
  target_tax_rate numeric,
  target_notes text,
  target_document_type text
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  org_id uuid := public.app_current_organization_id();
  selected_count integer;
  distinct_customer_count integer;
  distinct_currency_count integer;
  selected_customer_id uuid;
  selected_currency text;
  selected_valid boolean;
  new_invoice_id uuid;
  normalized_series text;
  effective_tax_rate numeric(7,4);
  display_index integer := 0;
  order_row record;
  item_row record;
  item_discount numeric(14,2);
  remaining_discount numeric(14,2);
  item_taxable numeric(14,2);
  item_tax numeric(14,2);
  expected_total numeric(14,2);
  actual_total numeric(14,2);
begin
  if target_document_type is null or target_document_type not in ('ordinaria', 'simplificada') then
    raise exception 'billing_invalid_document_type' using errcode = '22023';
  end if;
  if target_document_type = 'simplificada' and cardinality(target_order_ids) <> 1 then
    raise exception 'billing_invalid_orders' using errcode = '22023';
  end if;
  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'billing_not_authorized' using errcode = '42501';
  end if;

  if target_order_ids is null
    or cardinality(target_order_ids) < 1
    or cardinality(target_order_ids) > 50
    or cardinality(target_order_ids) <> (
      select count(distinct selected_id) from unnest(target_order_ids) selected_id
    )
  then
    raise exception 'billing_invalid_orders' using errcode = '22023';
  end if;

  select
    count(*),
    count(distinct customer_order.customer_id),
    count(distinct customer_order.currency),
    min(customer_order.customer_id::text)::uuid,
    min(customer_order.currency),
    bool_and(customer_order.is_active and customer_order.production_status <> 'cancelled')
  into
    selected_count,
    distinct_customer_count,
    distinct_currency_count,
    selected_customer_id,
    selected_currency,
    selected_valid
  from public.orders customer_order
  where customer_order.organization_id = org_id
    and customer_order.id = any(target_order_ids);

  if selected_count <> cardinality(target_order_ids)
    or distinct_customer_count <> 1
    or distinct_currency_count <> 1
    or not coalesce(selected_valid, false)
  then
    raise exception 'billing_invalid_orders' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.invoice_orders invoice_order
    where invoice_order.order_id = any(target_order_ids)
      and invoice_order.is_active
  ) then
    raise exception 'billing_order_already_invoiced' using errcode = '55000';
  end if;

  select
    upper(btrim(coalesce(target_series, settings.default_series, 'A'))),
    round(coalesce(target_tax_rate, settings.default_tax_rate, 0), 4)
  into normalized_series, effective_tax_rate
  from (select 1) seed
  left join public.organization_billing_settings settings
    on settings.organization_id = org_id;

  if normalized_series !~ '^[A-Z0-9-]{1,12}$'
    or effective_tax_rate < 0
    or effective_tax_rate > 100
  then
    raise exception 'billing_invalid_tax_or_series' using errcode = '22023';
  end if;

  -- Preserve the preparer's distinct-series boundary before any INSERT.
  if target_document_type = 'simplificada' and normalized_series = coalesce((
    select settings.default_series from public.organization_billing_settings settings
    where settings.organization_id = org_id
  ), 'A') then
    raise exception 'billing_series_document_type_conflict' using errcode = '22023';
  end if;

  perform set_config('app.billing_mutation', 'on', true);

  insert into public.invoices (
    organization_id,
    customer_id,
    fiscal_document_type,
    series,
    currency,
    prices_include_tax,
    notes,
    issuer_legal_name,
    issuer_tax_id,
    issuer_address_line1,
    issuer_address_line2,
    issuer_city,
    issuer_region,
    issuer_postal_code,
    issuer_country_code,
    issuer_email,
    issuer_phone,
    issuer_logo_path,
    customer_name,
    customer_tax_id,
    customer_address_line1,
    customer_address_line2,
    customer_city,
    customer_postal_code,
    customer_country_code,
    customer_email,
    created_by,
    updated_by
  )
  select
    org_id,
    customer.id,
    target_document_type,
    normalized_series,
    selected_currency,
    true,
    nullif(btrim(target_notes), ''),
    coalesce(settings.issuer_legal_name, branding.commercial_name, organization.name),
    settings.issuer_tax_id,
    coalesce(settings.issuer_address_line1, branding.business_address),
    settings.issuer_address_line2,
    settings.issuer_city,
    settings.issuer_region,
    settings.issuer_postal_code,
    settings.issuer_country_code,
    coalesce(settings.issuer_email, branding.support_email),
    coalesce(settings.issuer_phone, branding.support_phone),
    branding.logo_path,
    case when target_document_type = 'simplificada' and customer.customer_code = 'WALKIN-SHARED' then null
      else case when customer.customer_type = 'business'
        then coalesce(nullif(customer.company_name, ''), customer.display_name)
        else customer.display_name
      end
    end,
    case when target_document_type = 'simplificada' and customer.customer_code = 'WALKIN-SHARED' then null else customer.tax_id end,
    case when target_document_type = 'simplificada' and customer.customer_code = 'WALKIN-SHARED' then null else customer.billing_address_line1 end,
    case when target_document_type = 'simplificada' and customer.customer_code = 'WALKIN-SHARED' then null else customer.billing_address_line2 end,
    case when target_document_type = 'simplificada' and customer.customer_code = 'WALKIN-SHARED' then null else customer.billing_city end,
    case when target_document_type = 'simplificada' and customer.customer_code = 'WALKIN-SHARED' then null else customer.billing_postal_code end,
    case when target_document_type = 'simplificada' and customer.customer_code = 'WALKIN-SHARED' then null else customer.billing_country_code end,
    case when target_document_type = 'simplificada' and customer.customer_code = 'WALKIN-SHARED' then null else customer.email end,
    actor_id,
    actor_id
  from public.customers customer
  join public.organizations organization on organization.id = org_id
  left join public.organization_billing_settings settings on settings.organization_id = org_id
  left join public.organization_branding branding on branding.organization_id = org_id
  where customer.organization_id = org_id
    and customer.id = selected_customer_id
  returning id into new_invoice_id;

  if new_invoice_id is null then
    raise exception 'billing_invalid_customer' using errcode = '22023';
  end if;

  insert into public.invoice_orders (organization_id, invoice_id, order_id)
  select org_id, new_invoice_id, customer_order.id
  from public.orders customer_order
  where customer_order.organization_id = org_id
    and customer_order.id = any(target_order_ids);

  for order_row in
    select customer_order.id, customer_order.discount_amount, customer_order.subtotal
    from public.orders customer_order
    where customer_order.organization_id = org_id
      and customer_order.id = any(target_order_ids)
    order by customer_order.created_at, customer_order.id
  loop
    if not exists (
      select 1 from public.order_items source_item
      where source_item.organization_id = org_id
        and source_item.order_id = order_row.id
        and source_item.is_active
    ) then
      raise exception 'billing_order_without_items' using errcode = '22023';
    end if;

    remaining_discount := order_row.discount_amount;

    for item_row in
      select
        source_item.*,
        row_number() over (order by source_item.sort_order, source_item.created_at, source_item.id) as item_position,
        count(*) over () as item_count
      from public.order_items source_item
      where source_item.organization_id = org_id
        and source_item.order_id = order_row.id
        and source_item.is_active
      order by source_item.sort_order, source_item.created_at, source_item.id
    loop
      display_index := display_index + 1;
      item_discount := case
        when item_row.item_position = item_row.item_count then remaining_discount
        when order_row.subtotal = 0 then 0
        else least(
          remaining_discount,
          round(order_row.discount_amount * item_row.line_total / order_row.subtotal, 2)
        )
      end;
      remaining_discount := round(remaining_discount - item_discount, 2);
      item_taxable := round((item_row.line_total - item_discount) / (1 + effective_tax_rate / 100), 2);
      item_tax := item_row.line_total - item_discount - item_taxable;

      insert into public.invoice_items (
        organization_id,
        invoice_id,
        source_order_id,
        source_order_item_id,
        description,
        unit_type,
        quantity,
        unit_price,
        line_subtotal,
        discount_amount,
        taxable_base,
        tax_rate,
        tax_amount,
        line_total,
        prices_include_tax,
        display_order
      ) values (
        org_id,
        new_invoice_id,
        order_row.id,
        item_row.id,
        item_row.description,
        item_row.unit_type,
        item_row.quantity,
        item_row.unit_price,
        item_row.line_total,
        item_discount,
        item_taxable,
        effective_tax_rate,
        item_tax,
        item_row.line_total - item_discount,
        true,
        display_index
      );
    end loop;
  end loop;

  update public.invoices invoice
  set subtotal = totals.subtotal,
      discount_total = totals.discount_total,
      taxable_base = totals.taxable_base,
      tax_total = totals.tax_total,
      total = totals.total
  from (
    select
      round(sum(item.line_subtotal), 2) as subtotal,
      round(sum(item.discount_amount), 2) as discount_total,
      round(sum(item.taxable_base), 2) as taxable_base,
      round(sum(item.tax_amount), 2) as tax_total,
      round(sum(item.line_total), 2) as total
    from public.invoice_items item
    where item.organization_id = org_id
      and item.invoice_id = new_invoice_id
  ) totals
  where invoice.organization_id = org_id
    and invoice.id = new_invoice_id;

  select round(sum(customer_order.total), 2)
  into expected_total
  from public.orders customer_order
  where customer_order.organization_id = org_id
    and customer_order.id = any(target_order_ids);

  select invoice.total into actual_total
  from public.invoices invoice
  where invoice.organization_id = org_id and invoice.id = new_invoice_id;

  if actual_total is distinct from expected_total then
    raise exception 'billing_order_total_mismatch' using errcode = '22023';
  end if;

  return new_invoice_id;
exception when unique_violation then
  raise exception 'billing_order_already_invoiced' using errcode = '55000';
end;
$$;

-- Preserve the public ordinary signature/OID and always select ordinary type.
create or replace function public.create_billing_draft(
  target_order_ids uuid[],
  target_series text default null,
  target_tax_rate numeric default null,
  target_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.create_billing_draft_for_type(
    target_order_ids, target_series, target_tax_rate, target_notes, 'ordinaria'
  );
end;
$$;

create or replace function public.create_simplified_billing_draft(
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
    -- Insert the real type and recipient snapshot atomically. The same
    -- canonical builder owns all line/discount/IGIC calculations for both types.
    draft_id := public.create_billing_draft_for_type(
      array[target_order_id], normalized_series, null, null, 'simplificada'
    );
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

-- No caller-controlled GUC/default/extra public argument can choose the type.
revoke all on function public.create_billing_draft_for_type(uuid[], text, numeric, text, text) from public, anon, authenticated;
revoke all on function public.prevent_shared_walk_in_invoice() from public, anon, authenticated;
-- CREATE OR REPLACE retains the existing grants of both public RPCs.
commit;
