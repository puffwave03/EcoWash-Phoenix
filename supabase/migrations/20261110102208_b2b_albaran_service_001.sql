-- B2B-ALBARAN-SERVICE-001: commercial, non-fiscal service evidence only.
-- No existing Orders, production, Payments, REC, Billing or Accounting writers change.
begin;

create table public.service_albaran_number_counters (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  sequence_year integer not null check (sequence_year between 2000 and 9999),
  last_value bigint not null check (last_value > 0),
  primary key (organization_id, sequence_year)
);

create table public.service_albarans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  order_id uuid not null,
  customer_id uuid not null,
  location_id uuid not null,
  property_id uuid,
  completion_event_id uuid not null references public.order_status_history(id) on delete restrict,
  request_id uuid not null,
  document_number text not null,
  sequence_year integer not null check (sequence_year between 2000 and 9999),
  sequence_number bigint not null check (sequence_number > 0),
  document_status text not null default 'issued' check (document_status in ('issued', 'cancelled')),
  issued_at timestamptz not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id) on delete restrict,
  cancellation_reason text,
  snapshot_version integer not null default 1 check (snapshot_version = 1),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  constraint service_albarans_order_same_org foreign key (organization_id, order_id)
    references public.orders(organization_id, id) on delete restrict,
  constraint service_albarans_customer_same_org foreign key (organization_id, customer_id)
    references public.customers(organization_id, id) on delete restrict,
  constraint service_albarans_location_same_org foreign key (organization_id, location_id)
    references public.locations(organization_id, id) on delete restrict,
  constraint service_albarans_property_same_org foreign key (organization_id, property_id)
    references public.properties(organization_id, id) on delete restrict,
  constraint service_albarans_request_unique unique (organization_id, request_id),
  constraint service_albarans_number_unique unique (organization_id, document_number),
  constraint service_albarans_sequence_unique unique (organization_id, sequence_year, sequence_number),
  constraint service_albarans_status_consistent check (
    (document_status = 'issued' and cancelled_at is null and cancelled_by is null and cancellation_reason is null)
    or (document_status = 'cancelled' and cancelled_at is not null and cancelled_by is not null
      and nullif(btrim(cancellation_reason), '') is not null and length(cancellation_reason) <= 500)
  )
);
create unique index service_albarans_one_issued_per_order
  on public.service_albarans(organization_id, order_id) where document_status = 'issued';
create index service_albarans_order_history
  on public.service_albarans(organization_id, order_id, issued_at desc, id desc);

create function public.protect_service_albaran_history()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if current_setting('app.service_albaran_mutation', true) is distinct from 'on'
      or new.created_by is distinct from auth.uid()
      or not exists (select 1 from public.order_status_history h
        where h.id = new.completion_event_id and h.organization_id = new.organization_id
          and h.order_id = new.order_id and h.to_status = 'completed') then
      raise exception 'service_albaran_rpc_required' using errcode = '42501';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'service_albaran_history_immutable' using errcode = '55000';
  end if;
  if current_setting('app.service_albaran_mutation', true) is distinct from 'on'
    or old.document_status <> 'issued' or new.document_status <> 'cancelled'
    or new.cancelled_by is distinct from auth.uid()
    or (to_jsonb(new) - array['document_status','cancelled_at','cancelled_by','cancellation_reason'])
      is distinct from (to_jsonb(old) - array['document_status','cancelled_at','cancelled_by','cancellation_reason']) then
    raise exception 'service_albaran_history_immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;
create trigger service_albarans_immutable before insert or update or delete
  on public.service_albarans for each row execute function public.protect_service_albaran_history();

create function public.issue_service_albaran(target_order_id uuid, target_request_id uuid, target_previous_albaran_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  org_id uuid := public.app_current_organization_id();
  actor_id uuid := auth.uid();
  parent public.orders%rowtype;
  customer public.customers%rowtype;
  site public.locations%rowtype;
  property public.properties%rowtype;
  organization public.organizations%rowtype;
  completion public.order_status_history%rowtype;
  previous public.service_albarans%rowtype;
  issued_time timestamptz := statement_timestamp();
  allocated_year integer;
  allocated_sequence bigint;
  allocated_number text;
  items_snapshot jsonb;
  result_id uuid;
  previous_mutation text;
begin
  if actor_id is null or org_id is null or not coalesce(public.is_organization_member(org_id), false)
    or not coalesce(public.has_operational_capability(org_id, 'pos'::public.operational_capability), false)
    or not coalesce(public.organization_entitlement_is_enabled(org_id, 'printing', issued_time), false) then
    raise exception 'service_albaran_not_authorized' using errcode = '42501';
  end if;
  if target_request_id is null then
    raise exception 'service_albaran_request_required' using errcode = '22023';
  end if;
  -- Canonical order lock serializes issue/cancel and existing order mutations.
  select * into parent from public.orders where organization_id = org_id and id = target_order_id for update;
  if parent.id is null then
    raise exception 'service_albaran_invalid_order' using errcode = '22023';
  end if;
  select * into previous from public.service_albarans where organization_id = org_id and request_id = target_request_id;
  if previous.id is not null then
    if previous.order_id <> target_order_id then
      raise exception 'service_albaran_request_conflict' using errcode = '22023';
    end if;
    return previous.id; -- Even after cancellation, an old request never issues another document.
  end if;
  select * into previous from public.service_albarans
    where organization_id = org_id and order_id = target_order_id and document_status = 'issued';
  if previous.id is not null then return previous.id; end if;
  -- A stale form must not reissue after somebody cancelled a document.
  select * into previous from public.service_albarans where organization_id = org_id and order_id = target_order_id
    order by sequence_year desc, sequence_number desc limit 1;
  if previous.id is distinct from target_previous_albaran_id then
    raise exception 'service_albaran_history_changed' using errcode = '55000';
  end if;
  if not parent.is_active or parent.production_status <> 'completed' or parent.completed_at is null
    or parent.location_id is null then
    raise exception 'service_albaran_invalid_order' using errcode = '22023';
  end if;
  select * into customer from public.customers where organization_id = org_id and id = parent.customer_id for share;
  if customer.id is null or customer.customer_type <> 'business' then
    raise exception 'service_albaran_business_customer_required' using errcode = '22023';
  end if;
  -- This is a recorded operational event, NOT a declaration of physical execution time.
  select * into completion from public.order_status_history
    where organization_id = org_id and order_id = parent.id and to_status = 'completed'
      and changed_at = parent.completed_at
    order by changed_at desc, id desc limit 1;
  if completion.id is null or completion.changed_at > issued_time
    or exists (select 1 from public.order_status_history h where h.organization_id = org_id
      and h.order_id = parent.id and h.changed_at > completion.changed_at and h.to_status <> 'completed') then
    raise exception 'service_albaran_completion_evidence_required' using errcode = '22023';
  end if;
  select * into organization from public.organizations where id = org_id for share;
  select * into site from public.locations where organization_id = org_id and id = parent.location_id for share;
  if parent.property_id is not null then
    select * into property from public.properties where organization_id = org_id and id = parent.property_id for share;
    if property.id is null or property.customer_id <> parent.customer_id then
      raise exception 'service_albaran_invalid_order' using errcode = '22023';
    end if;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'description', i.description,
    'quantity', i.quantity, 'unitType', i.unit_type) order by i.sort_order, i.created_at, i.id), '[]'::jsonb)
    into items_snapshot from public.order_items i where i.organization_id = org_id and i.order_id = parent.id and i.is_active;
  if jsonb_array_length(items_snapshot) = 0 then
    raise exception 'service_albaran_items_required' using errcode = '22023';
  end if;
  allocated_year := extract(year from issued_time at time zone organization.timezone)::integer;
  insert into public.service_albaran_number_counters(organization_id, sequence_year, last_value)
    values(org_id, allocated_year, 1)
    on conflict (organization_id, sequence_year) do update
      set last_value = public.service_albaran_number_counters.last_value + 1
    returning last_value into allocated_sequence;
  allocated_number := 'ALB-' || allocated_year::text || '-' || lpad(allocated_sequence::text, greatest(6, length(allocated_sequence::text)), '0');
  previous_mutation := current_setting('app.service_albaran_mutation', true);
  perform set_config('app.service_albaran_mutation', 'on', true);
  insert into public.service_albarans(organization_id, order_id, customer_id, location_id, property_id,
    completion_event_id, request_id, document_number, sequence_year, sequence_number, issued_at, created_by, snapshot)
  values(org_id, parent.id, customer.id, site.id, property.id, completion.id, target_request_id,
    allocated_number, allocated_year, allocated_sequence, issued_time, actor_id,
    jsonb_build_object('version', 1, 'document', jsonb_build_object('number', allocated_number, 'issuedAt', issued_time),
      'organization', jsonb_build_object('id', org_id, 'name', organization.name, 'timezone', organization.timezone),
      'location', jsonb_build_object('id', site.id, 'name', site.name),
      'customer', jsonb_build_object('id', customer.id, 'name', coalesce(nullif(btrim(customer.company_name), ''), customer.display_name)),
      'property', case when property.id is null then null else jsonb_build_object('id', property.id, 'name', property.name) end,
      'order', jsonb_build_object('id', parent.id, 'number', parent.order_number),
      'completion', jsonb_build_object('eventId', completion.id, 'recordedAt', completion.changed_at), 'items', items_snapshot))
  returning id into result_id;
  perform set_config('app.service_albaran_mutation', coalesce(previous_mutation, ''), true);
  return result_id;
end;
$$;

create function public.cancel_service_albaran(target_order_id uuid, target_albaran_id uuid, target_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  org_id uuid := public.app_current_organization_id();
  parent_id uuid;
  normalized_reason text := nullif(btrim(target_reason), '');
  previous_mutation text;
begin
  if auth.uid() is null or org_id is null or not coalesce(public.is_organization_member(org_id), false)
    or not coalesce(public.has_organization_role(org_id, array['owner','manager']::public.app_role[]), false)
    or not coalesce(public.organization_entitlement_is_enabled(org_id, 'printing', statement_timestamp()), false) then
    raise exception 'service_albaran_not_authorized' using errcode = '42501';
  end if;
  if normalized_reason is null or length(normalized_reason) > 500 then
    raise exception 'service_albaran_reason_required' using errcode = '22023';
  end if;
  select order_id into parent_id from public.service_albarans
    where organization_id = org_id and order_id = target_order_id and id = target_albaran_id;
  if parent_id is null then raise exception 'service_albaran_not_found' using errcode = '22023'; end if;
  perform 1 from public.orders where organization_id = org_id and id = parent_id for update;
  -- Same lock order as issue: order -> document -> (issue only) counter.
  if exists (select 1 from public.service_albarans where organization_id = org_id and id = target_albaran_id
    and document_status = 'cancelled' and cancellation_reason = normalized_reason) then return; end if;
  previous_mutation := current_setting('app.service_albaran_mutation', true);
  perform set_config('app.service_albaran_mutation', 'on', true);
  update public.service_albarans set document_status = 'cancelled', cancelled_at = statement_timestamp(),
    cancelled_by = auth.uid(), cancellation_reason = normalized_reason
    where organization_id = org_id and id = target_albaran_id and document_status = 'issued';
  if not found then raise exception 'service_albaran_invalid_issued' using errcode = '22023'; end if;
  perform set_config('app.service_albaran_mutation', coalesce(previous_mutation, ''), true);
end;
$$;

alter table public.service_albarans enable row level security;
alter table public.service_albaran_number_counters enable row level security;
create policy service_albarans_select_print_access on public.service_albarans for select to authenticated using (
  public.is_organization_member(organization_id)
  and public.has_operational_capability(organization_id, 'pos'::public.operational_capability)
  and public.has_organization_entitlement(organization_id, 'printing')
);
revoke all on table public.service_albarans, public.service_albaran_number_counters from public, anon, authenticated, service_role;
grant select on table public.service_albarans to authenticated;
revoke all on function public.protect_service_albaran_history() from public, anon, authenticated, service_role;
revoke all on function public.issue_service_albaran(uuid, uuid, uuid), public.cancel_service_albaran(uuid, uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.issue_service_albaran(uuid, uuid, uuid), public.cancel_service_albaran(uuid, uuid, text) to authenticated;
commit;
