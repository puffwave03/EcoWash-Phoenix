-- FISCAL-ISSUED-ORDER-CANCEL-GATE-001
-- Historical cancellations/documents are not rewritten. No corrective fiscal
-- workflow is approved: even a cancelled issued invoice is fiscal history.
begin;
set local lock_timeout = '5s';

create function public.guard_order_fiscal_cancellation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- The updating transaction already owns the order row lock. This function
  -- deliberately takes NO invoice/payment/counter locks (no inverse lock order).
  -- A fresh snapshot after an issuer's order lock is essential: locking alone
  -- would not refresh a REPEATABLE READ/Serializable snapshot.
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'order_fiscal_cancellation_conflict' using errcode = '40001';
  end if;

  if exists (
    select 1
    from public.invoice_orders l
    join public.invoices i
      on i.organization_id = l.organization_id and i.id = l.invoice_id
    where l.organization_id = old.organization_id
      and l.order_id = old.id
      -- Deliberately no is_active filter, payment test, or REC/albaran check.
      and (i.document_status in ('issued', 'cancelled') or i.issued_at is not null)
  ) then
    raise exception 'order_fiscal_cancellation_blocked' using errcode = '55000';
  end if;
  return new;
end;
$$;

-- Applies to the canonical RPC AND direct UPDATE; workflow flags cannot bypass
-- it. Unchanged cancelled rows and other transitions remain outside this gate.
create trigger orders_fiscal_cancellation_guard
before update of production_status on public.orders
for each row
when (new.production_status = 'cancelled' and old.production_status is distinct from new.production_status)
execute function public.guard_order_fiscal_cancellation();

revoke all on function public.guard_order_fiscal_cancellation()
  from public, anon, authenticated;

-- Canonical ordinary overload copied from 20261018000100, with only the
-- order-lock prelude and association recheck added. Existing ACLs are preserved;
-- numbering, snapshots, permissions, simplified replay and financial writes
-- retain their original bodies. Other issuance overloads already lock orders.
create or replace function public.issue_billing_invoice(target_invoice_id uuid)
returns table (invoice_id uuid, invoice_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  org_id uuid := public.app_current_organization_id();
  invoice_row public.invoices%rowtype;
  customer_row public.customers%rowtype;
  settings_row public.organization_billing_settings%rowtype;
  allocated_sequence bigint;
  allocated_number text;
  item_totals record;
  locked_order_ids uuid[] := array[]::uuid[];
  linked_order_ids uuid[];
  source_order record;
begin
  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'billing_not_authorized' using errcode = '42501';
  end if;

  -- FISCAL-ISSUED-ORDER-CANCEL-GATE-001: new ordinary issuance must
  -- serialize with cancellation BEFORE taking the invoice/counter locks.
  -- Simplified terminal replay keeps its original invoice-only path.
  select * into invoice_row
  from public.invoices invoice
  where invoice.organization_id = org_id
    and invoice.id = target_invoice_id;

  if invoice_row.fiscal_document_type = 'ordinary'
    and invoice_row.document_status = 'draft' then
    if current_setting('transaction_isolation') <> 'read committed' then
      raise exception 'billing_order_read_committed_required' using errcode = '25000';
    end if;

    -- Match existing order -> invoice issuance; deterministic for multi-order
    -- invoices. Never lock invoice rows from the order cancellation trigger.
    for source_order in
      select o.id from public.orders o
      where o.organization_id = org_id and exists (
        select 1 from public.invoice_orders l
        where l.organization_id = org_id and l.invoice_id = target_invoice_id
          and l.order_id = o.id
      )
      order by o.id for update of o
    loop
      locked_order_ids := array_append(locked_order_ids, source_order.id);
    end loop;
  end if;

  select * into invoice_row
  from public.invoices invoice
  where invoice.organization_id = org_id
    and invoice.id = target_invoice_id
  for update;

  if invoice_row.fiscal_document_type = 'simplified' then
    if not public.organization_entitlement_is_enabled(org_id,'billing.invoicing',now()) then
      raise exception 'billing_not_authorized' using errcode = '42501';
    end if;
    if invoice_row.document_status = 'issued' then
      return query select invoice_row.id, invoice_row.invoice_number;
      return;
    end if;
    raise exception 'billing_simplified_declaration_required' using errcode = '22023';
  end if;

  if invoice_row.id is null or invoice_row.document_status <> 'draft' then
    raise exception 'billing_invalid_draft' using errcode = '22023';
  end if;

  -- Recheck the association after waiting for locks. Do not follow a changed
  -- association while holding an invoice lock: fail without allocating a number.
  select coalesce(array_agg(l.order_id order by l.order_id), array[]::uuid[])
  into linked_order_ids
  from public.invoice_orders l
  where l.organization_id = org_id and l.invoice_id = target_invoice_id;
  if cardinality(locked_order_ids) = 0
    or linked_order_ids is distinct from locked_order_ids then
    raise exception 'billing_invalid_orders' using errcode = '22023';
  end if;

  select * into settings_row
  from public.organization_billing_settings settings
  where settings.organization_id = org_id;

  if settings_row.organization_id is null
    or nullif(btrim(settings_row.issuer_legal_name), '') is null
    or nullif(btrim(settings_row.issuer_tax_id), '') is null
    or nullif(btrim(settings_row.issuer_address_line1), '') is null
    or nullif(btrim(settings_row.issuer_city), '') is null
    or nullif(btrim(settings_row.issuer_postal_code), '') is null
    or settings_row.issuer_country_code is null
  then
    raise exception 'billing_issuer_configuration_required' using errcode = '22023';
  end if;

  select * into customer_row
  from public.customers customer
  where customer.organization_id = org_id
    and customer.id = invoice_row.customer_id;

  if customer_row.id is null
    or nullif(btrim(customer_row.display_name), '') is null
    or nullif(btrim(customer_row.billing_address_line1), '') is null
    or nullif(btrim(customer_row.billing_city), '') is null
    or nullif(btrim(customer_row.billing_postal_code), '') is null
    or customer_row.billing_country_code is null
    or (
      customer_row.customer_type = 'business'
      and (
        nullif(btrim(coalesce(customer_row.company_name, customer_row.display_name)), '') is null
        or nullif(btrim(customer_row.tax_id), '') is null
      )
    )
  then
    raise exception 'billing_customer_configuration_required' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.invoice_orders invoice_order
    where invoice_order.organization_id = org_id
      and invoice_order.invoice_id = target_invoice_id
      and invoice_order.is_active
  ) or exists (
    select 1
    from public.invoice_orders invoice_order
    join public.orders customer_order
      on customer_order.organization_id = invoice_order.organization_id
     and customer_order.id = invoice_order.order_id
    where invoice_order.organization_id = org_id
      and invoice_order.invoice_id = target_invoice_id
      and (
        not invoice_order.is_active
        or customer_order.customer_id <> invoice_row.customer_id
        or customer_order.currency <> invoice_row.currency
        or not customer_order.is_active
        or customer_order.production_status = 'cancelled'
      )
  ) then
    raise exception 'billing_invalid_orders' using errcode = '22023';
  end if;

  select
    count(*) as item_count,
    count(*) filter (where item.prices_include_tax is distinct from invoice_row.prices_include_tax) as mode_mismatch_count,
    round(sum(item.line_subtotal), 2) as subtotal,
    round(sum(item.discount_amount), 2) as discount_total,
    round(sum(item.taxable_base), 2) as taxable_base,
    round(sum(item.tax_amount), 2) as tax_total,
    round(sum(item.line_total), 2) as total
  into item_totals
  from public.invoice_items item
  where item.organization_id = org_id
    and item.invoice_id = target_invoice_id;

  if item_totals.item_count < 1
    or item_totals.mode_mismatch_count > 0
    or (invoice_row.prices_include_tax and (
      invoice_row.total <> invoice_row.subtotal - invoice_row.discount_total
      or invoice_row.total <> invoice_row.taxable_base + invoice_row.tax_total
    ))
    or item_totals.subtotal <> invoice_row.subtotal
    or item_totals.discount_total <> invoice_row.discount_total
    or item_totals.taxable_base <> invoice_row.taxable_base
    or item_totals.tax_total <> invoice_row.tax_total
    or item_totals.total <> invoice_row.total
  then
    raise exception 'billing_totals_invalid' using errcode = '22023';
  end if;

  insert into public.billing_invoice_number_counters (
    organization_id,
    series,
    next_value
  ) values (
    org_id,
    invoice_row.series,
    2
  )
  on conflict (organization_id, series)
  do update set
    next_value = public.billing_invoice_number_counters.next_value + 1,
    updated_at = now()
  returning next_value - 1 into allocated_sequence;

  allocated_number := extract(year from invoice_row.issue_date)::integer::text
    || '-' || invoice_row.series
    || '-' || lpad(allocated_sequence::text, 6, '0');

  perform set_config('app.billing_mutation', 'on', true);

  update public.invoices invoice
  set invoice_number = allocated_number,
      sequence_number = allocated_sequence,
      document_status = 'issued',
      issuer_legal_name = settings_row.issuer_legal_name,
      issuer_tax_id = settings_row.issuer_tax_id,
      issuer_address_line1 = settings_row.issuer_address_line1,
      issuer_address_line2 = settings_row.issuer_address_line2,
      issuer_city = settings_row.issuer_city,
      issuer_region = settings_row.issuer_region,
      issuer_postal_code = settings_row.issuer_postal_code,
      issuer_country_code = settings_row.issuer_country_code,
      issuer_email = settings_row.issuer_email,
      issuer_phone = settings_row.issuer_phone,
      issuer_logo_path = branding.logo_path,
      customer_name = case when customer_row.customer_type = 'business'
        then coalesce(nullif(customer_row.company_name, ''), customer_row.display_name)
        else customer_row.display_name
      end,
      customer_tax_id = customer_row.tax_id,
      customer_address_line1 = customer_row.billing_address_line1,
      customer_address_line2 = customer_row.billing_address_line2,
      customer_city = customer_row.billing_city,
      customer_postal_code = customer_row.billing_postal_code,
      customer_country_code = customer_row.billing_country_code,
      customer_email = customer_row.email,
      issued_at = now(),
      updated_by = actor_id
  from public.organization_branding branding
  where invoice.organization_id = org_id
    and invoice.id = target_invoice_id
    and branding.organization_id = org_id;

  if not found then
    update public.invoices invoice
    set invoice_number = allocated_number,
        sequence_number = allocated_sequence,
        document_status = 'issued',
        issuer_legal_name = settings_row.issuer_legal_name,
        issuer_tax_id = settings_row.issuer_tax_id,
        issuer_address_line1 = settings_row.issuer_address_line1,
        issuer_address_line2 = settings_row.issuer_address_line2,
        issuer_city = settings_row.issuer_city,
        issuer_region = settings_row.issuer_region,
        issuer_postal_code = settings_row.issuer_postal_code,
        issuer_country_code = settings_row.issuer_country_code,
        issuer_email = settings_row.issuer_email,
        issuer_phone = settings_row.issuer_phone,
        customer_name = case when customer_row.customer_type = 'business'
          then coalesce(nullif(customer_row.company_name, ''), customer_row.display_name)
          else customer_row.display_name
        end,
        customer_tax_id = customer_row.tax_id,
        customer_address_line1 = customer_row.billing_address_line1,
        customer_address_line2 = customer_row.billing_address_line2,
        customer_city = customer_row.billing_city,
        customer_postal_code = customer_row.billing_postal_code,
        customer_country_code = customer_row.billing_country_code,
        customer_email = customer_row.email,
        issued_at = now(),
        updated_by = actor_id
    where invoice.organization_id = org_id
      and invoice.id = target_invoice_id;
  end if;

  return query select target_invoice_id, allocated_number;
end;
$$;

commit;
