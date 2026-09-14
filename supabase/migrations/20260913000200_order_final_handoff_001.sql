-- ORDER-FINAL-HANDOFF-001 records final in-store customer collection as an
-- immutable fulfillment fact, distinct from inbound pickup and delivery.
create table public.order_customer_handoffs (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  order_id uuid not null,
  location_id uuid,
  completed_at timestamptz not null default now(),
  completed_by uuid not null references public.profiles (id) on delete restrict,
  notes text,
  balance_due_at_handoff numeric(12,2) not null,
  balance_currency text not null,
  unpaid_balance_acknowledged boolean not null default false,
  created_at timestamptz not null default now(),
  constraint order_customer_handoffs_order_same_org foreign key (organization_id, order_id)
    references public.orders (organization_id, id) on delete restrict,
  constraint order_customer_handoffs_location_same_org foreign key (organization_id, location_id)
    references public.locations (organization_id, id) on delete restrict,
  constraint order_customer_handoffs_org_id_unique unique (organization_id, id),
  constraint order_customer_handoffs_order_unique unique (organization_id, order_id),
  constraint order_customer_handoffs_balance_non_negative check (balance_due_at_handoff >= 0),
  constraint order_customer_handoffs_currency_valid check (
    balance_currency = upper(balance_currency) and length(balance_currency) = 3
  ),
  constraint order_customer_handoffs_ack_consistent check (
    (balance_due_at_handoff > 0 and unpaid_balance_acknowledged)
    or (balance_due_at_handoff = 0 and not unpaid_balance_acknowledged)
  )
);

create index order_customer_handoffs_completed_idx
on public.order_customer_handoffs (organization_id, completed_at desc, id);

create function public.protect_order_customer_handoff_history()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if current_setting('app.customer_handoff_mutation', true) is distinct from 'on' then
      raise exception 'customer_handoff_rpc_required' using errcode = '42501';
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'customer_handoff_delete_forbidden' using errcode = '55000';
  end if;

  raise exception 'customer_handoff_immutable' using errcode = '55000';
end;
$$;

create trigger order_customer_handoffs_immutable
before insert or update or delete on public.order_customer_handoffs
for each row execute function public.protect_order_customer_handoff_history();

create function public.complete_customer_handoff(
  target_order_id uuid,
  target_confirm_unpaid boolean,
  target_notes text
)
returns public.order_customer_handoffs
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  org_id uuid := public.app_current_organization_id();
  target_order public.orders%rowtype;
  canonical_handoff public.order_customer_handoffs%rowtype;
  current_balance numeric(12,2);
begin
  if actor_id is null then
    raise exception 'customer_handoff_not_authorized' using errcode = '42501';
  end if;

  perform public.require_pos_access(org_id);

  select * into target_order
  from public.orders orders
  where orders.id = target_order_id
    and orders.organization_id = org_id
  for update;

  if target_order.id is null or not target_order.is_active or target_order.production_status = 'cancelled' then
    raise exception 'customer_handoff_invalid_order' using errcode = '22023';
  end if;

  if target_order.production_status <> 'completed' then
    raise exception 'customer_handoff_production_incomplete' using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.deliveries delivery
    where delivery.organization_id = org_id
      and delivery.order_id = target_order_id
      and delivery.status in ('scheduled', 'in_progress', 'completed')
  ) then
    raise exception 'customer_handoff_delivery_conflict' using errcode = '55000';
  end if;

  select * into canonical_handoff
  from public.order_customer_handoffs handoff
  where handoff.organization_id = org_id
    and handoff.order_id = target_order_id;

  if canonical_handoff.id is not null then
    return canonical_handoff;
  end if;

  select summary.balance_due
  into current_balance
  from public.get_order_payment_summary(target_order_id) summary;

  if current_balance > 0 and not coalesce(target_confirm_unpaid, false) then
    raise exception 'customer_handoff_unpaid_confirmation_required' using errcode = '55000';
  end if;

  perform set_config('app.customer_handoff_mutation', 'on', true);

  insert into public.order_customer_handoffs (
    organization_id,
    order_id,
    location_id,
    completed_at,
    completed_by,
    notes,
    balance_due_at_handoff,
    balance_currency,
    unpaid_balance_acknowledged
  )
  values (
    org_id,
    target_order_id,
    target_order.location_id,
    now(),
    actor_id,
    nullif(left(btrim(target_notes), 1000), ''),
    current_balance,
    target_order.currency,
    current_balance > 0
  )
  returning * into canonical_handoff;

  return canonical_handoff;
end;
$$;

create or replace function public.create_or_update_delivery(
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
  existing_status public.fulfillment_status;
  org_id uuid;
  parent_status public.production_status;
  result_id uuid;
begin
  org_id := public.app_current_organization_id();

  if not public.has_organization_role(org_id, array['owner', 'manager', 'staff']::public.app_role[]) then
    raise exception 'not authorized';
  end if;

  select orders.production_status
  into parent_status
  from public.orders orders
  where orders.id = target_order_id
    and orders.organization_id = org_id
    and orders.is_active
  for update;

  if parent_status is null or parent_status = 'cancelled' then
    raise exception 'invalid order';
  end if;

  if exists (
    select 1
    from public.order_customer_handoffs handoff
    where handoff.organization_id = org_id
      and handoff.order_id = target_order_id
  ) then
    raise exception 'customer_handoff_already_completed' using errcode = '55000';
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
    select status into existing_status
    from public.deliveries
    where id = target_delivery_id
      and order_id = target_order_id
      and organization_id = org_id
    for update;

    if existing_status is null or existing_status not in ('scheduled', 'in_progress', 'completed') then
      raise exception 'invalid delivery';
    end if;

    if existing_status = 'completed'
      and not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
      raise exception 'not authorized';
    end if;

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
    returning id into result_id;
  end if;

  if result_id is null then
    raise exception 'invalid delivery';
  end if;

  return result_id;
end;
$$;

create or replace function public.transition_delivery_status(
  target_delivery_id uuid,
  target_status public.fulfillment_status,
  target_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  actor_role public.app_role;
  current_status public.fulfillment_status;
  current_assigned_to uuid;
  parent_order_id uuid;
  parent_is_active boolean;
  parent_production_status public.production_status;
  allowed boolean := false;
begin
  org_id := public.app_current_organization_id();

  select membership.role into actor_role
  from public.organization_memberships membership
  where membership.organization_id = org_id
    and membership.profile_id = auth.uid()
    and membership.is_active;

  select delivery.status,
         delivery.assigned_to,
         orders.id,
         orders.is_active,
         orders.production_status
  into current_status,
       current_assigned_to,
       parent_order_id,
       parent_is_active,
       parent_production_status
  from public.deliveries delivery
  join public.orders orders
    on orders.organization_id = delivery.organization_id
   and orders.id = delivery.order_id
  where delivery.id = target_delivery_id
    and delivery.organization_id = org_id
  for update of delivery, orders;

  if current_status is null
    or not public.has_operational_capability(org_id, 'delivery')
    or (actor_role = 'staff' and current_assigned_to is distinct from auth.uid()) then
    raise exception 'not authorized';
  end if;

  if target_status in ('in_progress', 'completed')
    and exists (
      select 1
      from public.order_customer_handoffs handoff
      where handoff.organization_id = org_id
        and handoff.order_id = parent_order_id
    ) then
    raise exception 'customer_handoff_already_completed' using errcode = '55000';
  end if;

  if target_status in ('in_progress', 'completed')
    and (not parent_is_active or parent_production_status in ('draft', 'cancelled')) then
    raise exception 'logistics parent not operational';
  end if;

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

alter table public.order_customer_handoffs enable row level security;

create policy order_customer_handoffs_select_membership on public.order_customer_handoffs
for select to authenticated using (public.is_organization_member(organization_id));

revoke all on table public.order_customer_handoffs from public, anon, authenticated;
grant select on table public.order_customer_handoffs to authenticated;

revoke all on function public.protect_order_customer_handoff_history() from public, anon, authenticated;
revoke all on function public.complete_customer_handoff(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.complete_customer_handoff(uuid, boolean, text) to authenticated;
