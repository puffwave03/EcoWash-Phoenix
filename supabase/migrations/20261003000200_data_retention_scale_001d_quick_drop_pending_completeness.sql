-- Return the complete actionable Quick Drop queue as one JSON value so an API row cap cannot hide pending work.
create function public.list_pending_quick_drops()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid := public.app_current_organization_id();
  pending jsonb;
begin
  perform public.require_shop_terminal_access(org_id);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', orders.id,
        'order_number', orders.order_number,
        'received_at', orders.received_at,
        'walk_in_name', orders.walk_in_name,
        'customer_code', customer.customer_code,
        'display_name', customer.display_name
      ) order by orders.received_at desc, orders.id desc
    ),
    '[]'::jsonb
  ) into pending
  from public.orders orders
  join public.customers customer
    on customer.organization_id = orders.organization_id
   and customer.id = orders.customer_id
  where orders.organization_id = org_id
    and orders.is_active
    and orders.production_status = 'received'
    and orders.received_at is not null
    and exists (
      select 1
      from public.order_status_history history
      where history.organization_id = orders.organization_id
        and history.order_id = orders.id
        and history.metadata @> '{"source":"quick_drop"}'::jsonb
    )
    and not exists (
      select 1
      from public.order_items item
      where item.organization_id = orders.organization_id
        and item.order_id = orders.id
        and item.is_active
    );

  return pending;
end;
$$;

revoke all on function public.list_pending_quick_drops() from public, anon, authenticated;
grant execute on function public.list_pending_quick_drops() to authenticated;
