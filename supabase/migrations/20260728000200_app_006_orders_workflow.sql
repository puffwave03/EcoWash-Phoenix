create type public.service_unit_type as enum ('weight', 'piece');
create type public.production_status as enum (
  'draft',
  'received',
  'washing',
  'drying',
  'ironing',
  'quality_check',
  'packing',
  'ready',
  'completed',
  'on_hold',
  'cancelled'
);
create type public.order_priority as enum ('normal', 'express');

create sequence public.order_number_sequence;

create unique index locations_organization_id_id_unique
on public.locations (organization_id, id);

create unique index properties_organization_id_id_unique
on public.properties (organization_id, id);

create table public.services (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  location_id uuid references public.locations (id) on delete restrict,
  code text,
  name text not null,
  description text,
  unit_type public.service_unit_type not null,
  category text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_name_not_blank check (length(btrim(name)) > 0),
  constraint services_organization_id_id_unique unique (organization_id, id),
  constraint services_location_same_organization foreign key (
    organization_id,
    location_id
  ) references public.locations (organization_id, id) on delete restrict
);

create table public.service_prices (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  service_id uuid not null,
  location_id uuid references public.locations (id) on delete restrict,
  amount numeric(12,2) not null,
  currency text not null default 'EUR',
  valid_from date not null,
  valid_to date,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_prices_amount_non_negative check (amount >= 0),
  constraint service_prices_currency_format check (
    currency = upper(currency) and length(currency) = 3
  ),
  constraint service_prices_valid_range check (
    valid_to is null or valid_to >= valid_from
  ),
  constraint service_prices_service_same_organization foreign key (
    organization_id,
    service_id
  ) references public.services (organization_id, id) on delete restrict,
  constraint service_prices_location_same_organization foreign key (
    organization_id,
    location_id
  ) references public.locations (organization_id, id) on delete restrict
);

create table public.orders (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  location_id uuid references public.locations (id) on delete restrict,
  order_number text not null,
  customer_id uuid not null,
  property_id uuid,
  production_status public.production_status not null default 'draft',
  priority public.order_priority not null default 'normal',
  received_at timestamptz,
  due_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  on_hold_reason text,
  customer_notes text,
  internal_notes text,
  subtotal numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  currency text not null default 'EUR',
  assigned_to uuid references public.profiles (id) on delete set null,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_customer_same_organization foreign key (
    organization_id,
    customer_id
  ) references public.customers (organization_id, id) on delete restrict,
  constraint orders_property_same_customer foreign key (
    organization_id,
    property_id
  ) references public.properties (organization_id, id) on delete restrict,
  constraint orders_location_same_organization foreign key (
    organization_id,
    location_id
  ) references public.locations (organization_id, id) on delete restrict,
  constraint orders_currency_format check (
    currency = upper(currency) and length(currency) = 3
  ),
  constraint orders_amounts_valid check (
    subtotal >= 0
    and discount_amount >= 0
    and discount_amount <= subtotal
    and total = subtotal - discount_amount
    and total >= 0
  ),
  constraint orders_cancelled_reason_required check (
    production_status <> 'cancelled' or cancellation_reason is not null
  ),
  constraint orders_on_hold_reason_required check (
    production_status <> 'on_hold' or on_hold_reason is not null
  ),
  constraint orders_completed_at_consistent check (
    (production_status = 'completed' and completed_at is not null)
    or (production_status <> 'completed' and completed_at is null)
  ),
  constraint orders_cancelled_at_consistent check (
    (production_status = 'cancelled' and cancelled_at is not null)
    or (production_status <> 'cancelled' and cancelled_at is null)
  ),
  constraint orders_organization_id_id_unique unique (organization_id, id)
);

create table public.order_items (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null,
  order_id uuid not null,
  service_id uuid,
  description text not null,
  unit_type public.service_unit_type not null,
  quantity numeric(12,3) not null,
  unit_price numeric(12,2) not null,
  line_total numeric(12,2) not null,
  notes text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_items_order_same_organization foreign key (
    organization_id,
    order_id
  ) references public.orders (organization_id, id) on delete restrict,
  constraint order_items_service_same_organization foreign key (
    organization_id,
    service_id
  ) references public.services (organization_id, id) on delete restrict,
  constraint order_items_description_not_blank check (length(btrim(description)) > 0),
  constraint order_items_amounts_valid check (
    quantity > 0
    and unit_price >= 0
    and line_total = round(quantity * unit_price, 2)
  ),
  constraint order_items_piece_quantity_integer check (
    unit_type <> 'piece' or quantity = trunc(quantity)
  )
);

create table public.order_status_history (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null,
  order_id uuid not null,
  from_status public.production_status,
  to_status public.production_status not null,
  reason text,
  changed_by uuid not null references public.profiles (id) on delete restrict,
  changed_at timestamptz not null default now(),
  metadata jsonb,
  constraint order_status_history_order_same_organization foreign key (
    organization_id,
    order_id
  ) references public.orders (organization_id, id) on delete restrict
);

create unique index services_code_unique_per_organization
on public.services (organization_id, code)
where code is not null;
create index services_organization_idx on public.services (organization_id, is_active);
create index services_sort_idx on public.services (organization_id, sort_order, name);

create unique index service_prices_active_unique_period
on public.service_prices (organization_id, service_id, coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid), valid_from)
where is_active;
create index service_prices_lookup_idx
on public.service_prices (organization_id, service_id, location_id, is_active, valid_from desc);

create unique index orders_number_unique_per_organization
on public.orders (organization_id, order_number);
create index orders_list_idx
on public.orders (organization_id, production_status, is_active, created_at desc);
create index orders_customer_idx on public.orders (organization_id, customer_id);
create index orders_due_idx on public.orders (organization_id, due_at);

create index order_items_order_idx on public.order_items (organization_id, order_id, sort_order);
create index order_items_service_idx on public.order_items (organization_id, service_id);
create index order_status_history_order_idx
on public.order_status_history (organization_id, order_id, changed_at desc);

create trigger services_set_updated_at
before update on public.services
for each row execute function public.set_updated_at();

create trigger service_prices_set_updated_at
before update on public.service_prices
for each row execute function public.set_updated_at();

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create trigger order_items_set_updated_at
before update on public.order_items
for each row execute function public.set_updated_at();

create function public.app_current_organization_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result uuid;
  membership_count integer;
begin
  select count(*), min(organization_id)
  into membership_count, result
  from public.organization_memberships
  where profile_id = auth.uid()
    and is_active;

  if membership_count <> 1 then
    raise exception 'single active organization membership required';
  end if;

  return result;
end;
$$;

create function public.protect_service_immutable_fields()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id <> old.organization_id then
    raise exception 'services.organization_id cannot be changed';
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'services.created_by cannot be changed';
  end if;

  return new;
end;
$$;

create function public.protect_order_immutable_fields()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id <> old.organization_id then
    raise exception 'orders.organization_id cannot be changed';
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'orders.created_by cannot be changed';
  end if;

  if new.order_number <> old.order_number then
    raise exception 'orders.order_number cannot be changed';
  end if;

  if new.production_status <> old.production_status
    and current_setting('app.workflow_transition', true) <> 'on' then
    raise exception 'orders.production_status changes require workflow RPC';
  end if;

  if (
    new.subtotal <> old.subtotal
    or new.discount_amount <> old.discount_amount
    or new.total <> old.total
  ) and current_setting('app.order_financial_update', true) <> 'on' then
    raise exception 'orders totals require order financial RPC';
  end if;

  if new.property_id is not null and not exists (
    select 1
    from public.properties property
    where property.id = new.property_id
      and property.organization_id = new.organization_id
      and property.customer_id = new.customer_id
  ) then
    raise exception 'orders.property_id must belong to the same customer and organization';
  end if;

  if new.assigned_to is not null and not exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = new.organization_id
      and membership.profile_id = new.assigned_to
      and membership.is_active
  ) then
    raise exception 'orders.assigned_to must be an active organization member';
  end if;

  return new;
end;
$$;

create function public.validate_order_relationships()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and current_setting('app.order_create', true) <> 'on' then
    raise exception 'orders inserts require create_order RPC';
  end if;

  if new.property_id is not null and not exists (
    select 1
    from public.properties property
    where property.id = new.property_id
      and property.organization_id = new.organization_id
      and property.customer_id = new.customer_id
  ) then
    raise exception 'orders.property_id must belong to the same customer and organization';
  end if;

  if new.assigned_to is not null and not exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = new.organization_id
      and membership.profile_id = new.assigned_to
      and membership.is_active
  ) then
    raise exception 'orders.assigned_to must be an active organization member';
  end if;

  return new;
end;
$$;

create function public.protect_order_item_mutation()
returns trigger
language plpgsql
as $$
begin
  if current_setting('app.order_item_mutation', true) <> 'on' then
    raise exception 'order_items mutations require order item RPC';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create function public.protect_order_status_history()
returns trigger
language plpgsql
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'order_status_history is append-only';
  end if;

  if current_setting('app.workflow_transition', true) <> 'on' then
    raise exception 'order_status_history inserts require workflow RPC';
  end if;

  if new.changed_by <> auth.uid() then
    raise exception 'order_status_history.changed_by must match current user';
  end if;

  return new;
end;
$$;

create trigger services_protect_immutable_fields
before update on public.services
for each row execute function public.protect_service_immutable_fields();

create trigger orders_protect_immutable_fields
before update on public.orders
for each row execute function public.protect_order_immutable_fields();

create trigger orders_validate_relationships
before insert on public.orders
for each row execute function public.validate_order_relationships();

create trigger order_status_history_protect
before insert or update or delete on public.order_status_history
for each row execute function public.protect_order_status_history();

create trigger order_items_protect_mutation
before insert or update or delete on public.order_items
for each row execute function public.protect_order_item_mutation();

create function public.recalculate_order_totals(target_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item_total numeric(12,2);
begin
  perform set_config('app.order_financial_update', 'on', true);

  select coalesce(sum(line_total), 0)
  into item_total
  from public.order_items
  where order_id = target_order_id
    and is_active;

  update public.orders
  set subtotal = item_total,
      total = item_total - discount_amount,
      updated_by = auth.uid()
  where id = target_order_id;
end;
$$;

create function public.create_order(
  target_customer_id uuid,
  target_property_id uuid,
  target_location_id uuid,
  target_priority public.order_priority,
  target_due_at timestamptz,
  target_customer_notes text,
  target_internal_notes text
)
returns table(id uuid, order_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  new_order_id uuid;
  new_order_number text;
begin
  org_id := public.app_current_organization_id();

  if not public.has_organization_role(org_id, array['owner', 'manager', 'staff']::public.app_role[]) then
    raise exception 'not authorized';
  end if;

  if not exists (
    select 1 from public.customers
    where id = target_customer_id
      and organization_id = org_id
      and is_active
  ) then
    raise exception 'invalid customer';
  end if;

  if target_property_id is not null and not exists (
    select 1 from public.properties
    where id = target_property_id
      and customer_id = target_customer_id
      and organization_id = org_id
      and is_active
  ) then
    raise exception 'invalid property';
  end if;

  if target_location_id is not null and not exists (
    select 1 from public.locations
    where id = target_location_id
      and organization_id = org_id
      and is_active
      and deleted_at is null
  ) then
    raise exception 'invalid location';
  end if;

  new_order_number := 'EW-' || lpad(nextval('public.order_number_sequence')::text, 6, '0');

  perform set_config('app.order_create', 'on', true);

  insert into public.orders (
    organization_id,
    location_id,
    order_number,
    customer_id,
    property_id,
    priority,
    due_at,
    customer_notes,
    internal_notes,
    created_by,
    updated_by
  )
  values (
    org_id,
    target_location_id,
    new_order_number,
    target_customer_id,
    target_property_id,
    coalesce(target_priority, 'normal'::public.order_priority),
    target_due_at,
    nullif(btrim(target_customer_notes), ''),
    nullif(btrim(target_internal_notes), ''),
    auth.uid(),
    auth.uid()
  )
  returning orders.id into new_order_id;

  perform set_config('app.workflow_transition', 'on', true);

  insert into public.order_status_history (
    organization_id,
    order_id,
    from_status,
    to_status,
    reason,
    changed_by,
    metadata
  )
  values (
    org_id,
    new_order_id,
    null,
    'draft',
    null,
    auth.uid(),
    jsonb_build_object('source', 'create_order')
  );

  return query select new_order_id, new_order_number;
end;
$$;

create function public.save_order_item(
  target_item_id uuid,
  target_order_id uuid,
  target_service_id uuid,
  target_description text,
  target_unit_type public.service_unit_type,
  target_quantity numeric,
  target_unit_price numeric,
  target_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  order_status public.production_status;
  member_role public.app_role;
  service_price numeric(12,2);
  service_unit public.service_unit_type;
  service_name text;
  item_id uuid;
  final_price numeric(12,2);
  final_description text;
  final_unit_type public.service_unit_type;
begin
  org_id := public.app_current_organization_id();

  select role into member_role
  from public.organization_memberships
  where organization_id = org_id
    and profile_id = auth.uid()
    and is_active;

  select production_status into order_status
  from public.orders
  where id = target_order_id
    and organization_id = org_id
    and is_active
  for update;

  if order_status is null then
    raise exception 'invalid order';
  end if;

  if order_status in ('completed', 'cancelled') then
    raise exception 'order is final';
  end if;

  if member_role = 'staff' and target_service_id is null then
    raise exception 'staff items require a catalog service';
  end if;

  final_description := nullif(btrim(target_description), '');
  final_unit_type := target_unit_type;
  final_price := target_unit_price;

  if target_service_id is not null then
    select service.unit_type, service.name
    into service_unit, service_name
    from public.services service
    where service.id = target_service_id
      and service.organization_id = org_id
      and service.is_active;

    if service_unit is null then
      raise exception 'invalid service';
    end if;

    final_unit_type := service_unit;
    final_description := coalesce(final_description, service_name);

    select price.amount
    into service_price
    from public.service_prices price
    where price.organization_id = org_id
      and price.service_id = target_service_id
      and price.is_active
      and price.valid_from <= current_date
      and (price.valid_to is null or price.valid_to >= current_date)
    order by (price.location_id is not null) desc, price.valid_from desc, price.created_at desc
    limit 1;

    if member_role = 'staff' then
      if service_price is null then
        raise exception 'missing current service price';
      end if;
      final_price := service_price;
    else
      final_price := coalesce(target_unit_price, service_price);
    end if;
  end if;

  if final_description is null then
    raise exception 'description required';
  end if;

  if target_quantity <= 0 or final_price < 0 then
    raise exception 'invalid item amount';
  end if;

  if final_unit_type = 'piece' and target_quantity <> trunc(target_quantity) then
    raise exception 'piece quantity must be integer';
  end if;

  if target_item_id is null then
    perform set_config('app.order_item_mutation', 'on', true);

    insert into public.order_items (
      organization_id,
      order_id,
      service_id,
      description,
      unit_type,
      quantity,
      unit_price,
      line_total,
      notes,
      created_by,
      updated_by
    )
    values (
      org_id,
      target_order_id,
      target_service_id,
      final_description,
      final_unit_type,
      target_quantity,
      final_price,
      round(target_quantity * final_price, 2),
      nullif(btrim(target_notes), ''),
      auth.uid(),
      auth.uid()
    )
    returning id into item_id;
  else
    perform set_config('app.order_item_mutation', 'on', true);

    update public.order_items
    set service_id = target_service_id,
        description = final_description,
        unit_type = final_unit_type,
        quantity = target_quantity,
        unit_price = final_price,
        line_total = round(target_quantity * final_price, 2),
        notes = nullif(btrim(target_notes), ''),
        updated_by = auth.uid()
    where id = target_item_id
      and order_id = target_order_id
      and organization_id = org_id
      and is_active
    returning id into item_id;

    if item_id is null then
      raise exception 'invalid item';
    end if;
  end if;

  perform public.recalculate_order_totals(target_order_id);

  return item_id;
end;
$$;

create function public.remove_order_item(target_item_id uuid, target_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  order_status public.production_status;
begin
  org_id := public.app_current_organization_id();

  select production_status into order_status
  from public.orders
  where id = target_order_id
    and organization_id = org_id
    and is_active
  for update;

  if order_status is null then
    raise exception 'invalid order';
  end if;

  if order_status = 'draft' then
    perform set_config('app.order_item_mutation', 'on', true);

    delete from public.order_items
    where id = target_item_id
      and order_id = target_order_id
      and organization_id = org_id;
  else
    perform set_config('app.order_item_mutation', 'on', true);

    update public.order_items
    set is_active = false,
        updated_by = auth.uid()
    where id = target_item_id
      and order_id = target_order_id
      and organization_id = org_id;
  end if;

  perform public.recalculate_order_totals(target_order_id);
end;
$$;

create function public.update_order_discount(
  target_order_id uuid,
  target_discount_amount numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  current_subtotal numeric(12,2);
begin
  org_id := public.app_current_organization_id();

  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'not authorized';
  end if;

  select subtotal
  into current_subtotal
  from public.orders
  where id = target_order_id
    and organization_id = org_id
    and is_active
    and production_status not in ('completed', 'cancelled')
  for update;

  if current_subtotal is null then
    raise exception 'invalid order';
  end if;

  if target_discount_amount < 0 or target_discount_amount > current_subtotal then
    raise exception 'invalid discount';
  end if;

  perform set_config('app.order_financial_update', 'on', true);

  update public.orders
  set discount_amount = round(target_discount_amount, 2),
      total = current_subtotal - round(target_discount_amount, 2),
      updated_by = auth.uid()
  where id = target_order_id
    and organization_id = org_id;
end;
$$;

create function public.update_order_details(
  target_order_id uuid,
  target_priority public.order_priority,
  target_due_at timestamptz,
  target_customer_notes text,
  target_internal_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
begin
  org_id := public.app_current_organization_id();

  if not public.has_organization_role(org_id, array['owner', 'manager', 'staff']::public.app_role[]) then
    raise exception 'not authorized';
  end if;

  update public.orders
  set priority = coalesce(target_priority, priority),
      due_at = target_due_at,
      customer_notes = nullif(btrim(target_customer_notes), ''),
      internal_notes = nullif(btrim(target_internal_notes), ''),
      updated_by = auth.uid()
  where id = target_order_id
    and organization_id = org_id
    and is_active
    and production_status not in ('completed', 'cancelled');

  if not found then
    raise exception 'invalid order';
  end if;
end;
$$;

create function public.transition_order_status(
  target_order_id uuid,
  target_status public.production_status,
  target_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  current_status public.production_status;
  previous_status public.production_status;
  reason_text text;
  allowed boolean := false;
begin
  org_id := public.app_current_organization_id();
  reason_text := nullif(btrim(target_reason), '');

  select production_status into current_status
  from public.orders
  where id = target_order_id
    and organization_id = org_id
    and is_active
  for update;

  if current_status is null then
    raise exception 'invalid order';
  end if;

  if current_status in ('completed', 'cancelled') then
    raise exception 'final status cannot transition';
  end if;

  if target_status in ('on_hold', 'cancelled') and reason_text is null then
    raise exception 'reason required';
  end if;

  if current_status = 'draft' then
    allowed := target_status in ('received', 'cancelled');
  elsif current_status = 'received' then
    allowed := target_status in ('washing', 'ironing', 'quality_check', 'on_hold', 'cancelled');
  elsif current_status = 'washing' then
    allowed := target_status in ('drying', 'quality_check', 'on_hold');
  elsif current_status = 'drying' then
    allowed := target_status in ('ironing', 'quality_check', 'packing', 'on_hold');
  elsif current_status = 'ironing' then
    allowed := target_status in ('quality_check', 'packing', 'on_hold');
  elsif current_status = 'quality_check' then
    allowed := target_status in ('packing', 'on_hold');
  elsif current_status = 'packing' then
    allowed := target_status in ('ready', 'on_hold');
  elsif current_status = 'ready' then
    allowed := target_status in ('completed', 'on_hold');
  elsif current_status = 'on_hold' then
    select history.to_status
    into previous_status
    from public.order_status_history history
    where history.order_id = target_order_id
      and history.organization_id = org_id
      and history.to_status not in ('on_hold', 'cancelled', 'completed')
    order by history.changed_at desc
    limit 1;

    allowed := target_status = previous_status or target_status = 'cancelled';
  end if;

  if not allowed then
    raise exception 'transition not allowed';
  end if;

  perform set_config('app.workflow_transition', 'on', true);

  update public.orders
  set production_status = target_status,
      received_at = case when target_status = 'received' and received_at is null then now() else received_at end,
      completed_at = case when target_status = 'completed' then now() else null end,
      cancelled_at = case when target_status = 'cancelled' then now() else null end,
      cancellation_reason = case when target_status = 'cancelled' then reason_text else cancellation_reason end,
      on_hold_reason = case when target_status = 'on_hold' then reason_text else null end,
      updated_by = auth.uid()
  where id = target_order_id
    and organization_id = org_id;

  insert into public.order_status_history (
    organization_id,
    order_id,
    from_status,
    to_status,
    reason,
    changed_by
  )
  values (
    org_id,
    target_order_id,
    current_status,
    target_status,
    reason_text,
    auth.uid()
  );
end;
$$;

alter table public.services enable row level security;
alter table public.service_prices enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;

create policy "services_select_member"
on public.services for select to authenticated
using (public.is_organization_member(organization_id));

create policy "services_insert_manager"
on public.services for insert to authenticated
with check (
  public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[])
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

create policy "services_update_manager"
on public.services for update to authenticated
using (public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[]))
with check (
  public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[])
  and updated_by = auth.uid()
);

create policy "service_prices_select_member"
on public.service_prices for select to authenticated
using (public.is_organization_member(organization_id));

create policy "service_prices_insert_manager"
on public.service_prices for insert to authenticated
with check (
  public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[])
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

create policy "service_prices_update_manager"
on public.service_prices for update to authenticated
using (public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[]))
with check (
  public.has_organization_role(organization_id, array['owner', 'manager']::public.app_role[])
  and updated_by = auth.uid()
);

create policy "orders_select_member"
on public.orders for select to authenticated
using (public.is_organization_member(organization_id));

create policy "orders_insert_member"
on public.orders for insert to authenticated
with check (
  public.has_organization_role(organization_id, array['owner', 'manager', 'staff']::public.app_role[])
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

create policy "orders_update_member"
on public.orders for update to authenticated
using (public.has_organization_role(organization_id, array['owner', 'manager', 'staff']::public.app_role[]))
with check (
  public.has_organization_role(organization_id, array['owner', 'manager', 'staff']::public.app_role[])
  and updated_by = auth.uid()
);

create policy "order_items_select_member"
on public.order_items for select to authenticated
using (public.is_organization_member(organization_id));

create policy "order_items_insert_member"
on public.order_items for insert to authenticated
with check (
  public.has_organization_role(organization_id, array['owner', 'manager', 'staff']::public.app_role[])
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

create policy "order_items_update_member"
on public.order_items for update to authenticated
using (public.has_organization_role(organization_id, array['owner', 'manager', 'staff']::public.app_role[]))
with check (
  public.has_organization_role(organization_id, array['owner', 'manager', 'staff']::public.app_role[])
  and updated_by = auth.uid()
);

create policy "order_items_delete_draft_member"
on public.order_items for delete to authenticated
using (
  public.has_organization_role(organization_id, array['owner', 'manager', 'staff']::public.app_role[])
  and exists (
    select 1 from public.orders
    where orders.id = order_items.order_id
      and orders.organization_id = order_items.organization_id
      and orders.production_status = 'draft'
  )
);

create policy "order_status_history_select_member"
on public.order_status_history for select to authenticated
using (public.is_organization_member(organization_id));

grant usage on type public.service_unit_type to authenticated;
grant usage on type public.production_status to authenticated;
grant usage on type public.order_priority to authenticated;
grant select, insert, update on public.services to authenticated;
grant select, insert, update on public.service_prices to authenticated;
grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant select on public.order_status_history to authenticated;
grant execute on function public.create_order(uuid, uuid, uuid, public.order_priority, timestamptz, text, text) to authenticated;
grant execute on function public.save_order_item(uuid, uuid, uuid, text, public.service_unit_type, numeric, numeric, text) to authenticated;
grant execute on function public.remove_order_item(uuid, uuid) to authenticated;
grant execute on function public.transition_order_status(uuid, public.production_status, text) to authenticated;
grant execute on function public.update_order_discount(uuid, numeric) to authenticated;
grant execute on function public.update_order_details(uuid, public.order_priority, timestamptz, text, text) to authenticated;

revoke all on function public.app_current_organization_id() from public;
revoke all on function public.protect_service_immutable_fields() from public;
revoke all on function public.protect_order_immutable_fields() from public;
revoke all on function public.validate_order_relationships() from public;
revoke all on function public.protect_order_item_mutation() from public;
revoke all on function public.protect_order_status_history() from public;
revoke all on function public.recalculate_order_totals(uuid) from public;
revoke all on function public.create_order(uuid, uuid, uuid, public.order_priority, timestamptz, text, text) from public;
revoke all on function public.save_order_item(uuid, uuid, uuid, text, public.service_unit_type, numeric, numeric, text) from public;
revoke all on function public.remove_order_item(uuid, uuid) from public;
revoke all on function public.transition_order_status(uuid, public.production_status, text) from public;
revoke all on function public.update_order_discount(uuid, numeric) from public;
revoke all on function public.update_order_details(uuid, public.order_priority, timestamptz, text, text) from public;
