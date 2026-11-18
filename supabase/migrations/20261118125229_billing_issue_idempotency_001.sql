-- BILLING-ISSUE-IDEMPOTENCY-001
-- Recover the result of the same authorized invoice issuance without writing.
-- The draft path, signature, lock, grants and historical documents are unchanged.
-- CREATE OR REPLACE preserves the existing function owner and EXECUTE privileges.
begin;

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
begin
  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'billing_not_authorized' using errcode = '42501';
  end if;

  select * into invoice_row
  from public.invoices invoice
  where invoice.organization_id = org_id
    and invoice.id = target_invoice_id
  for update;

  -- The only request argument is the invoice UUID. Together with the current
  -- authorized tenant, it identifies one issuance: issued number/series and
  -- financial/identity snapshots are protected by the existing constraints
  -- and triggers. There is no replacement payload to accept on this path.
  if invoice_row.document_status = 'issued' then
    -- A read-only retry does not fire invoices_require_entitlement. Preserve
    -- that existing issue-time gate explicitly before returning any result.
    if not public.organization_entitlement_is_enabled(org_id, 'billing.invoicing', now()) then
      raise exception 'billing_entitlement_required' using errcode = '42501';
    end if;

    return query select invoice_row.id, invoice_row.invoice_number;
    return;
  end if;

  if invoice_row.id is null or invoice_row.document_status <> 'draft' then
    raise exception 'billing_invalid_draft' using errcode = '22023';
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
