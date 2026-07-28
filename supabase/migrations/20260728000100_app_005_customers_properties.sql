create type public.customer_type as enum ('individual', 'business');
create type public.property_type as enum (
  'apartment',
  'holiday_home',
  'hotel',
  'business',
  'other'
);

create table public.customers (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  customer_code text,
  customer_type public.customer_type not null,
  display_name text not null,
  first_name text,
  last_name text,
  company_name text,
  tax_id text,
  email text,
  phone text,
  alternate_phone text,
  billing_address_line1 text,
  billing_address_line2 text,
  billing_city text,
  billing_postal_code text,
  billing_country_code char(2) default 'ES',
  preferred_locale text default 'es',
  notes text,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_display_name_not_blank check (length(btrim(display_name)) > 0),
  constraint customers_email_lowercase check (email is null or email = lower(email)),
  constraint customers_billing_country_code_uppercase check (
    billing_country_code is null or billing_country_code = upper(billing_country_code)
  ),
  constraint customers_preferred_locale_supported check (
    preferred_locale in ('en', 'it', 'es', 'fr', 'de')
  ),
  constraint customers_organization_id_id_unique unique (organization_id, id)
);

create table public.properties (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null,
  customer_id uuid not null,
  property_code text,
  name text not null,
  property_type public.property_type,
  address_line1 text,
  address_line2 text,
  city text,
  postal_code text,
  country_code char(2) default 'ES',
  access_instructions text,
  contact_name text,
  contact_phone text,
  notes text,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint properties_customer_same_organization foreign key (
    organization_id,
    customer_id
  ) references public.customers (organization_id, id) on delete restrict,
  constraint properties_name_not_blank check (length(btrim(name)) > 0),
  constraint properties_country_code_uppercase check (
    country_code is null or country_code = upper(country_code)
  )
);

create unique index customers_customer_code_unique_per_organization
on public.customers (organization_id, customer_code)
where customer_code is not null;

create unique index customers_tax_id_unique_per_organization
on public.customers (organization_id, tax_id)
where tax_id is not null;

create index customers_organization_id_idx on public.customers (organization_id);
create index customers_display_name_idx on public.customers (organization_id, display_name);
create index customers_email_idx on public.customers (organization_id, email);
create index customers_phone_idx on public.customers (organization_id, phone);
create index customers_is_active_idx on public.customers (organization_id, is_active);

create unique index properties_property_code_unique_per_organization
on public.properties (organization_id, property_code)
where property_code is not null;

create index properties_organization_id_idx on public.properties (organization_id);
create index properties_customer_id_idx on public.properties (customer_id);
create index properties_name_idx on public.properties (organization_id, name);
create index properties_city_idx on public.properties (organization_id, city);
create index properties_is_active_idx on public.properties (organization_id, is_active);

create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

create trigger properties_set_updated_at
before update on public.properties
for each row execute function public.set_updated_at();

create function public.protect_customer_immutable_fields()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id <> old.organization_id then
    raise exception 'customers.organization_id cannot be changed';
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'customers.created_by cannot be changed';
  end if;

  return new;
end;
$$;

create function public.protect_property_immutable_fields()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id <> old.organization_id then
    raise exception 'properties.organization_id cannot be changed';
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'properties.created_by cannot be changed';
  end if;

  return new;
end;
$$;

create trigger customers_protect_immutable_fields
before update on public.customers
for each row execute function public.protect_customer_immutable_fields();

create trigger properties_protect_immutable_fields
before update on public.properties
for each row execute function public.protect_property_immutable_fields();

alter table public.customers enable row level security;
alter table public.properties enable row level security;

create policy "customers_select_member"
on public.customers
for select
to authenticated
using (public.is_organization_member(organization_id));

create policy "customers_insert_member"
on public.customers
for insert
to authenticated
with check (
  public.has_organization_role(
    organization_id,
    array['owner', 'manager', 'staff']::public.app_role[]
  )
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

create policy "customers_update_member"
on public.customers
for update
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['owner', 'manager', 'staff']::public.app_role[]
  )
)
with check (
  public.has_organization_role(
    organization_id,
    array['owner', 'manager', 'staff']::public.app_role[]
  )
  and updated_by = auth.uid()
);

create policy "properties_select_member"
on public.properties
for select
to authenticated
using (public.is_organization_member(organization_id));

create policy "properties_insert_member"
on public.properties
for insert
to authenticated
with check (
  public.has_organization_role(
    organization_id,
    array['owner', 'manager', 'staff']::public.app_role[]
  )
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

create policy "properties_update_member"
on public.properties
for update
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['owner', 'manager', 'staff']::public.app_role[]
  )
)
with check (
  public.has_organization_role(
    organization_id,
    array['owner', 'manager', 'staff']::public.app_role[]
  )
  and updated_by = auth.uid()
);

grant usage on type public.customer_type to authenticated;
grant usage on type public.property_type to authenticated;
grant select, insert, update on public.customers to authenticated;
grant select, insert, update on public.properties to authenticated;
revoke all on function public.protect_customer_immutable_fields() from public;
revoke all on function public.protect_property_immutable_fields() from public;
