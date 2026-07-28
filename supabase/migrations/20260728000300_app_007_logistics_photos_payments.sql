create type public.fulfillment_status as enum ('not_required', 'scheduled', 'in_progress', 'completed', 'cancelled');
create type public.payment_method as enum ('cash', 'card', 'bank_transfer', 'other');
create type public.payment_record_status as enum ('pending', 'confirmed', 'void', 'refunded');
create type public.photo_category as enum ('intake', 'processing', 'quality', 'issue', 'delivery', 'payment_proof');

create table public.pickups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  status public.fulfillment_status not null default 'scheduled',
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  assigned_to uuid references public.profiles(id) on delete restrict,
  address_line1 text,
  address_line2 text,
  city text,
  postal_code text,
  country_code char(2),
  contact_name text,
  contact_phone text,
  notes text,
  cancellation_reason text,
  fee numeric(12,2) not null default 0,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pickups_fee_non_negative check (fee >= 0),
  constraint pickups_completed_at_required check (status <> 'completed' or completed_at is not null),
  constraint pickups_cancel_reason_required check (status <> 'cancelled' or cancellation_reason is not null),
  constraint pickups_country_upper check (country_code is null or country_code = upper(country_code)),
  constraint pickups_order_org_unique unique (organization_id, id),
  constraint pickups_order_same_org foreign key (organization_id, order_id) references public.orders(organization_id, id) on delete restrict
);

create unique index pickups_one_active_per_order_idx
on public.pickups (organization_id, order_id)
where status <> 'cancelled';

create index pickups_order_id_idx on public.pickups (order_id);
create index pickups_assigned_to_idx on public.pickups (organization_id, assigned_to) where assigned_to is not null;
create index pickups_status_idx on public.pickups (organization_id, status);

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  status public.fulfillment_status not null default 'scheduled',
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  assigned_to uuid references public.profiles(id) on delete restrict,
  address_line1 text,
  address_line2 text,
  city text,
  postal_code text,
  country_code char(2),
  contact_name text,
  contact_phone text,
  notes text,
  cancellation_reason text,
  fee numeric(12,2) not null default 0,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deliveries_fee_non_negative check (fee >= 0),
  constraint deliveries_completed_at_required check (status <> 'completed' or completed_at is not null),
  constraint deliveries_cancel_reason_required check (status <> 'cancelled' or cancellation_reason is not null),
  constraint deliveries_country_upper check (country_code is null or country_code = upper(country_code)),
  constraint deliveries_order_org_unique unique (organization_id, id),
  constraint deliveries_order_same_org foreign key (organization_id, order_id) references public.orders(organization_id, id) on delete restrict
);

create unique index deliveries_one_active_per_order_idx
on public.deliveries (organization_id, order_id)
where status <> 'cancelled';

create index deliveries_order_id_idx on public.deliveries (order_id);
create index deliveries_assigned_to_idx on public.deliveries (organization_id, assigned_to) where assigned_to is not null;
create index deliveries_status_idx on public.deliveries (organization_id, status);

create table public.order_photos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  category public.photo_category not null,
  storage_bucket text not null default 'order-media',
  storage_path text not null,
  original_filename text,
  mime_type text not null,
  size_bytes bigint not null,
  caption text,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  is_active boolean not null default true,
  constraint order_photos_order_same_org foreign key (organization_id, order_id) references public.orders(organization_id, id) on delete restrict,
  constraint order_photos_bucket_check check (storage_bucket = 'order-media'),
  constraint order_photos_size_limit check (size_bytes > 0 and size_bytes <= 1048576),
  constraint order_photos_mime_check check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint order_photos_org_id_unique unique (organization_id, id),
  constraint order_photos_path_unique unique (storage_bucket, storage_path),
  constraint order_photos_path_shape check (storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$')
);

create index order_photos_order_id_idx on public.order_photos (order_id);
create index order_photos_active_idx on public.order_photos (organization_id, order_id) where is_active;

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  amount numeric(12,2) not null,
  method public.payment_method not null,
  status public.payment_record_status not null default 'confirmed',
  paid_at timestamptz not null default now(),
  reference text,
  notes text,
  proof_photo_id uuid references public.order_photos(id) on delete restrict,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  confirmed_by uuid references public.profiles(id) on delete restrict,
  voided_by uuid references public.profiles(id) on delete restrict,
  refunded_from_payment_id uuid references public.payments(id) on delete restrict,
  void_reason text,
  refund_reason text,
  voided_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_order_same_org foreign key (organization_id, order_id) references public.orders(organization_id, id) on delete restrict,
  constraint payments_amount_positive check (amount > 0),
  constraint payments_reference_limit check (reference is null or char_length(reference) <= 180),
  constraint payments_void_audit check (status <> 'void' or (voided_by is not null and voided_at is not null and void_reason is not null)),
  constraint payments_refund_audit check (status <> 'refunded' or (refunded_at is not null and refund_reason is not null)),
  constraint payments_refund_source check ((status = 'refunded') = (refunded_from_payment_id is not null)),
  constraint payments_proof_same_org foreign key (organization_id, proof_photo_id) references public.order_photos(organization_id, id) on delete restrict
);

create index payments_order_id_idx on public.payments (order_id);
create index payments_status_idx on public.payments (organization_id, status);
create index payments_refund_source_idx on public.payments (refunded_from_payment_id) where refunded_from_payment_id is not null;

create trigger pickups_set_updated_at
before update on public.pickups
for each row execute function public.set_updated_at();

create trigger deliveries_set_updated_at
before update on public.deliveries
for each row execute function public.set_updated_at();

create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create function public.prevent_app_007_direct_mutation()
returns trigger
language plpgsql
as $$
begin
  if current_setting('app.app_007_mutation', true) <> 'on' then
    raise exception 'mutations require APP-007 RPC';
  end if;

  if tg_op = 'DELETE' then
    raise exception 'hard delete is not allowed';
  end if;

  if new.organization_id <> old.organization_id then
    raise exception 'organization_id cannot be changed';
  end if;

  return new;
end;
$$;

create trigger pickups_controlled_mutation
before update or delete on public.pickups
for each row execute function public.prevent_app_007_direct_mutation();

create trigger deliveries_controlled_mutation
before update or delete on public.deliveries
for each row execute function public.prevent_app_007_direct_mutation();

create trigger payments_controlled_mutation
before update or delete on public.payments
for each row execute function public.prevent_app_007_direct_mutation();

create trigger order_photos_controlled_mutation
before update or delete on public.order_photos
for each row execute function public.prevent_app_007_direct_mutation();

create function public.ensure_app_007_insert_context()
returns trigger
language plpgsql
as $$
begin
  if current_setting('app.app_007_mutation', true) <> 'on' then
    raise exception 'inserts require APP-007 RPC';
  end if;

  return new;
end;
$$;

create trigger pickups_controlled_insert
before insert on public.pickups
for each row execute function public.ensure_app_007_insert_context();

create trigger deliveries_controlled_insert
before insert on public.deliveries
for each row execute function public.ensure_app_007_insert_context();

create trigger payments_controlled_insert
before insert on public.payments
for each row execute function public.ensure_app_007_insert_context();

create trigger order_photos_controlled_insert
before insert on public.order_photos
for each row execute function public.ensure_app_007_insert_context();

create function public.validate_app_007_assignment(target_organization_id uuid, target_profile_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if target_profile_id is null then
    return;
  end if;

  if not exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = target_organization_id
      and membership.profile_id = target_profile_id
      and membership.is_active
  ) then
    raise exception 'assigned user must be active in organization';
  end if;
end;
$$;

create function public.get_order_payment_summary(target_order_id uuid)
returns table(total_due numeric, total_paid numeric, balance_due numeric, payment_status text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid;
  order_total numeric(12,2);
  confirmed_total numeric(12,2);
  paid_total numeric(12,2);
  refunded_total numeric(12,2);
  void_count integer;
begin
  org_id := public.app_current_organization_id();

  select total into order_total
  from public.orders
  where id = target_order_id
    and organization_id = org_id
    and is_active;

  if order_total is null then
    raise exception 'invalid order';
  end if;

  select coalesce(sum(case
    when status = 'confirmed' then amount
    else 0
  end), 0)
  into confirmed_total
  from public.payments
  where order_id = target_order_id
    and organization_id = org_id;

  select coalesce(sum(case
    when status = 'refunded' then amount
    else 0
  end), 0)
  into refunded_total
  from public.payments
  where order_id = target_order_id
    and organization_id = org_id;

  select count(*)
  into void_count
  from public.payments
  where order_id = target_order_id
    and organization_id = org_id
    and status = 'void';

  paid_total := confirmed_total - refunded_total;

  total_due := round(order_total, 2);
  total_paid := round(paid_total, 2);
  balance_due := round(greatest(order_total - paid_total, 0), 2);
  payment_status := case
    when order_total <= 0 then 'paid'
    when paid_total <= 0 and refunded_total > 0 then 'refunded'
    when paid_total <= 0 and confirmed_total = 0 and void_count > 0 then 'void'
    when paid_total <= 0 then 'unpaid'
    when paid_total < order_total then 'partially_paid'
    else 'paid'
  end;

  return next;
end;
$$;

create function public.create_or_update_pickup(
  target_order_id uuid,
  target_pickup_id uuid,
  target_scheduled_at timestamptz,
  target_assigned_to uuid,
  target_address_line1 text,
  target_address_line2 text,
  target_city text,
  target_postal_code text,
  target_country_code text,
  target_contact_name text,
  target_contact_phone text,
  target_notes text,
  target_fee numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  result_id uuid;
begin
  org_id := public.app_current_organization_id();

  if not public.has_organization_role(org_id, array['owner', 'manager', 'staff']::public.app_role[]) then
    raise exception 'not authorized';
  end if;

  if not exists (select 1 from public.orders where id = target_order_id and organization_id = org_id and is_active) then
    raise exception 'invalid order';
  end if;

  perform public.validate_app_007_assignment(org_id, target_assigned_to);
  perform set_config('app.app_007_mutation', 'on', true);

  if target_pickup_id is null then
    insert into public.pickups (
      organization_id, order_id, scheduled_at, assigned_to, address_line1, address_line2,
      city, postal_code, country_code, contact_name, contact_phone, notes, fee, created_by, updated_by
    )
    values (
      org_id, target_order_id, target_scheduled_at, target_assigned_to, nullif(btrim(target_address_line1), ''),
      nullif(btrim(target_address_line2), ''), nullif(btrim(target_city), ''), nullif(btrim(target_postal_code), ''),
      nullif(upper(btrim(target_country_code)), ''), nullif(btrim(target_contact_name), ''),
      nullif(btrim(target_contact_phone), ''), nullif(btrim(target_notes), ''), coalesce(target_fee, 0), auth.uid(), auth.uid()
    )
    returning id into result_id;
  else
    update public.pickups
    set scheduled_at = target_scheduled_at,
        assigned_to = target_assigned_to,
        address_line1 = nullif(btrim(target_address_line1), ''),
        address_line2 = nullif(btrim(target_address_line2), ''),
        city = nullif(btrim(target_city), ''),
        postal_code = nullif(btrim(target_postal_code), ''),
        country_code = nullif(upper(btrim(target_country_code)), ''),
        contact_name = nullif(btrim(target_contact_name), ''),
        contact_phone = nullif(btrim(target_contact_phone), ''),
        notes = nullif(btrim(target_notes), ''),
        fee = coalesce(target_fee, 0),
        updated_by = auth.uid()
    where id = target_pickup_id
      and order_id = target_order_id
      and organization_id = org_id
      and status in ('scheduled', 'in_progress')
    returning id into result_id;
  end if;

  if result_id is null then
    raise exception 'invalid pickup';
  end if;

  return result_id;
end;
$$;

create function public.create_or_update_delivery(
  target_order_id uuid,
  target_delivery_id uuid,
  target_scheduled_at timestamptz,
  target_assigned_to uuid,
  target_address_line1 text,
  target_address_line2 text,
  target_city text,
  target_postal_code text,
  target_country_code text,
  target_contact_name text,
  target_contact_phone text,
  target_notes text,
  target_fee numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  result_id uuid;
begin
  org_id := public.app_current_organization_id();

  if not public.has_organization_role(org_id, array['owner', 'manager', 'staff']::public.app_role[]) then
    raise exception 'not authorized';
  end if;

  if not exists (select 1 from public.orders where id = target_order_id and organization_id = org_id and is_active) then
    raise exception 'invalid order';
  end if;

  perform public.validate_app_007_assignment(org_id, target_assigned_to);
  perform set_config('app.app_007_mutation', 'on', true);

  if target_delivery_id is null then
    insert into public.deliveries (
      organization_id, order_id, scheduled_at, assigned_to, address_line1, address_line2,
      city, postal_code, country_code, contact_name, contact_phone, notes, fee, created_by, updated_by
    )
    values (
      org_id, target_order_id, target_scheduled_at, target_assigned_to, nullif(btrim(target_address_line1), ''),
      nullif(btrim(target_address_line2), ''), nullif(btrim(target_city), ''), nullif(btrim(target_postal_code), ''),
      nullif(upper(btrim(target_country_code)), ''), nullif(btrim(target_contact_name), ''),
      nullif(btrim(target_contact_phone), ''), nullif(btrim(target_notes), ''), coalesce(target_fee, 0), auth.uid(), auth.uid()
    )
    returning id into result_id;
  else
    update public.deliveries
    set scheduled_at = target_scheduled_at,
        assigned_to = target_assigned_to,
        address_line1 = nullif(btrim(target_address_line1), ''),
        address_line2 = nullif(btrim(target_address_line2), ''),
        city = nullif(btrim(target_city), ''),
        postal_code = nullif(btrim(target_postal_code), ''),
        country_code = nullif(upper(btrim(target_country_code)), ''),
        contact_name = nullif(btrim(target_contact_name), ''),
        contact_phone = nullif(btrim(target_contact_phone), ''),
        notes = nullif(btrim(target_notes), ''),
        fee = coalesce(target_fee, 0),
        updated_by = auth.uid()
    where id = target_delivery_id
      and order_id = target_order_id
      and organization_id = org_id
      and status in ('scheduled', 'in_progress')
    returning id into result_id;
  end if;

  if result_id is null then
    raise exception 'invalid delivery';
  end if;

  return result_id;
end;
$$;

create function public.transition_pickup_status(target_pickup_id uuid, target_status public.fulfillment_status, target_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  current_status public.fulfillment_status;
  allowed boolean := false;
begin
  org_id := public.app_current_organization_id();

  if not public.has_organization_role(org_id, array['owner', 'manager', 'staff']::public.app_role[]) then
    raise exception 'not authorized';
  end if;

  select status into current_status
  from public.pickups
  where id = target_pickup_id and organization_id = org_id
  for update;

  if current_status = 'scheduled' then
    allowed := target_status in ('in_progress', 'cancelled');
  elsif current_status = 'in_progress' then
    allowed := target_status in ('completed', 'cancelled');
  end if;

  if not allowed then
    raise exception 'transition not allowed';
  end if;

  if target_status = 'cancelled' and nullif(btrim(target_reason), '') is null then
    raise exception 'reason required';
  end if;

  perform set_config('app.app_007_mutation', 'on', true);

  update public.pickups
  set status = target_status,
      started_at = case when target_status = 'in_progress' and started_at is null then now() else started_at end,
      completed_at = case when target_status = 'completed' then now() else completed_at end,
      cancellation_reason = case when target_status = 'cancelled' then nullif(btrim(target_reason), '') else cancellation_reason end,
      updated_by = auth.uid()
  where id = target_pickup_id and organization_id = org_id;
end;
$$;

create function public.transition_delivery_status(target_delivery_id uuid, target_status public.fulfillment_status, target_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  current_status public.fulfillment_status;
  allowed boolean := false;
begin
  org_id := public.app_current_organization_id();

  if not public.has_organization_role(org_id, array['owner', 'manager', 'staff']::public.app_role[]) then
    raise exception 'not authorized';
  end if;

  select status into current_status
  from public.deliveries
  where id = target_delivery_id and organization_id = org_id
  for update;

  if current_status = 'scheduled' then
    allowed := target_status in ('in_progress', 'cancelled');
  elsif current_status = 'in_progress' then
    allowed := target_status in ('completed', 'cancelled');
  end if;

  if not allowed then
    raise exception 'transition not allowed';
  end if;

  if target_status = 'cancelled' and nullif(btrim(target_reason), '') is null then
    raise exception 'reason required';
  end if;

  perform set_config('app.app_007_mutation', 'on', true);

  update public.deliveries
  set status = target_status,
      started_at = case when target_status = 'in_progress' and started_at is null then now() else started_at end,
      completed_at = case when target_status = 'completed' then now() else completed_at end,
      cancellation_reason = case when target_status = 'cancelled' then nullif(btrim(target_reason), '') else cancellation_reason end,
      updated_by = auth.uid()
  where id = target_delivery_id and organization_id = org_id;
end;
$$;

create function public.record_payment(
  target_order_id uuid,
  target_amount numeric,
  target_method public.payment_method,
  target_paid_at timestamptz,
  target_reference text,
  target_notes text,
  target_proof_photo_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  order_total numeric(12,2);
  paid_total numeric(12,2);
  result_id uuid;
begin
  org_id := public.app_current_organization_id();

  if not public.has_organization_role(org_id, array['owner', 'manager', 'staff']::public.app_role[]) then
    raise exception 'not authorized';
  end if;

  select total into order_total
  from public.orders
  where id = target_order_id and organization_id = org_id and is_active
  for update;

  if order_total is null then
    raise exception 'invalid order';
  end if;

  select total_paid into paid_total
  from public.get_order_payment_summary(target_order_id);

  if target_amount <= 0 or round(target_amount, 2) > round(order_total - paid_total, 2) then
    raise exception 'invalid payment amount';
  end if;

  if target_proof_photo_id is not null and not exists (
    select 1 from public.order_photos
    where id = target_proof_photo_id
      and organization_id = org_id
      and order_id = target_order_id
      and category = 'payment_proof'
      and is_active
  ) then
    raise exception 'invalid proof photo';
  end if;

  perform set_config('app.app_007_mutation', 'on', true);

  insert into public.payments (
    organization_id, order_id, amount, method, status, paid_at, reference, notes,
    proof_photo_id, recorded_by, confirmed_by
  )
  values (
    org_id, target_order_id, round(target_amount, 2), target_method, 'confirmed',
    coalesce(target_paid_at, now()), nullif(btrim(target_reference), ''),
    nullif(btrim(target_notes), ''), target_proof_photo_id, auth.uid(), auth.uid()
  )
  returning id into result_id;

  return result_id;
end;
$$;

create function public.void_payment(target_payment_id uuid, target_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  target_payment public.payments%rowtype;
begin
  org_id := public.app_current_organization_id();

  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'not authorized';
  end if;

  if nullif(btrim(target_reason), '') is null then
    raise exception 'reason required';
  end if;

  select * into target_payment
  from public.payments
  where id = target_payment_id
    and organization_id = org_id
    and status = 'confirmed'
  for update;

  if target_payment.id is null then
    raise exception 'invalid payment';
  end if;

  if exists (
    select 1
    from public.payments
    where refunded_from_payment_id = target_payment_id
      and organization_id = org_id
      and status = 'refunded'
  ) then
    raise exception 'refunded payment cannot be voided';
  end if;

  perform set_config('app.app_007_mutation', 'on', true);

  update public.payments
  set status = 'void',
      voided_by = auth.uid(),
      voided_at = now(),
      void_reason = nullif(btrim(target_reason), '')
  where id = target_payment_id
    and organization_id = org_id
    and status = 'confirmed';

  if not found then
    raise exception 'invalid payment';
  end if;
end;
$$;

create function public.refund_payment(target_payment_id uuid, target_amount numeric, target_reason text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  source_payment public.payments%rowtype;
  already_refunded numeric(12,2);
  result_id uuid;
begin
  org_id := public.app_current_organization_id();

  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'not authorized';
  end if;

  if target_amount <= 0 or nullif(btrim(target_reason), '') is null then
    raise exception 'invalid refund';
  end if;

  select * into source_payment
  from public.payments
  where id = target_payment_id
    and organization_id = org_id
    and status = 'confirmed'
  for update;

  if source_payment.id is null then
    raise exception 'invalid payment';
  end if;

  select coalesce(sum(amount), 0)
  into already_refunded
  from public.payments
  where refunded_from_payment_id = target_payment_id
    and organization_id = org_id
    and status = 'refunded';

  if round(target_amount, 2) > round(source_payment.amount - already_refunded, 2) then
    raise exception 'refund exceeds refundable amount';
  end if;

  perform set_config('app.app_007_mutation', 'on', true);

  insert into public.payments (
    organization_id, order_id, amount, method, status, paid_at, reference, notes,
    recorded_by, confirmed_by, refunded_from_payment_id, refund_reason, refunded_at
  )
  values (
    org_id, source_payment.order_id, round(target_amount, 2), source_payment.method, 'refunded',
    now(), source_payment.reference, null, auth.uid(), auth.uid(), target_payment_id,
    nullif(btrim(target_reason), ''), now()
  )
  returning id into result_id;

  return result_id;
end;
$$;

create function public.register_order_photo(
  target_order_id uuid,
  target_category public.photo_category,
  target_storage_path text,
  target_original_filename text,
  target_mime_type text,
  target_size_bytes bigint,
  target_caption text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  result_id uuid;
begin
  org_id := public.app_current_organization_id();

  if not public.has_organization_role(org_id, array['owner', 'manager', 'staff']::public.app_role[]) then
    raise exception 'not authorized';
  end if;

  if not exists (select 1 from public.orders where id = target_order_id and organization_id = org_id and is_active) then
    raise exception 'invalid order';
  end if;

  if split_part(target_storage_path, '/', 1) <> org_id::text
    or split_part(target_storage_path, '/', 2) <> target_order_id::text then
    raise exception 'invalid storage path';
  end if;

  perform set_config('app.app_007_mutation', 'on', true);

  insert into public.order_photos (
    organization_id, order_id, category, storage_bucket, storage_path,
    original_filename, mime_type, size_bytes, caption, uploaded_by
  )
  values (
    org_id, target_order_id, target_category, 'order-media', target_storage_path,
    nullif(btrim(target_original_filename), ''), target_mime_type, target_size_bytes,
    nullif(btrim(target_caption), ''), auth.uid()
  )
  returning id into result_id;

  return result_id;
end;
$$;

create function public.deactivate_order_photo(target_photo_id uuid)
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

  perform set_config('app.app_007_mutation', 'on', true);

  update public.order_photos
  set is_active = false
  where id = target_photo_id
    and organization_id = org_id
    and is_active;
end;
$$;

alter table public.pickups enable row level security;
alter table public.deliveries enable row level security;
alter table public.payments enable row level security;
alter table public.order_photos enable row level security;

create policy "pickups_select_member" on public.pickups
for select to authenticated
using (public.is_organization_member(organization_id));

create policy "deliveries_select_member" on public.deliveries
for select to authenticated
using (public.is_organization_member(organization_id));

create policy "payments_select_member" on public.payments
for select to authenticated
using (public.is_organization_member(organization_id));

create policy "order_photos_select_member" on public.order_photos
for select to authenticated
using (public.is_organization_member(organization_id));

create function public.app_order_media_path_is_valid(target_path text)
returns boolean
language sql
immutable
as $$
  select target_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$';
$$;

create function public.app_order_media_path_organization_id(target_path text)
returns uuid
language plpgsql
immutable
as $$
begin
  if not public.app_order_media_path_is_valid(target_path) then
    return null;
  end if;

  return split_part(target_path, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

create function public.app_order_media_path_order_id(target_path text)
returns uuid
language plpgsql
immutable
as $$
begin
  if not public.app_order_media_path_is_valid(target_path) then
    return null;
  end if;

  return split_part(target_path, '/', 2)::uuid;
exception when others then
  return null;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('order-media', 'order-media', false, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = 1048576,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create policy "order_media_select_member"
on storage.objects for select to authenticated
using (
  bucket_id = 'order-media'
  and public.app_order_media_path_is_valid(name)
  and public.is_organization_member(public.app_order_media_path_organization_id(name))
  and exists (
    select 1
    from public.orders
    where orders.organization_id = public.app_order_media_path_organization_id(name)
      and orders.id = public.app_order_media_path_order_id(name)
  )
);

create policy "order_media_insert_member"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'order-media'
  and owner = auth.uid()
  and public.app_order_media_path_is_valid(name)
  and public.has_organization_role(public.app_order_media_path_organization_id(name), array['owner', 'manager', 'staff']::public.app_role[])
  and exists (
    select 1
    from public.orders
    where orders.organization_id = public.app_order_media_path_organization_id(name)
      and orders.id = public.app_order_media_path_order_id(name)
  )
);

grant usage on type public.fulfillment_status to authenticated;
grant usage on type public.payment_method to authenticated;
grant usage on type public.payment_record_status to authenticated;
grant usage on type public.photo_category to authenticated;
grant select on public.pickups to authenticated;
grant select on public.deliveries to authenticated;
grant select on public.payments to authenticated;
grant select on public.order_photos to authenticated;
grant execute on function public.get_order_payment_summary(uuid) to authenticated;
grant execute on function public.create_or_update_pickup(uuid, uuid, timestamptz, uuid, text, text, text, text, text, text, text, text, numeric) to authenticated;
grant execute on function public.create_or_update_delivery(uuid, uuid, timestamptz, uuid, text, text, text, text, text, text, text, text, numeric) to authenticated;
grant execute on function public.transition_pickup_status(uuid, public.fulfillment_status, text) to authenticated;
grant execute on function public.transition_delivery_status(uuid, public.fulfillment_status, text) to authenticated;
grant execute on function public.record_payment(uuid, numeric, public.payment_method, timestamptz, text, text, uuid) to authenticated;
grant execute on function public.void_payment(uuid, text) to authenticated;
grant execute on function public.refund_payment(uuid, numeric, text) to authenticated;
grant execute on function public.register_order_photo(uuid, public.photo_category, text, text, text, bigint, text) to authenticated;
grant execute on function public.deactivate_order_photo(uuid) to authenticated;
grant execute on function public.app_order_media_path_is_valid(text) to authenticated;
grant execute on function public.app_order_media_path_organization_id(text) to authenticated;
grant execute on function public.app_order_media_path_order_id(text) to authenticated;

revoke all on function public.prevent_app_007_direct_mutation() from public;
revoke all on function public.ensure_app_007_insert_context() from public;
revoke all on function public.validate_app_007_assignment(uuid, uuid) from public;
revoke all on function public.get_order_payment_summary(uuid) from public;
revoke all on function public.create_or_update_pickup(uuid, uuid, timestamptz, uuid, text, text, text, text, text, text, text, text, numeric) from public;
revoke all on function public.create_or_update_delivery(uuid, uuid, timestamptz, uuid, text, text, text, text, text, text, text, text, numeric) from public;
revoke all on function public.transition_pickup_status(uuid, public.fulfillment_status, text) from public;
revoke all on function public.transition_delivery_status(uuid, public.fulfillment_status, text) from public;
revoke all on function public.record_payment(uuid, numeric, public.payment_method, timestamptz, text, text, uuid) from public;
revoke all on function public.void_payment(uuid, text) from public;
revoke all on function public.refund_payment(uuid, numeric, text) from public;
revoke all on function public.register_order_photo(uuid, public.photo_category, text, text, text, bigint, text) from public;
revoke all on function public.deactivate_order_photo(uuid) from public;
revoke all on function public.app_order_media_path_is_valid(text) from public;
revoke all on function public.app_order_media_path_organization_id(text) from public;
revoke all on function public.app_order_media_path_order_id(text) from public;
