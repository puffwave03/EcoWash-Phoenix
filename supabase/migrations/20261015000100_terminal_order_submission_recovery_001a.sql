-- TERMINAL-ORDER-SUBMISSION-RECOVERY-001A: read-only status lookup for a
-- previously submitted Shop Terminal idempotency key. A not_found result is
-- only a point-in-time observation; an earlier request may still be in flight.
create function public.get_shop_terminal_submission_status(
  target_idempotency_key uuid
)
returns table (
  submission_status text,
  order_id uuid,
  order_number text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_org_id uuid := public.app_current_organization_id();
begin
  perform public.require_shop_terminal_access(current_org_id);

  if target_idempotency_key is null then
    raise exception 'shop_terminal_submission_key_required'
      using errcode = '22023';
  end if;

  return query
  select
    case
      when submission.order_id is null then 'pending'::text
      else 'completed'::text
    end,
    submission.order_id,
    orders.order_number
  from public.shop_terminal_submissions as submission
  left join public.orders as orders
    on orders.organization_id = submission.organization_id
   and orders.id = submission.order_id
  where submission.organization_id = current_org_id
    and submission.idempotency_key = target_idempotency_key;

  if not found then
    return query
    select 'not_found'::text, null::uuid, null::text;
  end if;
end;
$$;

revoke all on function public.get_shop_terminal_submission_status(uuid)
  from public, anon, authenticated;
grant execute on function public.get_shop_terminal_submission_status(uuid)
  to authenticated;
