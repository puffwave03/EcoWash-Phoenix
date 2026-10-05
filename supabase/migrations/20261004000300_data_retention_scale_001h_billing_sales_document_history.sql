create function public.list_billing_invoices_page(
  target_query text, target_status text, target_cursor_created_at timestamptz,
  target_cursor_id uuid, target_direction text, target_limit integer
)
returns table (
  id uuid, created_at timestamptz, invoice_number text, customer_name text,
  issue_date date, currency text, total numeric, paid_total numeric,
  outstanding numeric, payment_status text, order_numbers text[]
)
language plpgsql stable security definer set search_path = public
as $$
declare org_id uuid;
begin
  org_id := public.app_current_organization_id();
  if org_id is null
    or not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[])
    or not public.organization_entitlement_is_enabled(org_id, 'billing.invoicing', now()) then
    raise exception 'history_not_authorized' using errcode = '42501';
  end if;
  if target_status is null or target_status not in ('all', 'draft', 'unpaid', 'partially_paid', 'paid', 'cancelled')
    or target_direction is null or target_direction not in ('older', 'newer')
    or (target_cursor_created_at is null) <> (target_cursor_id is null)
    or target_limit is null or target_limit not between 1 and 26 then
    raise exception 'billing_invalid_page' using errcode = '22023';
  end if;
  return query
  with amounts as (
    select i.*, coalesce((select round(sum(case when p.status = 'confirmed' then p.amount
          when p.status = 'refunded' then -p.amount else 0 end), 2)
        from public.payments p
        where p.organization_id = org_id and exists (
          select 1 from public.invoice_orders io
          where io.organization_id = org_id and io.invoice_id = i.id and io.order_id = p.order_id
        )), 0) as paid_total
    from public.invoices i where i.organization_id = org_id
  ), entries as (
    select a.*, round(greatest(a.total - a.paid_total, 0), 2) as outstanding,
      case when a.document_status = 'draft' then 'draft'
        when a.document_status = 'cancelled' then 'cancelled'
        when a.paid_total <= 0 then 'unpaid'
        when a.paid_total < a.total then 'partially_paid' else 'paid' end as payment_status,
      coalesce((select array_agg(o.order_number order by io.created_at, io.order_id)
        from public.invoice_orders io join public.orders o on o.organization_id = org_id and o.id = io.order_id
        where io.organization_id = org_id and io.invoice_id = a.id), array[]::text[]) as order_numbers
    from amounts a
  )
  select e.id, e.created_at, e.invoice_number, e.customer_name, e.issue_date, e.currency,
    e.total, e.paid_total, e.outstanding, e.payment_status, e.order_numbers
  from entries e
  where (target_status = 'all' or e.payment_status = target_status)
    -- Literal case-insensitive substring search, including the same concatenated fields as the UI.
    and (coalesce(target_query, '') = '' or strpos(lower(coalesce(e.invoice_number, '') || ' ' ||
      e.customer_name || ' ' || array_to_string(e.order_numbers, ' ')), lower(target_query)) > 0)
    and (target_cursor_id is null
      or (target_direction = 'older' and (e.created_at, e.id) < (target_cursor_created_at, target_cursor_id))
      or (target_direction = 'newer' and (e.created_at, e.id) > (target_cursor_created_at, target_cursor_id)))
  order by
    case when target_direction = 'older' then e.created_at end desc,
    case when target_direction = 'older' then e.id end desc,
    case when target_direction = 'newer' then e.created_at end asc,
    case when target_direction = 'newer' then e.id end asc
  limit target_limit;
end;
$$;

create function public.get_billing_history_summary()
returns table (invoice_count bigint, draft_count bigint, currency text, issued_total numeric, outstanding numeric)
language plpgsql stable security definer set search_path = public
as $$
declare org_id uuid;
begin
  org_id := public.app_current_organization_id();
  if org_id is null
    or not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[])
    or not public.organization_entitlement_is_enabled(org_id, 'billing.invoicing', now()) then
    raise exception 'history_not_authorized' using errcode = '42501';
  end if;
  return query
  with amounts as (
    select i.*, coalesce((select round(sum(case when p.status = 'confirmed' then p.amount
          when p.status = 'refunded' then -p.amount else 0 end), 2)
        from public.payments p
        where p.organization_id = org_id and exists (
          select 1 from public.invoice_orders io
          where io.organization_id = org_id and io.invoice_id = i.id and io.order_id = p.order_id
        )), 0) as paid_total
    from public.invoices i where i.organization_id = org_id
  ), primary_currency as (
    select coalesce((select i.currency from public.invoices i
      where i.organization_id = org_id and i.document_status = 'issued'
      order by i.created_at desc, i.id desc limit 1),
      (select o.default_currency::text from public.organizations o where o.id = org_id)) as currency
  )
  select count(a.id), count(a.id) filter (where a.document_status = 'draft'), c.currency,
    coalesce(sum(a.total) filter (where a.document_status = 'issued' and a.currency = c.currency), 0),
    coalesce(sum(round(greatest(a.total - a.paid_total, 0), 2))
      filter (where a.document_status = 'issued' and a.currency = c.currency), 0)
  from primary_currency c left join amounts a on true group by c.currency;

end;
$$;

create function public.get_customer_billing_history_summary(target_customer_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare org_id uuid;
begin
  org_id := public.app_current_organization_id();
  if org_id is null
    or not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[])
    or not public.organization_entitlement_is_enabled(org_id, 'billing.invoicing', now()) then
    raise exception 'history_not_authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from public.customers c where c.organization_id = org_id and c.id = target_customer_id) then
    raise exception 'billing_invalid_customer' using errcode = '22023';
  end if;
  return (
    with amounts as (
      select i.*, coalesce((select round(sum(case when p.status = 'confirmed' then p.amount
          when p.status = 'refunded' then -p.amount else 0 end), 2)
        from public.payments p
        where p.organization_id = org_id and exists (
          select 1 from public.invoice_orders io
          where io.organization_id = org_id and io.invoice_id = i.id and io.order_id = p.order_id
        )), 0) as paid_total
    from public.invoices i where i.organization_id = org_id and i.customer_id = target_customer_id and i.document_status <> 'cancelled'
    ), summaries as (
      select a.currency, count(*) as "invoiceCount",
        coalesce(sum(a.total) filter (where a.document_status = 'issued'), 0) as "issuedTotal",
        coalesce(sum(a.paid_total) filter (where a.document_status = 'issued'), 0) as "paidTotal",
        coalesce(sum(round(greatest(a.total - a.paid_total, 0), 2))
          filter (where a.document_status = 'issued'), 0) as outstanding
      from amounts a group by a.currency
    )
    select jsonb_build_object(
      'summaries', coalesce((select jsonb_agg(s order by s.currency) from summaries s), '[]'::jsonb),
      'eligibleOrderCount', (select count(*) from public.orders o
        join public.customers c on c.organization_id = org_id and c.id = o.customer_id
        where o.organization_id = org_id and o.customer_id = target_customer_id
          and o.is_active and o.production_status <> 'cancelled'
          and c.customer_code is distinct from 'WALKIN-SHARED'
          and not exists (select 1 from public.invoice_orders io
            where io.organization_id = org_id and io.order_id = o.id and io.is_active))
    )
  );
end;
$$;

create function public.list_sales_documents_page(
  target_cursor_issued_at timestamptz, target_cursor_document_number text,
  target_cursor_kind text, target_cursor_id uuid, target_direction text, target_limit integer
)
returns table (
  id uuid, kind text, document_number text, status text, issued_at timestamptz,
  customer text, order_numbers text[], amount numeric, currency text
)
language plpgsql stable security definer set search_path = public
as $$
declare org_id uuid;
begin
  org_id := public.app_current_organization_id();
  if org_id is null
    or not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[])
    or not public.organization_entitlement_is_enabled(org_id, 'printing', now()) then
    raise exception 'history_not_authorized' using errcode = '42501';
  end if;
  if target_direction is null or target_direction not in ('older', 'newer')
    or num_nonnulls(target_cursor_issued_at, target_cursor_document_number, target_cursor_kind, target_cursor_id) not in (0, 4)
    or (target_cursor_kind is not null and target_cursor_kind not in ('receipt', 'invoice'))
    or target_limit is null or target_limit not between 1 and 26 then
    raise exception 'sales_documents_invalid_page' using errcode = '22023';
  end if;
  return query
  with documents as (
    select r.id, 'receipt'::text as kind, 0 as kind_rank, r.receipt_number as document_number,
      r.document_status::text as status, r.issued_at, coalesce(c.display_name, '') as customer,
      array[r.snapshot #>> '{order,orderNumber}'] as order_numbers, r.amount, r.currency
    from public.operational_receipts r
    left join public.customers c on c.organization_id = org_id and c.id = r.customer_id
    where r.organization_id = org_id
    union all
    select i.id, 'invoice'::text, 1, i.invoice_number, i.document_status::text, i.issued_at,
      i.customer_name,
      coalesce((select array_agg(o.order_number order by io.created_at, io.order_id)
        from public.invoice_orders io join public.orders o on o.organization_id = org_id and o.id = io.order_id
        where io.organization_id = org_id and io.invoice_id = i.id), array[]::text[]), i.total, i.currency
    from public.invoices i
    where i.organization_id = org_id and i.document_status in ('issued', 'cancelled')
  )
  select d.id, d.kind, d.document_number, d.status, d.issued_at, d.customer, d.order_numbers, d.amount, d.currency
  from documents d
  -- Mixed ordering: time DESC, then number ASC, receipt first, id ASC.
  where target_cursor_id is null
    or (target_direction = 'older' and (
      d.issued_at < target_cursor_issued_at or
      (d.issued_at = target_cursor_issued_at and (d.document_number, d.kind_rank, d.id) >
        (target_cursor_document_number, case when target_cursor_kind = 'receipt' then 0 else 1 end, target_cursor_id))))
    or (target_direction = 'newer' and (
      d.issued_at > target_cursor_issued_at or
      (d.issued_at = target_cursor_issued_at and (d.document_number, d.kind_rank, d.id) <
        (target_cursor_document_number, case when target_cursor_kind = 'receipt' then 0 else 1 end, target_cursor_id))))
  order by
    case when target_direction = 'older' then d.issued_at end desc,
    case when target_direction = 'older' then d.document_number end asc,
    case when target_direction = 'older' then d.kind_rank end asc,
    case when target_direction = 'older' then d.id end asc,
    case when target_direction = 'newer' then d.issued_at end asc,
    case when target_direction = 'newer' then d.document_number end desc,
    case when target_direction = 'newer' then d.kind_rank end desc,
    case when target_direction = 'newer' then d.id end desc
  limit target_limit;
end;
$$;

revoke all on function public.list_billing_invoices_page(text, text, timestamptz, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.list_billing_invoices_page(text, text, timestamptz, uuid, text, integer) to authenticated;

revoke all on function public.get_billing_history_summary() from public, anon, authenticated;
grant execute on function public.get_billing_history_summary() to authenticated;

revoke all on function public.get_customer_billing_history_summary(uuid) from public, anon, authenticated;
grant execute on function public.get_customer_billing_history_summary(uuid) to authenticated;

revoke all on function public.list_sales_documents_page(timestamptz, text, text, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.list_sales_documents_page(timestamptz, text, text, uuid, text, integer) to authenticated;

-- Deterministic history and customer top-five reads; existing indexes remain intact.
create index invoices_org_created_id_idx on public.invoices (organization_id, created_at desc, id desc);
create index invoices_org_customer_created_id_idx on public.invoices (organization_id, customer_id, created_at desc, id desc);
create index receipts_org_history_idx on public.operational_receipts (organization_id, issued_at desc, receipt_number asc, id asc);
create index invoices_org_issued_history_idx on public.invoices (organization_id, issued_at desc, invoice_number asc, id asc)
  where document_status in ('issued', 'cancelled');
