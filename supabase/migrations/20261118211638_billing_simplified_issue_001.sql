-- BILLING-SIMPLIFIED-ISSUE-001. Proposed only: PostgreSQL validation is required
-- before application. No payment, REC, Accounting or operator UI activation.
begin;

-- Retain the complete ordinary implementation (and its OID/dependencies), but
-- remove direct client execution so it cannot bypass the type dispatcher.
alter function public.issue_billing_invoice(uuid) rename to issue_ordinary_billing_invoice;
revoke all on function public.issue_ordinary_billing_invoice(uuid) from public, anon, authenticated;

alter table public.invoices drop constraint invoices_simplified_fiscal_use_disabled;
alter table public.invoices add constraint invoices_simplified_state_valid
  check (fiscal_document_type <> 'simplificada' or document_status in ('draft', 'issued'));

create or replace function public.protect_billing_fiscal_document_type()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if old.document_status <> 'draft'
      and new.fiscal_document_type is distinct from old.fiscal_document_type then
      raise exception 'billing_issued_snapshot_immutable' using errcode = '55000';
    end if;
    if old.fiscal_document_type = 'simplificada' and new.fiscal_document_type <> 'simplificada' then
      raise exception 'billing_simplified_conversion_forbidden' using errcode = '55000';
    end if;
    -- All persisted simplified fields, including contact/logo/date fields, are
    -- immutable after issue. Cancellation/correction is a separate mission.
    if old.fiscal_document_type = 'simplificada' and old.document_status = 'issued'
      and new is distinct from old then
      raise exception 'billing_issued_snapshot_immutable' using errcode = '55000';
    end if;
  end if;
  if new.fiscal_document_type = 'simplificada' and new.document_status not in ('draft', 'issued') then
    raise exception 'billing_simplified_state_invalid' using errcode = '55000';
  end if;
  if tg_op = 'UPDATE' then
    if new.series is not distinct from old.series
      and new.fiscal_document_type is not distinct from old.fiscal_document_type then
      return new;
    end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text || ':billing-series-type', 0));
  if exists (
    select 1 from public.invoices invoice
    where invoice.organization_id = new.organization_id and invoice.series = new.series
      and invoice.id <> new.id and invoice.fiscal_document_type <> new.fiscal_document_type
  ) then
    raise exception 'billing_series_document_type_conflict' using errcode = '22023';
  end if;
  return new;
end;
$$;

-- A child write must not pass a draft-status check and commit after issuance.
-- Lock both old/new parents, including while a draft changes document type.
-- Ordinary acceptance/rejection rules remain in the existing child trigger.
create function public.lock_billing_simplified_snapshot_parent()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_id uuid;
  parent public.invoices%rowtype;
begin
  for parent_id in select distinct value from unnest(array[
    case when tg_op <> 'INSERT' then old.invoice_id end,
    case when tg_op <> 'DELETE' then new.invoice_id end
  ]) value where value is not null order by value
  loop
    select * into parent from public.invoices invoice where invoice.id = parent_id for share;
    if parent.fiscal_document_type = 'simplificada' and parent.document_status <> 'draft' then
      raise exception 'billing_issued_snapshot_immutable' using errcode = '55000';
    end if;
  end loop;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger invoice_items_simplified_snapshot_lock
before insert or update or delete on public.invoice_items
for each row execute function public.lock_billing_simplified_snapshot_parent();
create trigger invoice_orders_simplified_snapshot_lock
before insert or update or delete on public.invoice_orders
for each row execute function public.lock_billing_simplified_snapshot_parent();

create function public.issue_billing_invoice(target_invoice_id uuid)
returns table (invoice_id uuid, invoice_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid := public.app_current_organization_id();
  invoice_row public.invoices%rowtype;
  target_order_id uuid;
  prepared_id uuid;
  linked_count integer;
  allocated_sequence bigint;
  allocated_number text;
  issue_time timestamptz;
  fiscal_date date;
  org_timezone text;
begin
  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'billing_not_authorized' using errcode = '42501';
  end if;
  select * into invoice_row from public.invoices invoice
  where invoice.organization_id = org_id and invoice.id = target_invoice_id;
  if invoice_row.id is null or invoice_row.fiscal_document_type = 'ordinaria' then
    -- The ordinary body is unchanged. Lock before dispatch so concurrent draft
    -- preparation cannot turn an ordinary call into a simplified bypass.
    select * into invoice_row from public.invoices invoice
    where invoice.organization_id = org_id and invoice.id = target_invoice_id for update;
    if invoice_row.id is not null and invoice_row.fiscal_document_type <> 'ordinaria' then
      raise exception 'billing_document_type_changed' using errcode = '55000';
    end if;
    return query select * from public.issue_ordinary_billing_invoice(target_invoice_id);
    return;
  end if;
  if auth.uid() is null or not public.organization_entitlement_is_enabled(org_id, 'billing.invoicing', now()) then
    raise exception 'billing_entitlement_required' using errcode = '42501';
  end if;
  perform public.require_pos_access(org_id);

  if invoice_row.document_status <> 'issued' then
    select count(*), min(link.order_id::text)::uuid into linked_count, target_order_id
    from public.invoice_orders link
    where link.organization_id = org_id and link.invoice_id = target_invoice_id and link.is_active;
    if linked_count <> 1 then
      raise exception 'billing_simplified_draft_incompatible' using errcode = '55000';
    end if;
    -- Same order-first serialization as create_simplified_billing_draft.
    perform 1 from public.orders customer_order
    where customer_order.organization_id = org_id and customer_order.id = target_order_id for update;
  end if;
  select * into invoice_row from public.invoices invoice
  where invoice.organization_id = org_id and invoice.id = target_invoice_id for update;
  if invoice_row.id is null or invoice_row.fiscal_document_type <> 'simplificada' then
    raise exception 'billing_invalid_draft' using errcode = '22023';
  end if;
  if invoice_row.document_status = 'issued' then
    -- Retry is retrieval of the immutable fact, even after a later refund.
    return query select invoice_row.id, invoice_row.invoice_number;
    return;
  end if;
  if invoice_row.document_status <> 'draft' then
    raise exception 'billing_invalid_draft' using errcode = '22023';
  end if;
  -- This must be an existing active draft for that same order. Holding its
  -- row lock prevents deletion/replacement; the canonical preparer cannot
  -- create an alternate invoice here. It validates source lines, inclusive
  -- single-rate totals, recipient, POS sessions/actors/refunds and full balance,
  -- and holds the payment originals against concurrent POS refunds.
  if not exists (
    select 1 from public.invoice_orders link where link.organization_id = org_id
      and link.invoice_id = target_invoice_id and link.order_id = target_order_id and link.is_active
  ) then
    raise exception 'billing_simplified_draft_incompatible' using errcode = '55000';
  end if;
  prepared_id := public.create_simplified_billing_draft(target_order_id, invoice_row.series);
  if prepared_id is distinct from target_invoice_id then
    raise exception 'billing_simplified_draft_incompatible' using errcode = '55000';
  end if;
  if nullif(btrim(invoice_row.issuer_legal_name), '') is null
    or nullif(btrim(invoice_row.issuer_tax_id), '') is null
    or nullif(btrim(invoice_row.issuer_address_line1), '') is null
    or nullif(btrim(invoice_row.issuer_city), '') is null
    or nullif(btrim(invoice_row.issuer_postal_code), '') is null
    or nullif(btrim(invoice_row.issuer_country_code), '') is null then
    raise exception 'billing_issuer_configuration_required' using errcode = '22023';
  end if;
  if exists (select 1 from public.invoice_items item where item.organization_id = org_id
    and item.invoice_id = target_invoice_id and nullif(btrim(item.description), '') is null) then
    raise exception 'billing_simplified_draft_incompatible' using errcode = '55000';
  end if;
  if invoice_row.series = coalesce((select settings.default_series from public.organization_billing_settings settings
      where settings.organization_id = org_id), 'A') or exists (
    select 1 from public.invoices other where other.organization_id = org_id
      and other.series = invoice_row.series and other.fiscal_document_type <> 'simplificada'
  ) then
    raise exception 'billing_series_document_type_conflict' using errcode = '22023';
  end if;
  select organization.timezone into org_timezone from public.organizations organization where organization.id = org_id;
  if not exists (select 1 from pg_timezone_names zone where zone.name = org_timezone) then
    raise exception 'billing_invalid_timezone' using errcode = '22023';
  end if;
  issue_time := clock_timestamp();
  fiscal_date := (issue_time at time zone org_timezone)::date;
  if invoice_row.due_date < fiscal_date then
    raise exception 'billing_invalid_draft' using errcode = '22023';
  end if;

  -- Existing canonical counter, uniqueness indexes and number format. This is
  -- the only allocation, and a later error rolls it back with the whole issue.
  insert into public.billing_invoice_number_counters (organization_id, series, next_value)
  values (org_id, invoice_row.series, 2)
  on conflict (organization_id, series) do update
    set next_value = public.billing_invoice_number_counters.next_value + 1, updated_at = now()
  returning next_value - 1 into allocated_sequence;
  allocated_number := extract(year from fiscal_date)::integer::text || '-' || invoice_row.series
    || '-' || lpad(allocated_sequence::text, 6, '0');
  perform set_config('app.billing_mutation', 'on', true);
  update public.invoices invoice
  set document_status = 'issued', invoice_number = allocated_number, sequence_number = allocated_sequence,
    issue_date = fiscal_date, issued_at = issue_time, updated_by = auth.uid()
  where invoice.organization_id = org_id and invoice.id = target_invoice_id;
  return query select target_invoice_id, allocated_number;
end;
$$;

revoke all on function public.lock_billing_simplified_snapshot_parent() from public, anon, authenticated;
revoke all on function public.issue_billing_invoice(uuid) from public, anon, authenticated;
grant execute on function public.issue_billing_invoice(uuid) to authenticated;

commit;
