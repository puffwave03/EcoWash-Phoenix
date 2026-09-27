-- INBOUND-CUSTODY-SYNC-001: only a new canonical draft -> received transition establishes custody.
-- These triggers run within the originating RPC transaction, including Quick Drop.
drop trigger shop_terminal_submission_inbound_storage on public.shop_terminal_submissions;
drop function public.stage_counter_submission_order();
drop trigger pickup_completion_inbound_storage on public.pickups;
drop function public.stage_completed_inbound_pickup();

create function public.stage_received_order_inbound_storage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.received_at is null then
    raise exception 'order_received_at_required' using errcode = '22023';
  end if;

  perform public.ensure_warehouse_inbound_storage(
    new.organization_id, new.id, new.received_at
  );
  return new;
end;
$$;

create trigger order_received_inbound_storage
  after update of production_status on public.orders
  for each row
  when (old.production_status = 'draft' and new.production_status = 'received')
  execute function public.stage_received_order_inbound_storage();

revoke all on function public.stage_received_order_inbound_storage() from public, anon, authenticated;

-- Preserve existing pickup authorization, assignment, transition and cancellation rules.
-- Draft is valid only for pre-production pickup execution. Completion records
-- receipt and storage in this same transaction.
create or replace function public.transition_pickup_status(
  target_pickup_id uuid,
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
  receipt_at timestamptz;
  allowed boolean := false;
begin
  org_id := public.app_current_organization_id();

  select membership.role into actor_role
  from public.organization_memberships membership
  where membership.organization_id = org_id
    and membership.profile_id = auth.uid()
    and membership.is_active;

  select pickup.status,
         pickup.assigned_to,
         pickup.order_id,
         orders.is_active,
         orders.production_status
  into current_status,
       current_assigned_to,
       parent_order_id,
       parent_is_active,
       parent_production_status
  from public.pickups pickup
  join public.orders orders
    on orders.organization_id = pickup.organization_id
   and orders.id = pickup.order_id
  where pickup.id = target_pickup_id
    and pickup.organization_id = org_id
  for update of pickup, orders;

  if current_status is null
    or not public.has_operational_capability(org_id, 'pickup')
    or (actor_role = 'staff' and current_assigned_to is distinct from auth.uid()) then
    raise exception 'not authorized';
  end if;

  if target_status in ('in_progress', 'completed')
    and (not parent_is_active or parent_production_status not in ('draft', 'received')) then
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

  if target_status = 'completed' then
    receipt_at := now();
    if parent_production_status = 'draft' then
      perform set_config('app.workflow_transition', 'on', true);
      update public.orders
      set production_status = 'received',
          received_at = receipt_at,
          updated_by = auth.uid()
      where id = parent_order_id
        and organization_id = org_id
        and production_status = 'draft';

      insert into public.order_status_history (
        organization_id, order_id, from_status, to_status, reason, changed_by, metadata
      ) values (
        org_id, parent_order_id, 'draft', 'received', null, auth.uid(),
        jsonb_build_object('source', 'inbound_pickup_completion')
      );
    end if;

    -- Preserve a manual placement. Repair an already-received parent only if absent.
    perform public.ensure_warehouse_inbound_storage(org_id, parent_order_id, receipt_at);
  end if;

  perform set_config('app.app_007_mutation', 'on', true);

  update public.pickups
  set status = target_status,
      started_at = case when target_status = 'in_progress' and started_at is null then now() else started_at end,
      completed_at = case when target_status = 'completed' then receipt_at else completed_at end,
      cancellation_reason = case when target_status = 'cancelled' then nullif(btrim(target_reason), '') else cancellation_reason end,
      updated_by = auth.uid()
  where id = target_pickup_id and organization_id = org_id;
end;
$$;
