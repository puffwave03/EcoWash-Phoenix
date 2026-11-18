-- BILLING-SIMPLIFIED-CORE-001: preparatory Billing drafts only.
-- No fiscal activation, numbering allocation, payment or receipt conversion.
begin;

alter table public.invoices
  add column fiscal_document_type text not null default 'ordinaria',
  alter column customer_name drop not null,
  add constraint invoices_fiscal_document_type_valid
    check (fiscal_document_type in ('ordinaria', 'simplificada')),
  add constraint invoices_ordinary_recipient_required
    check (fiscal_document_type <> 'ordinaria' or customer_name is not null),
  -- Deliberately closed until fiscal eligibility/treatment and presentation
  -- have their own approved implementation. This also rolls back an attempted
  -- canonical issue, including its counter allocation, in the same transaction.
  add constraint invoices_simplified_fiscal_use_disabled
    check (fiscal_document_type <> 'simplificada' or document_status = 'draft'),
  add constraint invoices_omitted_recipient_consistent check (
    customer_name is not null or (
      customer_tax_id is null and customer_address_line1 is null
      and customer_address_line2 is null and customer_city is null
      and customer_postal_code is null and customer_country_code is null
      and customer_email is null
    )
  );

create function public.protect_billing_fiscal_document_type()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if old.document_status <> 'draft'
      and new.fiscal_document_type is distinct from old.fiscal_document_type
    then
      raise exception 'billing_issued_snapshot_immutable' using errcode = '55000';
    end if;
    if old.fiscal_document_type = 'simplificada'
      and new.fiscal_document_type <> 'simplificada'
    then
      raise exception 'billing_simplified_conversion_forbidden' using errcode = '55000';
    end if;
  end if;

  if new.fiscal_document_type = 'simplificada' and new.document_status <> 'draft' then
    raise exception 'billing_simplified_fiscal_use_disabled' using errcode = '55000';
  end if;

  -- Serialize changes to the series/type association within the tenant. The
  -- existing Billing counters and unique numbering indexes remain authoritative.
  if tg_op = 'UPDATE' then
    if new.series is not distinct from old.series
      and new.fiscal_document_type is not distinct from old.fiscal_document_type
    then
      return new;
    end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text || ':billing-series-type', 0));
  if exists (
    select 1 from public.invoices invoice
    where invoice.organization_id = new.organization_id
      and invoice.series = new.series
      and invoice.id <> new.id
      and invoice.fiscal_document_type <> new.fiscal_document_type
  ) then
    raise exception 'billing_series_document_type_conflict' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger invoices_fiscal_document_type_guard
before insert or update on public.invoices
for each row execute function public.protect_billing_fiscal_document_type();

-- Prepare an existing canonical draft. Creation, item snapshots, inclusive tax
-- extraction, discount allocation and order reconciliation stay in
-- create_billing_draft. No new invoice or alternate calculation engine is added.
create function public.prepare_simplified_billing_draft(
  target_invoice_id uuid,
  target_series text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid := public.app_current_organization_id();
  invoice_row public.invoices%rowtype;
  normalized_series text := upper(btrim(target_series));
  omit_recipient boolean;
begin
  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'billing_not_authorized' using errcode = '42501';
  end if;
  if not public.organization_entitlement_is_enabled(org_id, 'billing.invoicing', now()) then
    raise exception 'billing_entitlement_required' using errcode = '42501';
  end if;

  select * into invoice_row from public.invoices invoice
  where invoice.organization_id = org_id and invoice.id = target_invoice_id
  for update;
  if invoice_row.id is null or invoice_row.document_status <> 'draft' then
    raise exception 'billing_invalid_draft' using errcode = '22023';
  end if;
  if normalized_series is null or normalized_series !~ '^[A-Z0-9-]{1,12}$' then
    raise exception 'billing_invalid_tax_or_series' using errcode = '22023';
  end if;
  if normalized_series = coalesce((
    select settings.default_series from public.organization_billing_settings settings
    where settings.organization_id = org_id
  ), 'A') or (
    invoice_row.fiscal_document_type = 'ordinaria' and normalized_series = invoice_row.series
  ) then
    raise exception 'billing_series_document_type_conflict' using errcode = '22023';
  end if;
  if not invoice_row.prices_include_tax or not exists (
    select 1 from public.invoice_items item
    where item.organization_id = org_id and item.invoice_id = target_invoice_id
  ) or exists (
    select 1 from public.invoice_items item
    where item.organization_id = org_id and item.invoice_id = target_invoice_id
      and not item.prices_include_tax
  ) or (
    select count(distinct item.tax_rate) from public.invoice_items item
    where item.organization_id = org_id and item.invoice_id = target_invoice_id
  ) <> 1 then
    raise exception 'billing_simplified_tax_model_unsupported' using errcode = '22023';
  end if;

  select customer.customer_code = 'WALKIN-SHARED' into omit_recipient
  from public.customers customer
  where customer.organization_id = org_id and customer.id = invoice_row.customer_id;
  if not found then
    raise exception 'billing_invalid_customer' using errcode = '22023';
  end if;

  perform set_config('app.billing_mutation', 'on', true);
  update public.invoices invoice
  set fiscal_document_type = 'simplificada',
      series = normalized_series,
      -- The shared operational customer remains the canonical order relation;
      -- its technical label must never become a fiscal recipient identity.
      customer_name = case when omit_recipient then null else invoice.customer_name end,
      customer_tax_id = case when omit_recipient then null else invoice.customer_tax_id end,
      customer_address_line1 = case when omit_recipient then null else invoice.customer_address_line1 end,
      customer_address_line2 = case when omit_recipient then null else invoice.customer_address_line2 end,
      customer_city = case when omit_recipient then null else invoice.customer_city end,
      customer_postal_code = case when omit_recipient then null else invoice.customer_postal_code end,
      customer_country_code = case when omit_recipient then null else invoice.customer_country_code end,
      customer_email = case when omit_recipient then null else invoice.customer_email end,
      updated_by = auth.uid()
  where invoice.organization_id = org_id and invoice.id = target_invoice_id;
  return target_invoice_id;
end;
$$;

revoke all on function public.protect_billing_fiscal_document_type() from public, anon, authenticated;
revoke all on function public.prepare_simplified_billing_draft(uuid, text) from public, anon, authenticated;
grant execute on function public.prepare_simplified_billing_draft(uuid, text) to authenticated;

commit;
