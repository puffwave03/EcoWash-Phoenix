-- ACCOUNTING-SALES-DOCUMENTS-001: persistent operational receipts and append-only document access history.
-- Accounting, payment, refund and canonical Billing facts remain unchanged.

create type public.operational_receipt_status as enum ('issued', 'cancelled');
create type public.sales_document_kind as enum ('receipt', 'invoice');
create type public.sales_document_event_type as enum ('viewed', 'print_requested');

create table public.operational_receipt_number_counters (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sequence_year integer not null,
  series text not null,
  next_value bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (organization_id, sequence_year, series),
  constraint operational_receipt_counter_year_valid check (sequence_year between 2000 and 9999),
  constraint operational_receipt_counter_series_valid check (series ~ '^[A-Z0-9-]{1,12}$'),
  constraint operational_receipt_counter_next_valid check (next_value >= 1)
);

create table public.operational_receipts (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  order_id uuid not null,
  customer_id uuid not null,
  receipt_number text not null,
  series text not null,
  sequence_year integer not null,
  sequence_number bigint not null,
  document_status public.operational_receipt_status not null default 'issued',
  issued_at timestamptz not null,
  cancelled_at timestamptz,
  cancellation_reason text,
  currency text not null,
  amount numeric(14,2) not null,
  snapshot_version integer not null default 1,
  snapshot jsonb not null,
  created_by uuid references public.profiles (id) on delete set null,
  cancelled_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint operational_receipts_order_same_org foreign key (organization_id, order_id)
    references public.orders (organization_id, id) on delete restrict,
  constraint operational_receipts_customer_same_org foreign key (organization_id, customer_id)
    references public.customers (organization_id, id) on delete restrict,
  constraint operational_receipts_org_id_unique unique (organization_id, id),
  constraint operational_receipts_number_unique unique (organization_id, receipt_number),
  constraint operational_receipts_sequence_unique unique (organization_id, sequence_year, series, sequence_number),
  constraint operational_receipts_series_valid check (series ~ '^[A-Z0-9-]{1,12}$'),
  constraint operational_receipts_year_valid check (sequence_year between 2000 and 9999),
  constraint operational_receipts_sequence_valid check (sequence_number >= 1),
  constraint operational_receipts_currency_valid check (currency = upper(currency) and length(currency) = 3),
  constraint operational_receipts_amount_valid check (amount >= 0),
  constraint operational_receipts_snapshot_valid check (snapshot_version = 1 and jsonb_typeof(snapshot) = 'object'),
  constraint operational_receipts_status_valid check (
    (document_status = 'issued' and cancelled_at is null and cancellation_reason is null and cancelled_by is null)
    or
    (document_status = 'cancelled' and cancelled_at is not null and length(btrim(cancellation_reason)) > 0)
  )
);

create unique index operational_receipts_issued_order_unique
on public.operational_receipts (organization_id, order_id)
where document_status = 'issued';

create index operational_receipts_registry_idx
on public.operational_receipts (organization_id, issued_at desc, id);

create table public.sales_document_events (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  document_kind public.sales_document_kind not null,
  receipt_id uuid,
  invoice_id uuid,
  event_type public.sales_document_event_type not null,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint sales_document_events_target_valid check (
    (document_kind = 'receipt' and receipt_id is not null and invoice_id is null)
    or (document_kind = 'invoice' and invoice_id is not null and receipt_id is null)
  ),
  constraint sales_document_events_receipt_same_org foreign key (organization_id, receipt_id)
    references public.operational_receipts (organization_id, id) on delete restrict,
  constraint sales_document_events_invoice_same_org foreign key (organization_id, invoice_id)
    references public.invoices (organization_id, id) on delete restrict
);

create index sales_document_events_document_idx
on public.sales_document_events (organization_id, document_kind, receipt_id, invoice_id, created_at desc);

create function public.protect_operational_receipt_history()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'operational_receipt_delete_forbidden' using errcode = '55000';
  end if;
  if coalesce(current_setting('app.operational_receipt_mutation', true), '') <> 'on'
    or old.document_status <> 'issued'
    or new.document_status <> 'cancelled'
    or new.organization_id is distinct from old.organization_id
    or new.order_id is distinct from old.order_id
    or new.customer_id is distinct from old.customer_id
    or new.receipt_number is distinct from old.receipt_number
    or new.series is distinct from old.series
    or new.sequence_year is distinct from old.sequence_year
    or new.sequence_number is distinct from old.sequence_number
    or new.issued_at is distinct from old.issued_at
    or new.currency is distinct from old.currency
    or new.amount is distinct from old.amount
    or new.snapshot_version is distinct from old.snapshot_version
    or new.snapshot is distinct from old.snapshot
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  then
    raise exception 'operational_receipt_snapshot_immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger operational_receipts_immutable
before update or delete on public.operational_receipts
for each row execute function public.protect_operational_receipt_history();

create function public.protect_sales_document_event_history()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'sales_document_events_append_only' using errcode = '55000';
end;
$$;

create trigger sales_document_events_append_only
before update or delete on public.sales_document_events
for each row execute function public.protect_sales_document_event_history();

create function public.issue_operational_receipt(target_order_id uuid)
returns table (receipt_id uuid, receipt_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  org_id uuid := public.app_current_organization_id();
  order_row public.orders%rowtype;
  customer_row public.customers%rowtype;
  organization_row public.organizations%rowtype;
  location_row public.locations%rowtype;
  branding_row public.organization_branding%rowtype;
  existing_receipt public.operational_receipts%rowtype;
  allocated_sequence bigint;
  allocated_number text;
  receipt_series text := 'REC';
  receipt_year integer;
  issued_time timestamptz := now();
  items_snapshot jsonb;
  methods_snapshot jsonb;
  paid_total numeric(14,2);
  result_id uuid;
begin
  if org_id is null
    or not public.has_operational_capability(org_id, 'pos'::public.operational_capability)
    or not public.organization_entitlement_is_enabled(org_id, 'printing', issued_time)
  then
    raise exception 'operational_receipt_not_authorized' using errcode = '42501';
  end if;

  select * into order_row
  from public.orders target_order
  where target_order.organization_id = org_id and target_order.id = target_order_id
  for update;

  if order_row.id is null or not order_row.is_active or order_row.production_status = 'cancelled' then
    raise exception 'operational_receipt_order_invalid' using errcode = '22023';
  end if;

  select * into existing_receipt
  from public.operational_receipts receipt
  where receipt.organization_id = org_id
    and receipt.order_id = target_order_id
    and receipt.document_status = 'issued';
  if existing_receipt.id is not null then
    return query select existing_receipt.id, existing_receipt.receipt_number;
    return;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', item.id,
    'description', item.description,
    'unitType', item.unit_type,
    'quantity', item.quantity,
    'unitPrice', item.unit_price,
    'lineTotal', item.line_total,
    'notes', item.notes,
    'sortOrder', item.sort_order
  ) order by item.sort_order, item.id), '[]'::jsonb)
  into items_snapshot
  from public.order_items item
  where item.organization_id = org_id and item.order_id = target_order_id and item.is_active;

  if jsonb_array_length(items_snapshot) = 0 then
    raise exception 'operational_receipt_items_required' using errcode = '22023';
  end if;

  select coalesce(sum(case when payment.status = 'confirmed' then payment.amount when payment.status = 'refunded' then -payment.amount else 0 end), 0)
  into paid_total
  from public.payments payment
  where payment.organization_id = org_id and payment.order_id = target_order_id
    and payment.status in ('confirmed', 'refunded');

  select coalesce(jsonb_object_agg(method_total.method, method_total.amount), '{}'::jsonb)
  into methods_snapshot
  from (
    select payment.method::text as method,
      round(sum(case when payment.status = 'confirmed' then payment.amount when payment.status = 'refunded' then -payment.amount else 0 end), 2) as amount
    from public.payments payment
    where payment.organization_id = org_id and payment.order_id = target_order_id
      and payment.status in ('confirmed', 'refunded')
    group by payment.method
  ) method_total;

  paid_total := round(greatest(coalesce(paid_total, 0), 0), 2);
  select * into customer_row from public.customers customer
    where customer.organization_id = org_id and customer.id = order_row.customer_id;
  select * into organization_row from public.organizations organization where organization.id = org_id;
  if order_row.location_id is not null then
    select * into location_row from public.locations location
      where location.organization_id = org_id and location.id = order_row.location_id;
  end if;
  select * into branding_row from public.organization_branding branding where branding.organization_id = org_id;

  receipt_year := extract(year from timezone(organization_row.timezone, issued_time))::integer;
  insert into public.operational_receipt_number_counters (organization_id, sequence_year, series, next_value)
  values (org_id, receipt_year, receipt_series, 2)
  on conflict (organization_id, sequence_year, series)
  do update set next_value = public.operational_receipt_number_counters.next_value + 1, updated_at = now()
  returning next_value - 1 into allocated_sequence;
  allocated_number := receipt_series || '-' || receipt_year::text || '-' || lpad(allocated_sequence::text, 6, '0');

  insert into public.operational_receipts (
    organization_id, order_id, customer_id, receipt_number, series, sequence_year, sequence_number,
    issued_at, currency, amount, snapshot, created_by
  ) values (
    org_id, order_row.id, order_row.customer_id, allocated_number, receipt_series, receipt_year, allocated_sequence,
    issued_time, order_row.currency, order_row.total,
    jsonb_build_object(
      'document', jsonb_build_object('receiptNumber', allocated_number, 'issuedAt', issued_time, 'snapshotVersion', 1),
      'organization', jsonb_build_object(
        'name', organization_row.name,
        'displayName', coalesce(branding_row.commercial_name, organization_row.name),
        'logoPath', branding_row.logo_path,
        'logoAlt', branding_row.logo_alt,
        'address', branding_row.business_address,
        'phone', branding_row.support_phone,
        'email', branding_row.support_email
      ),
      'location', case when location_row.id is null then null else jsonb_build_object(
        'id', location_row.id, 'name', location_row.name, 'addressLine1', location_row.address_line1,
        'addressLine2', location_row.address_line2, 'city', location_row.city, 'postalCode', location_row.postal_code,
        'countryCode', location_row.country_code, 'phone', location_row.phone
      ) end,
      'customer', jsonb_build_object(
        'id', customer_row.id, 'displayName', customer_row.display_name, 'email', customer_row.email, 'phone', customer_row.phone
      ),
      'order', jsonb_build_object(
        'id', order_row.id, 'orderNumber', order_row.order_number, 'createdAt', order_row.created_at,
        'dueAt', order_row.due_at, 'customerNotes', order_row.customer_notes, 'currency', order_row.currency,
        'subtotal', order_row.subtotal, 'discountAmount', order_row.discount_amount, 'total', order_row.total
      ),
      'items', items_snapshot,
      'payment', jsonb_build_object(
        'paidAmount', paid_total,
        'outstandingAmount', round(greatest(order_row.total - paid_total, 0), 2),
        'methodTotals', methods_snapshot
      )
    ),
    actor_id
  ) returning id into result_id;

  return query select result_id, allocated_number;
end;
$$;

create function public.cancel_operational_receipt(target_receipt_id uuid, target_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  org_id uuid := public.app_current_organization_id();
  normalized_reason text := nullif(left(btrim(target_reason), 500), '');
begin
  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[])
    or not public.organization_entitlement_is_enabled(org_id, 'printing', now())
  then
    raise exception 'operational_receipt_not_authorized' using errcode = '42501';
  end if;
  if normalized_reason is null then
    raise exception 'operational_receipt_cancellation_reason_required' using errcode = '22023';
  end if;
  perform set_config('app.operational_receipt_mutation', 'on', true);
  update public.operational_receipts
  set document_status = 'cancelled', cancelled_at = now(), cancellation_reason = normalized_reason, cancelled_by = actor_id
  where organization_id = org_id and id = target_receipt_id and document_status = 'issued';
  if not found then
    raise exception 'operational_receipt_invalid_issued' using errcode = '22023';
  end if;
end;
$$;

create function public.record_sales_document_event(
  target_document_kind public.sales_document_kind,
  target_document_id uuid,
  target_event_type public.sales_document_event_type
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  org_id uuid := public.app_current_organization_id();
  result_id uuid;
begin
  if target_document_kind = 'receipt' then
    if not public.has_operational_capability(org_id, 'pos'::public.operational_capability)
      or not public.organization_entitlement_is_enabled(org_id, 'printing', now())
      or not exists (select 1 from public.operational_receipts receipt where receipt.organization_id = org_id and receipt.id = target_document_id)
    then
      raise exception 'sales_document_event_not_authorized' using errcode = '42501';
    end if;
  elsif target_document_kind = 'invoice' then
    if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[])
      or not public.organization_entitlement_is_enabled(org_id, 'billing.invoicing', now())
      or not exists (select 1 from public.invoices invoice where invoice.organization_id = org_id and invoice.id = target_document_id and invoice.document_status in ('issued', 'cancelled'))
    then
      raise exception 'sales_document_event_not_authorized' using errcode = '42501';
    end if;
  else
    raise exception 'sales_document_event_invalid' using errcode = '22023';
  end if;

  insert into public.sales_document_events (organization_id, document_kind, receipt_id, invoice_id, event_type, actor_id)
  values (
    org_id,
    target_document_kind,
    case when target_document_kind = 'receipt' then target_document_id else null end,
    case when target_document_kind = 'invoice' then target_document_id else null end,
    target_event_type,
    actor_id
  ) returning id into result_id;
  return result_id;
end;
$$;

alter table public.operational_receipt_number_counters enable row level security;
alter table public.operational_receipts enable row level security;
alter table public.sales_document_events enable row level security;

create policy operational_receipts_select_print_access on public.operational_receipts
for select to authenticated using (
  public.is_organization_member(organization_id)
  and public.has_operational_capability(organization_id, 'pos'::public.operational_capability)
  and public.organization_entitlement_is_enabled(organization_id, 'printing', now())
);

create policy sales_document_events_select_management on public.sales_document_events
for select to authenticated using (
  public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[])
);

revoke all on table public.operational_receipt_number_counters from public, anon, authenticated;
revoke all on table public.operational_receipts from public, anon, authenticated;
revoke all on table public.sales_document_events from public, anon, authenticated;
grant select on table public.operational_receipts to authenticated;
grant select on table public.sales_document_events to authenticated;

revoke all on function public.protect_operational_receipt_history() from public, anon, authenticated;
revoke all on function public.protect_sales_document_event_history() from public, anon, authenticated;
revoke all on function public.issue_operational_receipt(uuid) from public, anon, authenticated;
revoke all on function public.cancel_operational_receipt(uuid, text) from public, anon, authenticated;
revoke all on function public.record_sales_document_event(public.sales_document_kind, uuid, public.sales_document_event_type) from public, anon, authenticated;
grant execute on function public.issue_operational_receipt(uuid) to authenticated;
grant execute on function public.cancel_operational_receipt(uuid, text) to authenticated;
grant execute on function public.record_sales_document_event(public.sales_document_kind, uuid, public.sales_document_event_type) to authenticated;
