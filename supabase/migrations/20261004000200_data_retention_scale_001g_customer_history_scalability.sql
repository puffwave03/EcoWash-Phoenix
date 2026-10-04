-- Customer explorer: server-derived tenant and membership, with exact counts only for the selected page.
create function public.list_customers_page(
  target_query text,
  target_status text,
  target_cursor_name text,
  target_cursor_id uuid,
  target_direction text,
  target_limit integer
)
returns table (
  id uuid, customer_code text, customer_type public.customer_type, display_name text,
  first_name text, last_name text, company_name text, tax_id text, email text,
  phone text, alternate_phone text, billing_address_line1 text,
  billing_address_line2 text, billing_city text, billing_postal_code text,
  billing_country_code char(2), preferred_locale text, notes text,
  is_active boolean, updated_at timestamptz, property_count bigint
)
language plpgsql stable security definer set search_path = public
as $$
declare org_id uuid;
begin
  org_id := public.app_current_organization_id();
  if not public.is_organization_member(org_id) then
    raise exception 'customer_list_not_authorized' using errcode = '42501';
  end if;
  if target_status is null or target_status not in ('active', 'inactive', 'all')
     or target_direction is null or target_direction not in ('next', 'previous')
     or (target_cursor_name is null) <> (target_cursor_id is null)
     or target_limit is null or target_limit not between 1 and 26 then
    raise exception 'customer_list_invalid_page' using errcode = '22023';
  end if;
  return query
  with selected as materialized (
    select c.*
    from public.customers c
    where c.organization_id = org_id
      and (target_status = 'all' or c.is_active = (target_status = 'active'))
      and (coalesce(target_query, '') = '' or
        c.display_name ilike '%' || target_query || '%' or
        c.company_name ilike '%' || target_query || '%' or
        c.email ilike '%' || target_query || '%' or
        c.phone ilike '%' || target_query || '%' or
        c.customer_code ilike '%' || target_query || '%')
      and (target_cursor_id is null or
        (target_direction = 'next' and (c.display_name, c.id) > (target_cursor_name, target_cursor_id)) or
        (target_direction = 'previous' and (c.display_name, c.id) < (target_cursor_name, target_cursor_id)))
    order by
      case when target_direction = 'next' then c.display_name end asc,
      case when target_direction = 'next' then c.id end asc,
      case when target_direction = 'previous' then c.display_name end desc,
      case when target_direction = 'previous' then c.id end desc
    limit target_limit
  )
  select s.id, s.customer_code, s.customer_type, s.display_name,
    s.first_name, s.last_name, s.company_name, s.tax_id, s.email,
    s.phone, s.alternate_phone, s.billing_address_line1,
    s.billing_address_line2, s.billing_city, s.billing_postal_code,
    s.billing_country_code, s.preferred_locale, s.notes,
    s.is_active, s.updated_at,
    (select count(*) from public.properties p
      where p.organization_id = org_id and p.customer_id = s.id)
  from selected s
  order by
    case when target_direction = 'next' then s.display_name end asc,
    case when target_direction = 'next' then s.id end asc,
    case when target_direction = 'previous' then s.display_name end desc,
    case when target_direction = 'previous' then s.id end desc;
end;
$$;

-- Legacy list_customer_account_orders(uuid,text,integer) remains available unchanged.
create function public.list_customer_account_orders_page(
  target_customer_id uuid,
  target_period text,
  target_cursor_created_at timestamptz,
  target_cursor_id uuid,
  target_direction text,
  target_limit integer
)
returns table (
  id uuid, order_number text, property_id uuid, property_name text,
  production_status public.production_status, created_at timestamptz,
  total numeric, currency text, total_paid numeric, balance_due numeric,
  payment_status text
)
language plpgsql stable security definer set search_path = public
as $$
declare org_id uuid; org_timezone text;
begin
  org_id := public.app_current_organization_id();
  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'customer_account_not_authorized' using errcode = '42501';
  end if;
  if target_period is null or target_period not in ('year', 'all')
     or target_direction is null or target_direction not in ('older', 'newer')
     or (target_cursor_created_at is null) <> (target_cursor_id is null)
     or target_limit is null or target_limit not between 1 and 26 then
    raise exception 'customer_account_invalid_page' using errcode = '22023';
  end if;
  if not exists (select 1 from public.customers c where c.organization_id = org_id and c.id = target_customer_id) then
    raise exception 'customer_account_invalid_customer' using errcode = '22023';
  end if;
  select o.timezone into org_timezone from public.organizations o where o.id = org_id;
  return query
  with selected as materialized (
    select o.id, o.order_number, o.property_id, p.name as property_name,
      o.production_status, o.created_at, o.total, o.currency
    from public.orders o
    left join public.properties p on p.organization_id = o.organization_id and p.id = o.property_id
    where o.organization_id = org_id and o.customer_id = target_customer_id
      and o.is_active and o.production_status <> 'cancelled'
      and (target_period <> 'year' or o.created_at >=
        (date_trunc('year', now() at time zone org_timezone) at time zone org_timezone))
      and (target_cursor_id is null or
        (target_direction = 'older' and (o.created_at, o.id) < (target_cursor_created_at, target_cursor_id)) or
        (target_direction = 'newer' and (o.created_at, o.id) > (target_cursor_created_at, target_cursor_id)))
    order by
      case when target_direction = 'older' then o.created_at end desc,
      case when target_direction = 'older' then o.id end desc,
      case when target_direction = 'newer' then o.created_at end asc,
      case when target_direction = 'newer' then o.id end asc
    limit target_limit
  ), payment_totals as (
    select s.id as order_id,
      coalesce(sum(p.amount) filter (where p.status = 'confirmed'), 0) as confirmed_total,
      coalesce(sum(p.amount) filter (where p.status = 'refunded'), 0) as refunded_total,
      count(p.id) filter (where p.status = 'void') as void_count
    from selected s
    left join public.payments p on p.organization_id = org_id and p.order_id = s.id
    group by s.id
  )
  select s.id, s.order_number, s.property_id, s.property_name,
    s.production_status, s.created_at, round(s.total, 2), s.currency,
    round(pt.confirmed_total - pt.refunded_total, 2),
    round(greatest(s.total - (pt.confirmed_total - pt.refunded_total), 0), 2),
    case
      when s.total <= 0 then 'paid'
      when pt.confirmed_total - pt.refunded_total <= 0 and pt.refunded_total > 0 then 'refunded'
      when pt.confirmed_total - pt.refunded_total <= 0 and pt.confirmed_total = 0 and pt.void_count > 0 then 'void'
      when pt.confirmed_total - pt.refunded_total <= 0 then 'unpaid'
      when pt.confirmed_total - pt.refunded_total < s.total then 'partially_paid'
      else 'paid'
    end
  from selected s join payment_totals pt on pt.order_id = s.id
  order by
    case when target_direction = 'older' then s.created_at end desc,
    case when target_direction = 'older' then s.id end desc,
    case when target_direction = 'newer' then s.created_at end asc,
    case when target_direction = 'newer' then s.id end asc;
end;
$$;

-- Legacy list_customer_account_payments(uuid,text,integer) remains available unchanged.
create function public.list_customer_account_payments_page(
  target_customer_id uuid,
  target_period text,
  target_cursor_paid_at timestamptz,
  target_cursor_created_at timestamptz,
  target_cursor_id uuid,
  target_direction text,
  target_limit integer
)
returns table (
  id uuid, order_id uuid, order_number text, amount numeric,
  method public.payment_method, status public.payment_record_status,
  paid_at timestamptz, created_at timestamptz,
  refunded_from_payment_id uuid, currency text
)
language plpgsql stable security definer set search_path = public
as $$
declare org_id uuid; org_timezone text;
begin
  org_id := public.app_current_organization_id();
  if not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'customer_account_not_authorized' using errcode = '42501';
  end if;
  if target_period is null or target_period not in ('year', 'all')
     or target_direction is null or target_direction not in ('older', 'newer')
     or not ((target_cursor_paid_at is null and target_cursor_created_at is null and target_cursor_id is null)
       or (target_cursor_paid_at is not null and target_cursor_created_at is not null and target_cursor_id is not null))
     or target_limit is null or target_limit not between 1 and 26 then
    raise exception 'customer_account_invalid_page' using errcode = '22023';
  end if;
  if not exists (select 1 from public.customers c where c.organization_id = org_id and c.id = target_customer_id) then
    raise exception 'customer_account_invalid_customer' using errcode = '22023';
  end if;
  select o.timezone into org_timezone from public.organizations o where o.id = org_id;
  return query
  select p.id, p.order_id, o.order_number, round(p.amount, 2),
    p.method, p.status, p.paid_at, p.created_at,
    p.refunded_from_payment_id, o.currency
  from public.payments p
  join public.orders o on o.organization_id = p.organization_id and o.id = p.order_id
  where o.organization_id = org_id and o.customer_id = target_customer_id
    and o.is_active and o.production_status <> 'cancelled'
    and (target_period <> 'year' or p.paid_at >=
      (date_trunc('year', now() at time zone org_timezone) at time zone org_timezone))
    and (target_cursor_id is null or
      (target_direction = 'older' and (p.paid_at, p.created_at, p.id) <
        (target_cursor_paid_at, target_cursor_created_at, target_cursor_id)) or
      (target_direction = 'newer' and (p.paid_at, p.created_at, p.id) >
        (target_cursor_paid_at, target_cursor_created_at, target_cursor_id)))
  order by
    case when target_direction = 'older' then p.paid_at end desc,
    case when target_direction = 'older' then p.created_at end desc,
    case when target_direction = 'older' then p.id end desc,
    case when target_direction = 'newer' then p.paid_at end asc,
    case when target_direction = 'newer' then p.created_at end asc,
    case when target_direction = 'newer' then p.id end asc
  limit target_limit;
end;
$$;

revoke all on function public.list_customers_page(text,text,text,uuid,text,integer) from public, anon, authenticated;
revoke all on function public.list_customer_account_orders_page(uuid,text,timestamptz,uuid,text,integer) from public, anon, authenticated;
revoke all on function public.list_customer_account_payments_page(uuid,text,timestamptz,timestamptz,uuid,text,integer) from public, anon, authenticated;
grant execute on function public.list_customers_page(text,text,text,uuid,text,integer) to authenticated;
grant execute on function public.list_customer_account_orders_page(uuid,text,timestamptz,uuid,text,integer) to authenticated;
grant execute on function public.list_customer_account_payments_page(uuid,text,timestamptz,timestamptz,uuid,text,integer) to authenticated;

create index customers_org_display_name_id_idx
on public.customers (organization_id, display_name asc, id asc);
create index orders_org_customer_created_id_idx
on public.orders (organization_id, customer_id, created_at desc, id desc);
create index payments_org_order_paid_created_id_idx
on public.payments (organization_id, order_id, paid_at desc, created_at desc, id desc);
