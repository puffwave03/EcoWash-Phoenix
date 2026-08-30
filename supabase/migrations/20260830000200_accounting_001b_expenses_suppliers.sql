-- ACCOUNTING-001B: canonical tenant suppliers, expense categories and expenses.
-- This is additive and intentionally separate from customer payments, orders,
-- invoices and POS. Expense payment fields are metadata, not ledger entries.

create type public.expense_status as enum ('draft', 'posted', 'void');
create type public.expense_payment_status as enum ('unpaid', 'paid');

create table public.suppliers (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  display_name text not null,
  legal_name text,
  fiscal_identifier text,
  email text,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  postal_code text,
  country_code char(2),
  notes text,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suppliers_organization_id_id_unique unique (organization_id, id),
  constraint suppliers_display_name_valid check (length(btrim(display_name)) between 1 and 160),
  constraint suppliers_email_lowercase check (email is null or email = lower(email)),
  constraint suppliers_country_code_uppercase check (country_code is null or country_code = upper(country_code))
);

create unique index suppliers_fiscal_identifier_unique
on public.suppliers (organization_id, lower(btrim(fiscal_identifier)))
where fiscal_identifier is not null;

create index suppliers_active_name_idx
on public.suppliers (organization_id, is_active, display_name, id);

create table public.expense_categories (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  name text not null,
  description text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expense_categories_organization_id_id_unique unique (organization_id, id),
  constraint expense_categories_name_valid check (length(btrim(name)) between 1 and 120),
  constraint expense_categories_display_order_non_negative check (display_order >= 0)
);

create unique index expense_categories_name_unique
on public.expense_categories (organization_id, lower(btrim(name)));

create index expense_categories_active_order_idx
on public.expense_categories (organization_id, is_active, display_order, name, id);

create table public.expenses (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  location_id uuid,
  supplier_id uuid,
  category_id uuid not null,
  expense_date date not null,
  description text not null,
  gross_amount numeric(14,2) not null,
  currency text not null,
  tax_amount numeric(14,2),
  tax_rate numeric(7,4),
  supplier_reference text,
  document_date date,
  payment_status public.expense_payment_status not null default 'unpaid',
  paid_date date,
  payment_method public.payment_method,
  notes text,
  status public.expense_status not null default 'draft',
  posted_at timestamptz,
  posted_by uuid references public.profiles (id) on delete restrict,
  voided_at timestamptz,
  voided_by uuid references public.profiles (id) on delete restrict,
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_organization_id_id_unique unique (organization_id, id),
  constraint expenses_location_same_organization foreign key (organization_id, location_id)
    references public.locations (organization_id, id) on delete restrict,
  constraint expenses_supplier_same_organization foreign key (organization_id, supplier_id)
    references public.suppliers (organization_id, id) on delete restrict,
  constraint expenses_category_same_organization foreign key (organization_id, category_id)
    references public.expense_categories (organization_id, id) on delete restrict,
  constraint expenses_description_valid check (length(btrim(description)) between 1 and 500),
  constraint expenses_gross_positive check (gross_amount > 0),
  constraint expenses_currency_valid check (currency = upper(currency) and length(currency) = 3),
  constraint expenses_tax_valid check (
    (tax_amount is null and tax_rate is null)
    or (tax_amount is not null and tax_rate is not null and tax_amount >= 0 and tax_amount <= gross_amount and tax_rate between 0 and 100)
  ),
  constraint expenses_reference_valid check (supplier_reference is null or length(btrim(supplier_reference)) between 1 and 160),
  constraint expenses_payment_metadata_consistent check (
    (payment_status = 'unpaid' and paid_date is null and payment_method is null)
    or (payment_status = 'paid' and paid_date is not null and payment_method is not null)
  ),
  constraint expenses_lifecycle_consistent check (
    (status = 'draft' and posted_at is null and posted_by is null and voided_at is null and voided_by is null)
    or (status = 'posted' and posted_at is not null and posted_by is not null and voided_at is null and voided_by is null)
    or (status = 'void' and voided_at is not null and voided_by is not null)
  )
);

create unique index expenses_supplier_reference_unique
on public.expenses (organization_id, supplier_id, lower(btrim(supplier_reference)))
where supplier_id is not null and supplier_reference is not null;

create index expenses_period_idx
on public.expenses (organization_id, expense_date, currency, status, id);

create index expenses_category_period_idx
on public.expenses (organization_id, category_id, expense_date, currency)
where status = 'posted';

create index expenses_supplier_period_idx
on public.expenses (organization_id, supplier_id, expense_date, currency)
where status = 'posted' and supplier_id is not null;

create index expenses_location_period_idx
on public.expenses (organization_id, location_id, expense_date, currency)
where status = 'posted' and location_id is not null;

create trigger suppliers_set_updated_at
before update on public.suppliers
for each row execute function public.set_updated_at();

create trigger expense_categories_set_updated_at
before update on public.expense_categories
for each row execute function public.set_updated_at();

create trigger expenses_set_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

alter table public.suppliers enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;

create policy "suppliers_select_accounting_manager"
on public.suppliers for select to authenticated
using (public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[]));

create policy "expense_categories_select_accounting_manager"
on public.expense_categories for select to authenticated
using (public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[]));

create policy "expenses_select_accounting_manager"
on public.expenses for select to authenticated
using (public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[]));

create function public.save_supplier(
  target_supplier_id uuid,
  target_display_name text,
  target_legal_name text,
  target_fiscal_identifier text,
  target_email text,
  target_phone text,
  target_address_line1 text,
  target_address_line2 text,
  target_city text,
  target_postal_code text,
  target_country_code text,
  target_notes text
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
  if not public.has_organization_role(org_id, array['owner']::public.app_role[]) then
    raise exception 'supplier_management_denied' using errcode = '42501';
  end if;
  if nullif(btrim(target_display_name), '') is null then
    raise exception 'supplier_name_required' using errcode = '22023';
  end if;

  if target_supplier_id is null then
    insert into public.suppliers (
      organization_id, display_name, legal_name, fiscal_identifier, email, phone,
      address_line1, address_line2, city, postal_code, country_code, notes,
      created_by, updated_by
    ) values (
      org_id, btrim(target_display_name), nullif(btrim(target_legal_name), ''),
      nullif(btrim(target_fiscal_identifier), ''), lower(nullif(btrim(target_email), '')),
      nullif(btrim(target_phone), ''), nullif(btrim(target_address_line1), ''),
      nullif(btrim(target_address_line2), ''), nullif(btrim(target_city), ''),
      nullif(btrim(target_postal_code), ''), upper(nullif(btrim(target_country_code), '')),
      nullif(btrim(target_notes), ''), actor_id, actor_id
    ) returning id into result_id;
  else
    update public.suppliers supplier
    set display_name = btrim(target_display_name),
        legal_name = nullif(btrim(target_legal_name), ''),
        fiscal_identifier = nullif(btrim(target_fiscal_identifier), ''),
        email = lower(nullif(btrim(target_email), '')),
        phone = nullif(btrim(target_phone), ''),
        address_line1 = nullif(btrim(target_address_line1), ''),
        address_line2 = nullif(btrim(target_address_line2), ''),
        city = nullif(btrim(target_city), ''),
        postal_code = nullif(btrim(target_postal_code), ''),
        country_code = upper(nullif(btrim(target_country_code), '')),
        notes = nullif(btrim(target_notes), ''),
        updated_by = actor_id
    where supplier.organization_id = org_id and supplier.id = target_supplier_id
    returning supplier.id into result_id;
    if result_id is null then raise exception 'supplier_not_found' using errcode = 'P0002'; end if;
  end if;
  return result_id;
end;
$$;

create function public.set_supplier_active(target_supplier_id uuid, target_is_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  org_id uuid := public.app_current_organization_id();
begin
  if not public.has_organization_role(org_id, array['owner']::public.app_role[]) then
    raise exception 'supplier_management_denied' using errcode = '42501';
  end if;
  update public.suppliers supplier
  set is_active = target_is_active, updated_by = actor_id
  where supplier.organization_id = org_id and supplier.id = target_supplier_id;
  if not found then raise exception 'supplier_not_found' using errcode = 'P0002'; end if;
end;
$$;

create function public.save_expense_category(
  target_category_id uuid,
  target_name text,
  target_description text,
  target_display_order integer
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
  if not public.has_organization_role(org_id, array['owner']::public.app_role[]) then
    raise exception 'expense_category_management_denied' using errcode = '42501';
  end if;
  if nullif(btrim(target_name), '') is null or target_display_order < 0 then
    raise exception 'expense_category_invalid' using errcode = '22023';
  end if;

  if target_category_id is null then
    insert into public.expense_categories (
      organization_id, name, description, display_order, created_by, updated_by
    ) values (
      org_id, btrim(target_name), nullif(btrim(target_description), ''), target_display_order, actor_id, actor_id
    ) returning id into result_id;
  else
    update public.expense_categories category
    set name = btrim(target_name), description = nullif(btrim(target_description), ''),
        display_order = target_display_order, updated_by = actor_id
    where category.organization_id = org_id and category.id = target_category_id
    returning category.id into result_id;
    if result_id is null then raise exception 'expense_category_not_found' using errcode = 'P0002'; end if;
  end if;
  return result_id;
end;
$$;

create function public.set_expense_category_active(target_category_id uuid, target_is_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  org_id uuid := public.app_current_organization_id();
begin
  if not public.has_organization_role(org_id, array['owner']::public.app_role[]) then
    raise exception 'expense_category_management_denied' using errcode = '42501';
  end if;
  update public.expense_categories category
  set is_active = target_is_active, updated_by = actor_id
  where category.organization_id = org_id and category.id = target_category_id;
  if not found then raise exception 'expense_category_not_found' using errcode = 'P0002'; end if;
end;
$$;

create function public.save_expense(
  target_expense_id uuid,
  target_location_id uuid,
  target_supplier_id uuid,
  target_category_id uuid,
  target_expense_date date,
  target_description text,
  target_gross_amount numeric,
  target_currency text,
  target_tax_amount numeric,
  target_tax_rate numeric,
  target_supplier_reference text,
  target_document_date date,
  target_payment_status public.expense_payment_status,
  target_paid_date date,
  target_payment_method public.payment_method,
  target_notes text
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
  current_status public.expense_status;
begin
  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'expense_management_denied' using errcode = '42501';
  end if;
  if target_expense_date is null or nullif(btrim(target_description), '') is null
    or target_gross_amount is null or target_gross_amount <= 0
    or target_currency is null or length(btrim(target_currency)) <> 3 then
    raise exception 'expense_invalid' using errcode = '22023';
  end if;
  if target_location_id is not null and not exists (
    select 1 from public.locations location
    where location.organization_id = org_id and location.id = target_location_id
      and location.is_active and location.deleted_at is null
  ) then raise exception 'expense_location_invalid' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.expense_categories category
    where category.organization_id = org_id and category.id = target_category_id and category.is_active
  ) then raise exception 'expense_category_invalid' using errcode = '22023'; end if;
  if target_supplier_id is not null and not exists (
    select 1 from public.suppliers supplier
    where supplier.organization_id = org_id and supplier.id = target_supplier_id and supplier.is_active
  ) then raise exception 'expense_supplier_invalid' using errcode = '22023'; end if;

  if target_expense_id is null then
    insert into public.expenses (
      organization_id, location_id, supplier_id, category_id, expense_date,
      description, gross_amount, currency, tax_amount, tax_rate,
      supplier_reference, document_date, payment_status, paid_date,
      payment_method, notes, created_by, updated_by
    ) values (
      org_id, target_location_id, target_supplier_id, target_category_id, target_expense_date,
      btrim(target_description), round(target_gross_amount, 2), upper(btrim(target_currency)),
      case when target_tax_amount is null then null else round(target_tax_amount, 2) end,
      target_tax_rate, nullif(btrim(target_supplier_reference), ''), target_document_date,
      coalesce(target_payment_status, 'unpaid'), target_paid_date, target_payment_method,
      nullif(btrim(target_notes), ''), actor_id, actor_id
    ) returning id into result_id;
  else
    select expense.status into current_status
    from public.expenses expense
    where expense.organization_id = org_id and expense.id = target_expense_id
    for update;
    if current_status is null then raise exception 'expense_not_found' using errcode = 'P0002'; end if;
    if current_status <> 'draft' then raise exception 'expense_posted_immutable' using errcode = '55000'; end if;

    update public.expenses expense
    set location_id = target_location_id, supplier_id = target_supplier_id,
        category_id = target_category_id, expense_date = target_expense_date,
        description = btrim(target_description), gross_amount = round(target_gross_amount, 2),
        currency = upper(btrim(target_currency)),
        tax_amount = case when target_tax_amount is null then null else round(target_tax_amount, 2) end,
        tax_rate = target_tax_rate, supplier_reference = nullif(btrim(target_supplier_reference), ''),
        document_date = target_document_date, payment_status = coalesce(target_payment_status, 'unpaid'),
        paid_date = target_paid_date, payment_method = target_payment_method,
        notes = nullif(btrim(target_notes), ''), updated_by = actor_id
    where expense.organization_id = org_id and expense.id = target_expense_id
    returning expense.id into result_id;
  end if;
  return result_id;
end;
$$;

create function public.set_expense_status(target_expense_id uuid, target_status public.expense_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  org_id uuid := public.app_current_organization_id();
  current_status public.expense_status;
begin
  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'expense_management_denied' using errcode = '42501';
  end if;
  select expense.status into current_status
  from public.expenses expense
  where expense.organization_id = org_id and expense.id = target_expense_id
  for update;
  if current_status is null then raise exception 'expense_not_found' using errcode = 'P0002'; end if;
  if current_status = target_status then return; end if;
  if target_status not in ('posted', 'void')
    or (current_status = 'posted' and target_status <> 'void')
    or current_status = 'void' then
    raise exception 'expense_status_transition_invalid' using errcode = '55000';
  end if;

  update public.expenses expense
  set status = target_status,
      posted_at = case when target_status = 'posted' then now() else expense.posted_at end,
      posted_by = case when target_status = 'posted' then actor_id else expense.posted_by end,
      voided_at = case when target_status = 'void' then now() else null end,
      voided_by = case when target_status = 'void' then actor_id else null end,
      updated_by = actor_id
  where expense.organization_id = org_id and expense.id = target_expense_id;
end;
$$;

revoke all on public.suppliers, public.expense_categories, public.expenses from public, anon, authenticated;
grant select on public.suppliers, public.expense_categories, public.expenses to authenticated;

revoke all on function public.save_supplier(uuid, text, text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.set_supplier_active(uuid, boolean) from public, anon, authenticated;
revoke all on function public.save_expense_category(uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.set_expense_category_active(uuid, boolean) from public, anon, authenticated;
revoke all on function public.save_expense(uuid, uuid, uuid, uuid, date, text, numeric, text, numeric, numeric, text, date, public.expense_payment_status, date, public.payment_method, text) from public, anon, authenticated;
revoke all on function public.set_expense_status(uuid, public.expense_status) from public, anon, authenticated;

grant execute on function public.save_supplier(uuid, text, text, text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.set_supplier_active(uuid, boolean) to authenticated;
grant execute on function public.save_expense_category(uuid, text, text, integer) to authenticated;
grant execute on function public.set_expense_category_active(uuid, boolean) to authenticated;
grant execute on function public.save_expense(uuid, uuid, uuid, uuid, date, text, numeric, text, numeric, numeric, text, date, public.expense_payment_status, date, public.payment_method, text) to authenticated;
grant execute on function public.set_expense_status(uuid, public.expense_status) to authenticated;

grant usage on type public.expense_status, public.expense_payment_status to authenticated;
