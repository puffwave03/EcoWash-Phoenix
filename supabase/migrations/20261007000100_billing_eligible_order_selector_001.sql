create function public.list_eligible_billing_orders(
  target_query text, target_customer_id uuid, target_order_id uuid, target_limit integer
)
returns table (
  id uuid, order_number text, customer_id uuid, created_at timestamptz,
  currency text, total numeric, customer_code text, customer_name text,
  customer_active boolean
)
language plpgsql stable security definer set search_path = public
as $$
declare
  org_id uuid;
  normalized_query text := lower(btrim(coalesce(target_query, '')));
begin
  org_id := public.app_current_organization_id();
  if org_id is null
    or not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[])
    or not public.organization_entitlement_is_enabled(org_id, 'billing.invoicing', now()) then
    raise exception 'billing_not_authorized' using errcode = '42501';
  end if;
  if length(normalized_query) > 100 or target_limit is null or target_limit not between 1 and 101 then
    raise exception 'billing_invalid_discovery' using errcode = '22023';
  end if;

  return query
  select o.id, o.order_number, o.customer_id, o.created_at, o.currency, o.total,
    c.customer_code, c.display_name, c.is_active
  from public.orders o
  join public.customers c on c.organization_id = org_id and c.id = o.customer_id
  where o.organization_id = org_id
    and o.is_active
    and o.production_status <> 'cancelled'
    and c.customer_code is distinct from 'WALKIN-SHARED'
    and not exists (
      select 1 from public.invoice_orders io
      where io.organization_id = org_id and io.order_id = o.id and io.is_active
    )
    and (target_customer_id is null or o.customer_id = target_customer_id)
    and (target_order_id is null or o.id = target_order_id)
    -- strpos treats %, _, and other SQL pattern characters literally.
    and (normalized_query = ''
      or strpos(lower(o.order_number), normalized_query) > 0
      or strpos(lower(c.display_name), normalized_query) > 0
      or strpos(lower(coalesce(c.customer_code, '')), normalized_query) > 0)
  order by o.created_at desc, o.id desc
  limit target_limit;
end;
$$;

revoke all on function public.list_eligible_billing_orders(text, uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.list_eligible_billing_orders(text, uuid, uuid, integer) to authenticated;
