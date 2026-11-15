-- TICKET-UNICO-001: additive, default-off, one verified pilot only.
-- No historical order classification, invoice, payment or REC is rewritten.
begin;
set local lock_timeout='5s';
alter table public.orders
 add column fiscal_route text not null default 'review_required'
  check(fiscal_route in ('automatic_simplified','manual_billing','review_required')),
 add column service_completion_evidence jsonb;
alter table public.organization_billing_settings
 add column ticket_unico_enabled boolean not null default false;
comment on column public.organization_billing_settings.ticket_unico_enabled is
 'Default-off approved pilot laundry catalogue scope (ES-CN IGIC 7%). Activation requires separate approval; never a universal fiscal policy.';

create function public.ticket_unico_pilot(target_org uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(target_org='e09f1e0b-1c4d-4450-9a30-79999bee545a'::uuid
  and exists(select 1 from public.organization_billing_settings s where s.organization_id=target_org
   and s.ticket_unico_enabled and s.simplified_invoicing_enabled
   and public.organization_entitlement_is_enabled(target_org,'billing.invoicing',now())),false);
$$;
revoke all on function public.ticket_unico_pilot(uuid) from public,anon,authenticated,service_role;

-- Read-only UI/Server Action gate: no caller-supplied tenant or flags.
-- Phase A / POS payment-link flags remain independent controls for legacy paths.
create function public.get_ticket_unico_enabled()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select auth.uid() is not null and exists(select 1 from public.organization_memberships m
  where m.organization_id=public.app_current_organization_id() and m.profile_id=auth.uid()
   and m.is_active and m.role in ('owner','manager','staff'))
  and public.ticket_unico_pilot(public.app_current_organization_id());
$$;
revoke all on function public.get_ticket_unico_enabled() from public,anon,authenticated,service_role;
grant execute on function public.get_ticket_unico_enabled() to authenticated;

create function public.protect_order_fiscal_route()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare kind public.customer_type;
begin
 if tg_op='INSERT' then
  select c.customer_type into kind from public.customers c where c.organization_id=new.organization_id and c.id=new.customer_id;
  new.service_completion_evidence:=null;
  new.fiscal_route:=case
   when not public.ticket_unico_pilot(new.organization_id) then 'review_required'
   when kind='business' or current_setting('app.order_ordinary_request',true)='on' then 'manual_billing'
   when kind='individual' and new.organization_id='e09f1e0b-1c4d-4450-9a30-79999bee545a'::uuid
    and exists(select 1 from public.organization_billing_settings s where s.organization_id=new.organization_id
     and s.simplified_invoicing_enabled and s.fiscal_territory_code='ES-CN'
     and s.declared_tax_regime_code='IGIC-GENERAL' and s.issuer_country_code='ES' and s.default_tax_rate=7)
    then 'automatic_simplified'
   else 'review_required' end;
  return new;
 end if;
 if new.fiscal_route is distinct from old.fiscal_route then
  if current_setting('app.order_route_mutation',true) is distinct from new.id::text
   or new.organization_id is distinct from public.app_current_organization_id()
   or new.fiscal_route<>'manual_billing' or exists(select 1 from public.invoice_orders l
    join public.invoices i on i.organization_id=l.organization_id and i.id=l.invoice_id
    where l.organization_id=new.organization_id and l.order_id=new.id and i.document_status<>'draft') then
   raise exception 'order_fiscal_route_locked' using errcode='55000';
  end if;
 end if;
 if new.service_completion_evidence is distinct from old.service_completion_evidence
  and (old.service_completion_evidence is not null
   or current_setting('app.order_completion_evidence',true) is distinct from new.id::text
   or new.organization_id is distinct from public.app_current_organization_id()) then
  raise exception 'order_completion_evidence_immutable' using errcode='55000';
 end if;
 return new;
end;
$$;
revoke all on function public.protect_order_fiscal_route() from public,anon,authenticated,service_role;
create trigger orders_fiscal_route_guard before insert or update on public.orders
 for each row execute function public.protect_order_fiscal_route();

create function public.request_order_ordinary_invoice(target_order_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare org uuid:=public.app_current_organization_id();
begin
 if not public.ticket_unico_pilot(org) then return; end if;
 if not public.has_organization_role(org,array['owner','manager']::public.app_role[]) then
  perform public.require_shop_terminal_access(org);
 end if;
 perform 1 from public.orders where organization_id=org and id=target_order_id for update;
 if not found then raise exception 'order_not_found' using errcode='42501'; end if;
 perform set_config('app.order_route_mutation',target_order_id::text,true);
 update public.orders set fiscal_route='manual_billing' where organization_id=org and id=target_order_id;
 perform set_config('app.order_route_mutation','',true);
end;
$$;
revoke all on function public.request_order_ordinary_invoice(uuid) from public,anon,authenticated,service_role;
grant execute on function public.request_order_ordinary_invoice(uuid) to authenticated;

create function public.create_order_with_fiscal_route(
 target_customer_id uuid,target_property_id uuid,target_location_id uuid,target_priority public.order_priority,
 target_due_at timestamptz,target_customer_notes text,target_internal_notes text,
 target_ordinary_invoice_requested boolean default false)
returns table(id uuid,order_number text) language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform set_config('app.order_ordinary_request',case when public.ticket_unico_pilot(public.app_current_organization_id()) and target_ordinary_invoice_requested then 'on' else '' end,true);
 return query select * from public.create_order(target_customer_id,target_property_id,target_location_id,
  target_priority,target_due_at,target_customer_notes,target_internal_notes);
 perform set_config('app.order_ordinary_request','',true);
end;
$$;
revoke all on function public.create_order_with_fiscal_route(uuid,uuid,uuid,public.order_priority,timestamptz,text,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.create_order_with_fiscal_route(uuid,uuid,uuid,public.order_priority,timestamptz,text,text,boolean) to authenticated;

-- Canonical submission unchanged except its ordinary-request fingerprint component.
create or replace function public.submit_shop_terminal_order(
  target_idempotency_key uuid,
  target_customer_id uuid,
  target_location_id uuid,
  target_due_at timestamptz,
  target_customer_notes text,
  target_internal_notes text,
  target_items jsonb,
  target_discount_amount numeric,
  target_pos_session_id uuid,
  target_payments jsonb,
  target_walk_in_name text,
  target_walk_in_phone text,
  target_production_assignee_id uuid,
  target_delivery_requested boolean,
  target_delivery_scheduled_at timestamptz,
  target_delivery_assigned_to uuid,
  target_delivery_address_line1 text,
  target_delivery_address_line2 text,
  target_delivery_city text,
  target_delivery_postal_code text,
  target_delivery_country_code text,
  target_delivery_contact_name text,
  target_delivery_contact_phone text,
  target_delivery_notes text
)
returns table (
  order_id uuid,
  order_number text,
  subtotal numeric,
  discount_amount numeric,
  total numeric,
  paid numeric,
  outstanding numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid := public.app_current_organization_id();
  fingerprint text;
  existing_submission public.shop_terminal_submissions%rowtype;
  created_order record;
  target_order public.orders%rowtype;
  item jsonb;
  payment jsonb;
  payment_total numeric(12,2) := 0;
  paid_total numeric(12,2) := 0;
  member_role public.app_role;
  selected_customer_code text;
  active_location_count bigint := 0;
  production_assignee uuid;
  normalized_walk_in_name text := nullif(btrim(target_walk_in_name), '');
  normalized_walk_in_phone text := nullif(btrim(target_walk_in_phone), '');
begin
  perform public.require_shop_terminal_access(org_id);

  if target_idempotency_key is null
    or target_due_at is null
    or target_delivery_requested is null
    or jsonb_typeof(target_items) <> 'array'
    or jsonb_array_length(target_items) < 1
    or jsonb_array_length(target_items) > 100
    or jsonb_typeof(coalesce(target_payments, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(target_payments, '[]'::jsonb)) > 2
    or target_discount_amount is null
    or target_discount_amount < 0
    or char_length(coalesce(normalized_walk_in_name, '')) > 160
    or char_length(coalesce(normalized_walk_in_phone, '')) > 40
    or (target_delivery_requested and (
      target_delivery_scheduled_at is null
      or nullif(btrim(target_delivery_address_line1), '') is null
    )) then
    raise exception 'shop_terminal_submission_invalid' using errcode = '22023';
  end if;

  select customer.customer_code into selected_customer_code
  from public.customers customer
  where customer.organization_id = org_id
    and customer.id = target_customer_id
    and customer.is_active;

  if not found or (
    selected_customer_code is distinct from 'WALKIN-SHARED'
    and (normalized_walk_in_name is not null or normalized_walk_in_phone is not null)
  ) then
    raise exception 'shop_terminal_customer_invalid' using errcode = '22023';
  end if;

  select count(*) into active_location_count
  from public.locations location
  where location.organization_id = org_id
    and location.is_active
    and location.deleted_at is null;

  production_assignee := target_production_assignee_id;

  fingerprint := md5((jsonb_build_object(
    'customerId', target_customer_id,
    'locationId', target_location_id,
    'dueAt', target_due_at,
    'customerNotes', nullif(btrim(target_customer_notes), ''),
    'internalNotes', nullif(btrim(target_internal_notes), ''),
    'items', target_items,
    'discountAmount', round(target_discount_amount, 2),
    'sessionId', target_pos_session_id,
    'payments', coalesce(target_payments, '[]'::jsonb),
    'walkInName', normalized_walk_in_name,
    'walkInPhone', normalized_walk_in_phone,
    'productionAssigneeId', target_production_assignee_id,
    'deliveryRequested', target_delivery_requested,
    'deliveryScheduledAt', target_delivery_scheduled_at,
    'deliveryAssignedTo', target_delivery_assigned_to,
    'deliveryAddressLine1', nullif(btrim(target_delivery_address_line1), ''),
    'deliveryAddressLine2', nullif(btrim(target_delivery_address_line2), ''),
    'deliveryCity', nullif(btrim(target_delivery_city), ''),
    'deliveryPostalCode', nullif(btrim(target_delivery_postal_code), ''),
    'deliveryCountryCode', nullif(upper(btrim(target_delivery_country_code)), ''),
    'deliveryContactName', nullif(btrim(target_delivery_contact_name), ''),
    'deliveryContactPhone', nullif(btrim(target_delivery_contact_phone), ''),
    'deliveryNotes', nullif(btrim(target_delivery_notes), '')
  ) || case when current_setting('app.order_ordinary_request',true)='on'
    then jsonb_build_object('ordinaryInvoiceRequested',true) else '{}'::jsonb end)::text);

  perform pg_advisory_xact_lock(hashtextextended(org_id::text || ':' || target_idempotency_key::text, 0));
  select * into existing_submission
  from public.shop_terminal_submissions submission
  where submission.organization_id = org_id and submission.idempotency_key = target_idempotency_key;

  if existing_submission.idempotency_key is not null then
    if existing_submission.request_fingerprint <> fingerprint or existing_submission.order_id is null then
      raise exception 'shop_terminal_idempotency_conflict' using errcode = '23505';
    end if;

    select * into target_order from public.orders orders
    where orders.id = existing_submission.order_id and orders.organization_id = org_id;
    select round(coalesce(sum(p.amount) filter (where p.status = 'confirmed'), 0)
      - coalesce(sum(p.amount) filter (where p.status = 'refunded'), 0), 2)
    into paid_total from public.payments p
    where p.organization_id = org_id and p.order_id = target_order.id;

    return query select target_order.id, target_order.order_number, target_order.subtotal,
      target_order.discount_amount, target_order.total, paid_total,
      round(greatest(target_order.total - paid_total, 0), 2);
    return;
  end if;

  if target_production_assignee_id is not null and (
    active_location_count <> 1 or not exists (
      select 1
      from public.organization_memberships membership
      where membership.organization_id = org_id
        and membership.profile_id = target_production_assignee_id
        and membership.is_active
        and membership.role = 'staff'
        and 'production' = any(membership.operational_capabilities::text[])
    )
  ) then
    raise exception 'shop_terminal_production_assignee_invalid' using errcode = '22023';
  end if;

  if target_delivery_requested and target_delivery_assigned_to is not null and not exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = org_id
      and membership.profile_id = target_delivery_assigned_to
      and membership.is_active
      and membership.role = 'staff'
      and 'delivery' = any(membership.operational_capabilities::text[])
  ) then
    raise exception 'shop_terminal_delivery_assignee_invalid' using errcode = '22023';
  end if;

  insert into public.shop_terminal_submissions (
    organization_id, idempotency_key, request_fingerprint, created_by
  ) values (org_id, target_idempotency_key, fingerprint, auth.uid());

  select membership.role into member_role
  from public.organization_memberships membership
  where membership.organization_id = org_id and membership.profile_id = auth.uid() and membership.is_active;

  if member_role = 'staff' and round(target_discount_amount, 2) > 0 then
    raise exception 'shop_terminal_staff_discount_denied' using errcode = '42501';
  end if;

  select created.id, created.order_number into created_order
  from public.create_order(
    target_customer_id, null, target_location_id, 'normal', target_due_at,
    target_customer_notes, target_internal_notes
  ) created;

  update public.orders orders
  set walk_in_name = normalized_walk_in_name,
      walk_in_phone = normalized_walk_in_phone,
      assigned_to = production_assignee,
      updated_by = auth.uid()
  where orders.organization_id = org_id and orders.id = created_order.id;

  for item in select value from jsonb_array_elements(target_items)
  loop
    if jsonb_typeof(item) <> 'object'
      or nullif(item->>'serviceId', '') is null
      or nullif(item->>'quantity', '') is null
      or (item->>'quantity')::numeric <= 0 then
      raise exception 'shop_terminal_item_invalid' using errcode = '22023';
    end if;

    if not public.shop_terminal_service_is_eligible(
      org_id,
      target_customer_id,
      (item->>'serviceId')::uuid,
      target_location_id
    ) then
      raise exception 'shop_terminal_service_not_eligible' using errcode = '42501';
    end if;

    perform public.save_order_item(
      null,
      created_order.id,
      (item->>'serviceId')::uuid,
      null,
      'piece'::public.service_unit_type,
      (item->>'quantity')::numeric,
      0,
      nullif(btrim(item->>'notes'), '')
    );
  end loop;

  if round(target_discount_amount, 2) > 0 then
    perform public.update_order_discount(created_order.id, round(target_discount_amount, 2));
  end if;

  if target_delivery_requested then
    perform public.create_or_update_delivery(
      created_order.id,
      null,
      target_delivery_scheduled_at,
      target_delivery_assigned_to,
      target_delivery_address_line1,
      target_delivery_address_line2,
      target_delivery_city,
      target_delivery_postal_code,
      target_delivery_country_code,
      target_delivery_contact_name,
      target_delivery_contact_phone,
      target_delivery_notes,
      0
    );
  end if;

  select * into target_order from public.orders orders
  where orders.id = created_order.id and orders.organization_id = org_id for update;

  -- Only this invocation's newly created draft represents physical counter
  -- intake. Existing submissions returned above must retain their original state.
  if target_order.id is null
    or not target_order.is_active
    or target_order.production_status <> 'draft'
    or target_order.created_by is distinct from auth.uid()
    or target_order.created_at is distinct from transaction_timestamp()
    or target_order.received_at is not null then
    raise exception 'shop_terminal_receipt_invalid_order' using errcode = '22023';
  end if;

  perform public.assert_order_has_active_items(org_id, created_order.id);

  -- Preserve the canonical inbound pickup gate, including for internal intake.
  if exists (
    select 1 from public.pickups pickup
    where pickup.organization_id = org_id
      and pickup.order_id = created_order.id
      and pickup.status in ('scheduled', 'in_progress')
  ) then
    raise exception 'inbound_pickup_incomplete';
  end if;

  -- Dedicated intake, as in Quick Drop: POS authorization was checked above.
  -- This does not grant the caller production/assignment transition privileges.
  -- The existing UPDATE trigger creates inbound custody or aborts this transaction.
  perform set_config('app.workflow_transition', 'on', true);
  update public.orders orders
  set production_status = 'received',
      received_at = now(),
      updated_by = auth.uid()
  where orders.organization_id = org_id
    and orders.id = created_order.id
    and orders.production_status = 'draft'
  returning orders.* into target_order;

  if target_order.id is null then
    raise exception 'shop_terminal_receipt_invalid_order' using errcode = '22023';
  end if;

  insert into public.order_status_history (
    organization_id, order_id, from_status, to_status, reason, changed_by, metadata
  ) values (
    org_id, created_order.id, 'draft', 'received', null, auth.uid(),
    jsonb_build_object('source', 'shop_terminal')
  );

  for payment in select value from jsonb_array_elements(coalesce(target_payments, '[]'::jsonb))
  loop
    if jsonb_typeof(payment) <> 'object'
      or coalesce(payment->>'amount', '') !~ '^[0-9]+([.][0-9]+)?$'
      or round((payment->>'amount')::numeric, 2) <= 0
      or coalesce(payment->>'method', '') not in ('cash', 'card')
      or nullif(payment->>'idempotencyKey', '') is null then
      raise exception 'shop_terminal_payment_invalid' using errcode = '22023';
    end if;
    payment_total := payment_total + round((payment->>'amount')::numeric, 2);
  end loop;

  if jsonb_array_length(coalesce(target_payments, '[]'::jsonb)) > 0 then
    -- Each requested payment must have its own identity. A repeated key must
    -- not silently turn two requested installments into one ledger entry.
    if (select count(distinct (value->>'idempotencyKey')::uuid)
        from jsonb_array_elements(target_payments)) <> jsonb_array_length(target_payments) then
      raise exception 'shop_terminal_payment_invalid' using errcode = '22023';
    end if;
    if target_pos_session_id is null or payment_total <= 0 or payment_total > target_order.total then
      raise exception 'shop_terminal_payment_total_mismatch' using errcode = '22023';
    end if;

    for payment in select value from jsonb_array_elements(target_payments)
    loop
      perform public.record_pos_payment(
        created_order.id,
        (payment->>'amount')::numeric,
        (payment->>'method')::public.payment_method,
        target_pos_session_id,
        nullif(btrim(payment->>'reference'), ''),
        'Shop terminal payment',
        (payment->>'idempotencyKey')::uuid,
        case when payment->>'method' = 'card' then 'manual' else null end,
        case when payment->>'method' = 'card' then nullif(btrim(payment->>'reference'), '') else null end,
        case when payment->>'method' = 'card' then 'recorded_manual' else null end
      );
    end loop;
  end if;

  select round(coalesce(sum(p.amount) filter (where p.status = 'confirmed'), 0)
    - coalesce(sum(p.amount) filter (where p.status = 'refunded'), 0), 2)
  into paid_total from public.payments p
  where p.organization_id = org_id and p.order_id = created_order.id;

  update public.shop_terminal_submissions submission
  set order_id = created_order.id
  where submission.organization_id = org_id and submission.idempotency_key = target_idempotency_key;

  return query select target_order.id, target_order.order_number, target_order.subtotal,
    target_order.discount_amount, target_order.total, paid_total,
    round(greatest(target_order.total - paid_total, 0), 2);
end;
$$;
create function public.submit_shop_terminal_order_with_fiscal_route(
target_idempotency_key uuid,
  target_customer_id uuid,
  target_location_id uuid,
  target_due_at timestamptz,
  target_customer_notes text,
  target_internal_notes text,
  target_items jsonb,
  target_discount_amount numeric,
  target_pos_session_id uuid,
  target_payments jsonb,
  target_walk_in_name text,
  target_walk_in_phone text,
  target_production_assignee_id uuid,
  target_delivery_requested boolean,
  target_delivery_scheduled_at timestamptz,
  target_delivery_assigned_to uuid,
  target_delivery_address_line1 text,
  target_delivery_address_line2 text,
  target_delivery_city text,
  target_delivery_postal_code text,
  target_delivery_country_code text,
  target_delivery_contact_name text,
  target_delivery_contact_phone text,
  target_delivery_notes text,
 target_ordinary_invoice_requested boolean default false)
returns table (
  order_id uuid,
  order_number text,
  subtotal numeric,
  discount_amount numeric,
  total numeric,
  paid numeric,
  outstanding numeric
)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform set_config('app.order_ordinary_request',case when public.ticket_unico_pilot(public.app_current_organization_id()) and target_ordinary_invoice_requested then 'on' else '' end,true);
 return query select * from public.submit_shop_terminal_order(target_idempotency_key,target_customer_id,target_location_id,target_due_at,target_customer_notes,target_internal_notes,target_items,target_discount_amount,target_pos_session_id,target_payments,target_walk_in_name,target_walk_in_phone,target_production_assignee_id,target_delivery_requested,target_delivery_scheduled_at,target_delivery_assigned_to,target_delivery_address_line1,target_delivery_address_line2,target_delivery_city,target_delivery_postal_code,target_delivery_country_code,target_delivery_contact_name,target_delivery_contact_phone,target_delivery_notes);
 perform set_config('app.order_ordinary_request','',true);
end;
$$;
revoke all on function public.submit_shop_terminal_order_with_fiscal_route(uuid,uuid,uuid,timestamptz,text,text,jsonb,numeric,uuid,jsonb,text,text,uuid,boolean,timestamptz,uuid,text,text,text,text,text,text,text,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.submit_shop_terminal_order_with_fiscal_route(uuid,uuid,uuid,timestamptz,text,text,jsonb,numeric,uuid,jsonb,text,text,uuid,boolean,timestamptz,uuid,text,text,text,text,text,text,text,text,boolean) to authenticated;

create function public.create_billing_draft_with_order_route(target_order_ids uuid[],target_series text,target_tax_rate numeric,target_notes text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; result uuid;
begin
 if not public.ticket_unico_pilot(public.app_current_organization_id()) then
  return public.create_billing_draft(target_order_ids,target_series,target_tax_rate,target_notes);
 end if;
 if not public.has_organization_role(public.app_current_organization_id(),array['owner','manager']::public.app_role[]) then
  raise exception 'billing_not_authorized' using errcode='42501'; end if;
 for v_id in select id from public.orders where organization_id=public.app_current_organization_id()
  and id=any(target_order_ids) order by id for update loop
  perform public.request_order_ordinary_invoice(v_id);
 end loop;
 select public.create_billing_draft(target_order_ids,target_series,target_tax_rate,target_notes) into result;
 return result;
end;
$$;
revoke all on function public.create_billing_draft_with_order_route(uuid[],text,numeric,text) from public,anon,authenticated,service_role;
grant execute on function public.create_billing_draft_with_order_route(uuid[],text,numeric,text) to authenticated;

-- Internal scope exists only while the checked completion coordinator executes.
create function public.ticket_unico_context_allowed(target_org uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(auth.uid() is not null and target_org=public.app_current_organization_id()
  and public.ticket_unico_pilot(target_org)
  and current_setting('app.ticket_unico_org',true)=target_org::text
  and public.organization_entitlement_is_enabled(target_org,'billing.invoicing',now())
  and exists(select 1 from public.orders o where o.organization_id=target_org
   and o.id::text=current_setting('app.pos_billing_order',true) and o.fiscal_route='automatic_simplified'
   and o.production_status='completed' and o.service_completion_evidence->>'contemporaneous'='true'
   and (public.has_organization_role(target_org,array['owner','manager']::public.app_role[])
    or exists(select 1 from public.organization_memberships m where m.organization_id=target_org
     and m.profile_id=auth.uid() and m.is_active and m.role='staff' and o.assigned_to=auth.uid()
     and ('quality'::public.operational_capability=any(m.operational_capabilities)
       or 'production'::public.operational_capability=any(m.operational_capabilities))))),false);
$$;
revoke all on function public.ticket_unico_context_allowed(uuid) from public,anon,authenticated,service_role;
create or replace function public.pos_billing_context_allowed(target_org uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.ticket_unico_context_allowed(target_org) or coalesce(
  auth.uid() is not null and target_org=public.app_current_organization_id()
  and target_org='e09f1e0b-1c4d-4450-9a30-79999bee545a'::uuid
  and current_setting('app.ticket_unico_collection',true)='on'
  and public.has_pos_capability(target_org)
  and public.organization_entitlement_is_enabled(target_org,'billing.invoicing',now())
  and public.organization_entitlement_is_enabled(target_org,'shop_terminal',now())
  and exists(select 1 from public.invoice_orders l join public.invoices i
   on i.organization_id=l.organization_id and i.id=l.invoice_id
   where l.organization_id=target_org and l.order_id::text=current_setting('app.pos_billing_order',true)
    and i.document_status='issued' and i.pos_billing_order_snapshot->>'source'='ticket_unico_completion'),false)
 or coalesce(auth.uid() is not null and target_org=public.app_current_organization_id()
 and current_setting('app.pos_billing_org',true)=target_org::text
 and public.has_pos_capability(target_org)
 and public.organization_entitlement_is_enabled(target_org,'pos',now())
 and public.organization_entitlement_is_enabled(target_org,'shop_terminal',now())
 and public.organization_entitlement_is_enabled(target_org,'billing.invoicing',now())
 and exists(select 1 from public.organization_billing_settings s where s.organization_id=target_org and s.pos_billing_payment_link_enabled)
 and exists(select 1 from public.orders o where o.organization_id=target_org
  and o.id::text=current_setting('app.pos_billing_order',true)),false);
$$;

-- Service issuer, not an advance/final-payment writer. No synthetic payment.
create function public.issue_completed_order_service_internal(target_order_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare org uuid:=public.app_current_organization_id(); actor uuid:=auth.uid();
 o public.orders%rowtype; s public.organization_billing_settings%rowtype; c public.customers%rowtype;
 i public.invoices%rowtype; doc_id uuid; seq bigint; number text; today date; zone text; items jsonb; p record;
begin
 if current_setting('transaction_isolation')<>'read committed' then
  raise exception 'ticket_unico_read_committed_required' using errcode='25000'; end if;
 -- Coordinator owns payment -> order locks before reaching this private writer.
 select * into o from public.orders where organization_id=org and id=target_order_id for update;
 if o.id is null then raise exception 'order_not_found' using errcode='42501'; end if;
 select i0.* into i from public.invoice_orders l join public.invoices i0
  on i0.organization_id=l.organization_id and i0.id=l.invoice_id where l.organization_id=org and l.order_id=o.id
  and i0.document_status='issued' and i0.pos_billing_order_snapshot->>'source'='ticket_unico_completion';
 if i.id is not null then return jsonb_build_object('status','issued','invoiceId',i.id,'number',i.invoice_number); end if;
 if not public.ticket_unico_pilot(org) then return jsonb_build_object('status','disabled'); end if;
 if o.fiscal_route='manual_billing' then return jsonb_build_object('status','manual_billing'); end if;
 if o.fiscal_route<>'automatic_simplified' or o.production_status<>'completed'
  or o.service_completion_evidence->>'contemporaneous' is distinct from 'true' then
  return jsonb_build_object('status','review_required','reason','completion_evidence'); end if;
 select timezone,(now() at time zone timezone)::date into zone,today from public.organizations where id=org;
 if (o.service_completion_evidence->>'serviceDate')::date is distinct from today
  or (clock_timestamp() at time zone zone)::date is distinct from today then
  return jsonb_build_object('status','review_required','reason','service_date'); end if;
 -- A payment made before performance and any other fiscal history require their own approved path.
 if exists(select 1 from public.invoice_orders l where l.organization_id=org and l.order_id=o.id)
  or exists(select 1 from public.billing_advance_event_declarations d where d.organization_id=org and d.order_id=o.id)
  or exists(select 1 from public.payments p0 where p0.organization_id=org and p0.order_id=o.id and p0.status<>'void') then
  return jsonb_build_object('status','review_required','reason','prior_history'); end if;
 if exists(select 1 from public.order_items it left join public.services svc
  on svc.organization_id=it.organization_id and svc.id=it.service_id
  where it.organization_id=org and it.order_id=o.id and it.is_active
   and (it.service_id is null or svc.id is null)) then
  return jsonb_build_object('status','review_required','reason','operation_scope'); end if;
 select * into s from public.organization_billing_settings where organization_id=org for share;
 select * into c from public.customers where organization_id=org and id=o.customer_id;
 if c.customer_type is distinct from 'individual' or not o.is_active or o.currency<>'EUR' or o.total<=0 or o.total>3000
  or s.simplified_invoicing_enabled is distinct from true or s.fiscal_territory_code is distinct from 'ES-CN'
  or s.declared_tax_regime_code is distinct from 'IGIC-GENERAL' or s.default_tax_rate is distinct from 7
  or s.issuer_country_code is distinct from 'ES' or s.simplified_series is null
  or nullif(btrim(s.issuer_legal_name),'') is null or nullif(btrim(s.issuer_tax_id),'') is null
  or nullif(btrim(s.issuer_address_line1),'') is null or nullif(btrim(s.issuer_city),'') is null
  or nullif(btrim(s.issuer_postal_code),'') is null then
  return jsonb_build_object('status','review_required','reason','profile'); end if;
 perform set_config('app.ticket_unico_org',org::text,true);
 perform set_config('app.pos_billing_org',org::text,true);
 perform set_config('app.pos_billing_order',o.id::text,true);
 perform set_config('app.pos_billing_invoice_ids','',true);
 if not public.ticket_unico_context_allowed(org) then raise exception 'ticket_unico_not_authorized' using errcode='42501'; end if;
 doc_id:=public.create_billing_draft_internal(array[o.id],s.simplified_series,s.default_tax_rate,o.customer_notes,'simplified',
  public.normalize_billing_recipient_snapshot(jsonb_build_object('recipient_snapshot_mode','anonymous','customer_id',null,'customer_name',null,
   'customer_tax_id',null,'customer_address_line1',null,'customer_address_line2',null,'customer_city',null,
   'customer_postal_code',null,'customer_country_code',null,'customer_email',null)));
 select * into i from public.invoices where organization_id=org and id=doc_id for update;
 select jsonb_agg(jsonb_build_object('id',it.id,'description',it.description,'quantity',it.quantity,'unitType',it.unit_type,
  'unitPrice',it.unit_price,'lineTotal',it.line_total) order by it.display_order,it.id) into items
  from public.invoice_items it where it.organization_id=org and it.invoice_id=doc_id;
 if i.total is distinct from o.total or i.taxable_base+i.tax_total<>i.total
  or exists(select 1 from public.invoice_items it where it.organization_id=org and it.invoice_id=doc_id
   and (it.tax_rate<>7 or not it.prices_include_tax or it.source_order_id is distinct from o.id)) then
  raise exception 'ticket_unico_totals_invalid' using errcode='22023'; end if;
 insert into public.billing_invoice_number_counters(organization_id,series,fiscal_document_type,next_value)
  values(org,i.series,'simplified',2) on conflict(organization_id,series) do update
  set next_value=public.billing_invoice_number_counters.next_value+1,updated_at=now() returning next_value-1 into seq;
 if (clock_timestamp() at time zone zone)::date is distinct from today then
  raise exception 'ticket_unico_service_date_review_required' using errcode='22023'; end if;
 number:=extract(year from today)::integer::text||'-'||i.series||'-'||lpad(seq::text,greatest(6,length(seq::text)),'0');
 perform set_config('app.billing_mutation','on',true);
 perform set_config('app.billing_simplified_service_issue','on',true);
 update public.invoices set document_status='issued',invoice_number=number,sequence_number=seq,
  issue_date=today,issued_at=now(),service_performed_on=today,service_operation_scope='local_laundry_dry_cleaning',
  fiscal_recipient_requirement='consumer',service_declared_by=actor,service_declared_at=now(),updated_by=actor,
  pos_billing_order_snapshot=jsonb_build_object('workflow','pos_billing_payment_link','source','ticket_unico_completion',
   'order_id',o.id,'order_number',o.order_number,'created_at',o.created_at,'due_at',o.due_at,
   'customer_name',coalesce(nullif(btrim(o.walk_in_name),''),c.display_name),'customer_notes',o.customer_notes,'currency',o.currency,
   'subtotal',i.subtotal,'discount',i.discount_total,'total',i.total,'items',items,'completion',o.service_completion_evidence)
  where organization_id=org and id=doc_id;
 perform set_config('app.ticket_unico_org','',true);
 perform set_config('app.pos_billing_org','',true);
 perform set_config('app.pos_billing_order','',true);
 perform set_config('app.pos_billing_invoice_ids','',true);
 perform set_config('app.billing_mutation','',true);
 perform set_config('app.billing_simplified_service_issue','',true);
 return jsonb_build_object('status','issued','invoiceId',doc_id,'number',number);
end;
$$;
revoke all on function public.issue_completed_order_service_internal(uuid) from public,anon,authenticated,service_role;

-- The normal production mutation is the only caller. Printing never calls it.
create function public.complete_order_with_billing(target_order_id uuid,target_status public.production_status,
 target_position_id uuid default null,target_package_count integer default null,
 target_storage_mode public.order_storage_mode default null,target_reason text default null,
 target_completed_now boolean default false)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare org uuid:=public.app_current_organization_id(); o public.orders%rowtype; h public.order_status_history%rowtype;
 p record; result jsonb;
begin
 -- Disabled/unentitled/non-pilot tenants retain exactly the original transition,
 -- authorization, lock order and errors. No fiscal evidence or invoice is added.
 if not public.ticket_unico_pilot(org) then
  if target_status='ready' then
   perform public.transition_order_ready_with_storage(target_order_id,target_position_id,target_package_count,target_storage_mode);
  elsif target_status='completed' then
   perform public.transition_order_status(target_order_id,target_status,target_reason);
  else raise exception 'invalid_completion_transition' using errcode='22023'; end if;
  return jsonb_build_object('status','disabled');
 end if;
 if auth.uid() is null or current_setting('transaction_isolation')<>'read committed' then
  raise exception 'ticket_unico_not_authorized' using errcode='42501'; end if;
 for p in select id from public.payments where organization_id=org and order_id=target_order_id order by id for share loop null; end loop;
 select * into o from public.orders where organization_id=org and id=target_order_id for update;
 if o.id is null then raise exception 'order_not_found' using errcode='42501'; end if;
 if not public.has_organization_role(org,array['owner','manager']::public.app_role[]) and not exists(
  select 1 from public.organization_memberships m where m.organization_id=org and m.profile_id=auth.uid()
   and m.is_active and m.role='staff' and o.assigned_to=auth.uid()
   and (case when o.production_status in ('quality_check','packing') then 'quality'::public.operational_capability
    else 'production'::public.operational_capability end)=any(m.operational_capabilities)
   or m.organization_id=org and m.profile_id=auth.uid() and m.is_active and m.role='staff' and o.assigned_to=auth.uid()
    and o.production_status='completed' and o.service_completion_evidence->>'actorId'=auth.uid()::text
    and ('quality'::public.operational_capability=any(m.operational_capabilities) or 'production'::public.operational_capability=any(m.operational_capabilities))) then
  raise exception 'ticket_unico_not_authorized' using errcode='42501'; end if;
 if target_status is null or target_status not in ('ready','completed') then raise exception 'invalid_completion_transition' using errcode='22023'; end if;
 if o.production_status<>'completed' then
  if target_status='ready' then
   perform public.transition_order_ready_with_storage(target_order_id,target_position_id,target_package_count,target_storage_mode);
  else perform public.transition_order_status(target_order_id,target_status,target_reason); end if;
  select * into o from public.orders where organization_id=org and id=target_order_id;
  select * into h from public.order_status_history where organization_id=org and order_id=o.id and to_status='completed' order by changed_at desc,id desc limit 1;
  if h.id is null or h.changed_at is distinct from o.completed_at or h.changed_by is distinct from auth.uid() then
   raise exception 'completion_evidence_invalid' using errcode='55000'; end if;
  -- A current-work declaration comes from the existing operational completion form.
  -- Legacy completions and retries cannot manufacture this evidence afterwards.
  if public.ticket_unico_pilot(org) then
  perform set_config('app.order_completion_evidence',o.id::text,true);
  update public.orders set service_completion_evidence=jsonb_build_object('version','ticket-unico-v1',
   'historyId',h.id,'actorId',auth.uid(),'recordedAt',now(),'contemporaneous',target_completed_now is true and target_status='ready',
   'serviceDate',case when target_completed_now is true and target_status='ready' then (now() at time zone
    (select timezone from public.organizations where id=org))::date else null end)
   where organization_id=org and id=o.id;
  perform set_config('app.order_completion_evidence','',true);
  end if;
 end if;
 begin
  result:=public.issue_completed_order_service_internal(o.id);
 exception when others then
  -- Fiscal work rolls back as a subtransaction; the real completion is retained.
  result:=jsonb_build_object('status','review_required','reason','issuance_failed','sqlstate',sqlstate);
 end;
 return result;
end;
$$;
revoke all on function public.complete_order_with_billing(uuid,public.production_status,uuid,integer,public.order_storage_mode,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.complete_order_with_billing(uuid,public.production_status,uuid,integer,public.order_storage_mode,text,boolean) to authenticated;

create or replace function public.get_pos_billing_payment_documents(target_order_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare org uuid:=public.app_current_organization_id(); result jsonb;
begin
 perform public.require_shop_terminal_access(org);
 if auth.uid() is null or not public.organization_entitlement_is_enabled(org,'billing.invoicing',now())
  or not public.organization_entitlement_is_enabled(org,'printing',now()) then
  raise exception 'pos_billing_not_authorized' using errcode='42501'; end if;
 if not exists(select 1 from public.orders where organization_id=org and id=target_order_id) then
  raise exception 'pos_billing_order_not_found' using errcode='22023'; end if;
 select jsonb_build_object('enabled',coalesce((select pos_billing_payment_link_enabled from public.organization_billing_settings where organization_id=org),false),
  'automatic',public.ticket_unico_pilot(org),
  'documents',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'number',i.invoice_number,'issuedAt',i.issued_at,
    'paymentId',(select p.payment_id from public.billing_invoice_payment_links p where p.organization_id=org and p.invoice_id=i.id and p.order_id=target_order_id order by p.payment_id limit 1),
    'paymentIds',(select coalesce(jsonb_agg(p.payment_id order by p.payment_id),'[]'::jsonb) from public.billing_invoice_payment_links p where p.organization_id=org and p.invoice_id=i.id and p.order_id=target_order_id),
    'role',l.billing_link_role,'event',i.billing_event_kind,'total',i.total,'base',i.taxable_base,'tax',i.tax_total,
    'series',i.series,'issueDate',i.issue_date,'type',i.fiscal_document_type,
    'taxRates',(select jsonb_agg(distinct it.tax_rate) from public.invoice_items it where it.organization_id=org and it.invoice_id=i.id),
    'roundingDelta',i.operation_rounding_base_delta,'snapshot',i.pos_billing_order_snapshot,
    'issuer',jsonb_build_object('name',i.issuer_legal_name,'taxId',i.issuer_tax_id,'address',concat_ws(' · ',i.issuer_address_line1,i.issuer_address_line2,i.issuer_city,i.issuer_postal_code,i.issuer_country_code)))
     order by i.issued_at,i.id) from public.invoice_orders l join public.invoices i on i.organization_id=l.organization_id and i.id=l.invoice_id
    where l.organization_id=org and l.order_id=target_order_id and i.document_status='issued' and i.fiscal_document_type='simplified'),'[]'::jsonb)) into result;
 return result;
end;
$$;
-- Link only NEW confirmed POS collections to an already issued service document.
-- No fiscal document is created here; legacy payments are not backfilled.
create function public.link_ticket_unico_collection()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare doc uuid; previous_org text; previous_order text; previous_scope text; previous_link text;
begin
 if new.organization_id is distinct from public.app_current_organization_id()
  or new.organization_id<>'e09f1e0b-1c4d-4450-9a30-79999bee545a'::uuid
  or new.status<>'confirmed' or new.channel<>'pos' or new.pos_session_id is null
  or not public.has_pos_capability(new.organization_id) then return new; end if;
 select i.id into doc from public.invoice_orders l join public.invoices i
  on i.organization_id=l.organization_id and i.id=l.invoice_id
  where l.organization_id=new.organization_id and l.order_id=new.order_id and l.is_active
   and l.billing_link_role='final' and i.document_status='issued' and i.issued_at<=new.paid_at
   and i.pos_billing_order_snapshot->>'source'='ticket_unico_completion';
 if doc is null then return new; end if;
 previous_org:=current_setting('app.pos_billing_org',true);
 previous_order:=current_setting('app.pos_billing_order',true);
 previous_scope:=current_setting('app.ticket_unico_collection',true);
 previous_link:=current_setting('app.billing_advance_link_mutation',true);
 begin
  perform set_config('app.pos_billing_org',new.organization_id::text,true);
  perform set_config('app.pos_billing_order',new.order_id::text,true);
  perform set_config('app.ticket_unico_collection','on',true);
  perform set_config('app.billing_advance_link_mutation','on',true);
  insert into public.billing_invoice_payment_links(organization_id,order_id,invoice_id,billing_link_role,payment_id,attributed_amount)
   values(new.organization_id,new.order_id,doc,'final',new.id,new.amount);
 exception when check_violation or unique_violation or insufficient_privilege or sqlstate '55000' or sqlstate '22023' then
  -- A rejected attribution must not erase a confirmed collection. Existing
  -- coverage read classifies the issued document without a link as review_required.
  null;
 end;
 perform set_config('app.pos_billing_org',coalesce(previous_org,''),true);
 perform set_config('app.pos_billing_order',coalesce(previous_order,''),true);
 perform set_config('app.ticket_unico_collection',coalesce(previous_scope,''),true);
 perform set_config('app.billing_advance_link_mutation',coalesce(previous_link,''),true);
 return new;
end;
$$;
revoke all on function public.link_ticket_unico_collection() from public,anon,authenticated,service_role;
create trigger payments_ticket_unico_collection after insert on public.payments
 for each row execute function public.link_ticket_unico_collection();

commit;
