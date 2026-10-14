-- 002J: a single authenticated transaction for catalog and global base prices.
-- No historical price rows are rewritten by this migration.
begin;
-- Hold off all concurrent price writers until the preflight and trigger are
-- installed as one atomic schema change.
lock table public.service_prices in share row exclusive mode;

-- Inclusive validity periods. Global prices and each location override form
-- separate streams; inactive history is deliberately outside this invariant.
do $$
begin
  if exists (
    select 1 from public.service_prices a
    join public.service_prices b
      on b.organization_id = a.organization_id
      and b.service_id = a.service_id
      and b.currency = a.currency
      and b.location_id is not distinct from a.location_id
      and b.id > a.id
      and b.is_active
      and daterange(a.valid_from, a.valid_to, '[]')
        && daterange(b.valid_from, b.valid_to, '[]')
    where a.is_active
  ) then
    raise exception 'active_service_price_period_overlap_preflight' using errcode = '23P01';
  end if;
end;
$$;

create function public.prevent_active_service_price_overlap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not new.is_active then return new; end if;
  -- Every writer of this service, including a direct table writer, must
  -- serialize before checking the price stream. The existing tenant FK also
  -- verifies that the service belongs to the same organization.
  perform 1 from public.services s
    where s.id = new.service_id and s.organization_id = new.organization_id
    for update;
  if not found then
    raise exception 'service_price_invalid_service' using errcode = '23503';
  end if;
  if exists (
    select 1 from public.service_prices p
    where p.organization_id = new.organization_id
      and p.service_id = new.service_id
      and p.currency = new.currency
      and p.location_id is not distinct from new.location_id
      and p.is_active
      and p.id is distinct from new.id
      and daterange(p.valid_from, p.valid_to, '[]')
        && daterange(new.valid_from, new.valid_to, '[]')
  ) then
    raise exception 'active_service_price_period_overlap' using errcode = '23P01';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_active_service_price_overlap() from public, anon, authenticated;
create trigger service_prices_prevent_active_period_overlap
before insert or update of organization_id, service_id, location_id,
  currency, valid_from, valid_to, is_active
on public.service_prices
for each row execute function public.prevent_active_service_price_overlap();

create function public.unified_catalog_snapshot_for_org(target_org uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select md5(jsonb_build_object(
    'organization', (select to_jsonb(o) from public.organizations o where o.id = target_org),
    'services', (select coalesce(jsonb_agg(to_jsonb(s) order by s.id), '[]'::jsonb)
      from public.services s where s.organization_id = target_org),
    'prices', (select coalesce(jsonb_agg(to_jsonb(p) order by p.id), '[]'::jsonb)
      from public.service_prices p where p.organization_id = target_org),
    'categories', (select coalesce(jsonb_agg(to_jsonb(c) order by c.category_key), '[]'::jsonb)
      from public.organization_portal_categories c where c.organization_id = target_org),
    'serviceTranslations', (select coalesce(jsonb_agg(to_jsonb(t) order by t.service_id, t.locale), '[]'::jsonb)
      from public.service_catalog_translations t where t.organization_id = target_org),
    'categoryTranslations', (select coalesce(jsonb_agg(to_jsonb(t) order by t.category_key, t.locale), '[]'::jsonb)
      from public.category_catalog_translations t where t.organization_id = target_org)
  )::text);
$$;

create function public.get_unified_catalog_snapshot()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  org_id uuid := public.app_current_organization_id();
begin
  if auth.uid() is null
    or not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[])
    or not exists (select 1 from public.organizations o
      where o.id = org_id and o.status = 'active' and o.deleted_at is null) then
    raise exception 'unified_catalog_denied' using errcode = '42501';
  end if;
  return public.unified_catalog_snapshot_for_org(org_id);
end;
$$;

-- Called only by the guarded RPCs below. A previous open period is closed;
-- closed historical periods and all location/segment prices remain untouched.
create function public.apply_base_price_version(
  target_org uuid, target_service uuid, target_amount numeric,
  target_currency text, target_is_from boolean,
  target_valid_from date, target_valid_to date
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  prior public.service_prices%rowtype;
  existing public.service_prices%rowtype;
  same_day public.service_prices%rowtype;
  prior_count integer := 0;
  future_conflict boolean := false;
  org_currency text;
  org_today date;
begin
  select o.default_currency, (transaction_timestamp() at time zone o.timezone)::date
    into org_currency, org_today
  from public.organizations o
  where o.id = target_org and o.status = 'active' and o.deleted_at is null;
  if org_currency is null or target_currency is distinct from org_currency
    or target_amount is null or target_amount < 0 or target_amount >= 10000000000
    or target_amount <> round(target_amount, 2)
    or target_is_from is null or target_valid_from is null
    or (target_valid_to is not null and target_valid_to < target_valid_from)
    or not exists (select 1 from public.services s
      where s.organization_id = target_org and s.id = target_service) then
    raise exception 'base_price_invalid' using errcode = '22023';
  end if;
  perform 1 from public.services s
    where s.organization_id = target_org and s.id = target_service for update;

  if exists (select 1 from public.service_prices p
    where p.organization_id = target_org and p.service_id = target_service
      and p.location_id is null and p.is_active
      and p.currency is distinct from target_currency
      and daterange(p.valid_from, p.valid_to, '[]')
        && daterange(target_valid_from, target_valid_to, '[]')) then
    raise exception 'base_price_cross_currency_conflict' using errcode = '23P01';
  end if;

  for existing in
    select p.* from public.service_prices p
    where p.organization_id = target_org and p.service_id = target_service
      and p.location_id is null and p.currency = target_currency and p.is_active
    order by p.valid_from, p.id for update
  loop
    if existing.valid_from = target_valid_from then same_day := existing; end if;
    if (existing.valid_from > org_today and existing.valid_from <> target_valid_from)
      or existing.valid_from > target_valid_from then
      future_conflict := true;
    end if;
    if existing.valid_from < target_valid_from
      and (existing.valid_to is null or existing.valid_to >= target_valid_from) then
      prior_count := prior_count + 1;
      prior := existing;
    end if;
  end loop;

  if same_day.id is not null then
    if prior_count > 0 then
      raise exception 'base_price_overlap' using errcode = '23P01';
    end if;
    if same_day.amount = target_amount and same_day.currency = target_currency
      and same_day.is_from = target_is_from
      and same_day.valid_to is not distinct from target_valid_to then
      return 'unchanged';
    end if;
    raise exception 'base_price_same_day_conflict' using errcode = '23P01';
  end if;

  if target_valid_from < org_today then
    raise exception 'base_price_retroactive' using errcode = '22023';
  end if;
  if prior_count > 1 then
    raise exception 'base_price_overlap' using errcode = '23P01';
  end if;
  -- A changed effective date alone is not a new economic fact while the
  -- applicable period, amount and starting-from flag remain identical.
  if prior_count = 1 and prior.amount = target_amount
    and prior.currency = target_currency and prior.is_from = target_is_from
    and prior.valid_to is not distinct from target_valid_to then
    return 'unchanged';
  end if;
  if future_conflict then
    raise exception 'base_price_future_conflict' using errcode = '23P01';
  end if;
  if prior_count = 1 then
    update public.service_prices p
    set valid_to = target_valid_from - 1, updated_by = auth.uid()
    where p.id = prior.id and p.organization_id = target_org
      and p.valid_from < target_valid_from
      and (p.valid_to is null or p.valid_to >= target_valid_from);
    if not found then raise exception 'base_price_stale' using errcode = '40001'; end if;
  end if;

  if exists (select 1 from public.service_prices p
    where p.organization_id = target_org and p.service_id = target_service
      and p.location_id is null and p.currency = target_currency and p.is_active
      and daterange(p.valid_from, p.valid_to, '[]')
        && daterange(target_valid_from, target_valid_to, '[]')) then
    raise exception 'base_price_overlap' using errcode = '23P01';
  end if;
  insert into public.service_prices (
    organization_id, service_id, location_id, amount, currency, is_from,
    valid_from, valid_to, is_active, created_by, updated_by
  ) values (
    target_org, target_service, null, target_amount, target_currency, target_is_from,
    target_valid_from, target_valid_to, true, auth.uid(), auth.uid()
  );
  return case when prior_count = 1 then 'closed_and_created' else 'created' end;
end;
$$;

create function public.apply_unified_catalog_import(
  target_mode text, target_effective_date date,
  target_rows jsonb, expected_snapshot text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id uuid := public.app_current_organization_id();
  org_currency text;
  org_today date;
  item jsonb;
  price jsonb;
  item_code text;
  requested_order_mode text;
  service_id uuid;
  seen_codes text[] := array[]::text[];
  catalog_rows jsonb := '[]'::jsonb;
  catalog_batch jsonb;
  catalog_offset integer;
  batch_creates integer;
  batch_updates integer;
  created_prices integer := 0;
  closed_prices integer := 0;
  unchanged_prices integer := 0;
  catalog_creates integer := 0;
  catalog_updates integer := 0;
  price_action text;
  end_date date;
begin
  if auth.uid() is null or target_mode is null
    or target_mode not in ('prices_only', 'catalog_and_prices')
    or jsonb_typeof(target_rows) is distinct from 'array'
    or expected_snapshot is null or expected_snapshot !~ '^[0-9a-f]{32}$'
    or not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[]) then
    raise exception 'unified_catalog_invalid_or_denied' using errcode = '42501';
  end if;
  if jsonb_array_length(target_rows) < 1 or jsonb_array_length(target_rows) > 2000 then
    raise exception 'unified_catalog_row_count_invalid' using errcode = '22023';
  end if;

  select o.default_currency, (transaction_timestamp() at time zone o.timezone)::date
    into org_currency, org_today
  from public.organizations o where o.id = org_id
    and o.status = 'active' and o.deleted_at is null for update;
  if org_currency is null or target_effective_date is null
    or target_effective_date < org_today then
    raise exception 'unified_catalog_effective_date_invalid' using errcode = '22023';
  end if;

  -- The organization row serializes this RPC and the manual editor. Target
  -- service/price rows also block ordinary direct updates and FK inserts.
  perform 1 from public.services s where s.organization_id = org_id for update;
  perform 1 from public.service_prices p where p.organization_id = org_id for update;
  if target_mode = 'catalog_and_prices' then
    -- These tenant rows and their FK parents serialize translation/category
    -- writers without blocking unrelated organizations at the table level.
    perform 1 from public.organization_portal_categories c
      where c.organization_id = org_id for update;
    perform 1 from public.service_catalog_translations t
      where t.organization_id = org_id for update;
    perform 1 from public.category_catalog_translations t
      where t.organization_id = org_id for update;
  end if;
  if public.unified_catalog_snapshot_for_org(org_id) <> expected_snapshot then
    raise exception 'unified_catalog_stale_preview' using errcode = '40001';
  end if;

  for item in select value from jsonb_array_elements(target_rows) loop
    item_code := item->>'serviceCode';
    if item_code is null or item_code = '' or length(item_code) > 80 or item_code ~ '[[:cntrl:]]'
      or item_code = any(seen_codes) then
      raise exception 'unified_catalog_duplicate_or_invalid_code' using errcode = '22023';
    end if;
    seen_codes := array_append(seen_codes, item_code);
    if coalesce((item->>'skip')::boolean, false) then
      if nullif(btrim(item->>'skipReason'), '') is null
        or length(item->>'skipReason') > 160
        or item->>'catalogChanged' = 'true' then
        raise exception 'unified_catalog_invalid_exclusion' using errcode = '22023';
      end if;
      continue;
    end if;
    if target_mode = 'catalog_and_prices' then
      if requested_order_mode is null then
        requested_order_mode := item->>'orderMode';
      elsif item->>'orderMode' is distinct from requested_order_mode then
        raise exception 'unified_catalog_order_mode_mismatch' using errcode = '22023';
      end if;
    end if;
    select s.id into service_id from public.services s
      where s.organization_id = org_id and s.code = item_code;
    if target_mode = 'prices_only' and service_id is null then
      raise exception 'unified_catalog_unknown_service' using errcode = '22023';
    end if;
    if target_mode = 'prices_only' and not exists (
      select 1 from public.services s where s.id = service_id
        and s.organization_id = org_id and s.is_active
    ) then
      raise exception 'unified_catalog_inactive_service' using errcode = '22023';
    end if;
    if target_mode = 'prices_only' and not exists (
      select 1 from public.services s where s.id = service_id
        and s.organization_id = org_id and s.unit_type::text = item->>'unitType'
    ) then
      raise exception 'unified_catalog_unit_mismatch' using errcode = '22023';
    end if;
    if target_mode = 'catalog_and_prices' and item->>'catalogChanged' = 'true' then
      -- Imported service IDs and image paths are informational only.
      catalog_rows := catalog_rows || jsonb_build_array(
        jsonb_set(item - 'price' - 'catalogChanged' - 'mediaReference',
          '{serviceId}', '""'::jsonb, true));
    end if;
    price := item->'price';
    if jsonb_typeof(price) = 'object' then
      if coalesce(price->>'amount', '') !~ '^(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?$'
        or price->>'currency' is distinct from org_currency
        or jsonb_typeof(price->'isFrom') <> 'boolean'
        or (price->>'validTo' is not null
          and (price->>'validTo' !~ '^\d{4}-\d{2}-\d{2}$')) then
        raise exception 'unified_catalog_price_invalid' using errcode = '22023';
      end if;
    end if;
  end loop;

  -- The existing catalog RPC accepts 500 rows. Each call runs inside this
  -- outer RPC transaction; a failure in any batch or price rolls all back.
  for catalog_offset in 0..((jsonb_array_length(catalog_rows) - 1) / 500) loop
    exit when jsonb_array_length(catalog_rows) = 0;
    select jsonb_agg(value order by ordinal)
      into catalog_batch
    from jsonb_array_elements(catalog_rows) with ordinality as e(value, ordinal)
    where ordinal > catalog_offset * 500 and ordinal <= (catalog_offset + 1) * 500;
    select result.created_count, result.updated_count
      into batch_creates, batch_updates
    from public.apply_catalog_import(catalog_batch) result;
    catalog_creates := catalog_creates + batch_creates;
    catalog_updates := catalog_updates + batch_updates;
  end loop;

  for item in select value from jsonb_array_elements(target_rows) loop
    if coalesce((item->>'skip')::boolean, false) then continue; end if;
    price := item->'price';
    if jsonb_typeof(price) is distinct from 'object' then continue; end if;
    select s.id into service_id from public.services s
      where s.organization_id = org_id and s.code = item->>'serviceCode';
    if service_id is null then raise exception 'unified_catalog_unknown_service' using errcode = '22023'; end if;
    end_date := nullif(price->>'validTo', '')::date;
    price_action := public.apply_base_price_version(
      org_id, service_id, (price->>'amount')::numeric,
      price->>'currency', (price->>'isFrom')::boolean,
      target_effective_date, end_date);
    if price_action = 'unchanged' then unchanged_prices := unchanged_prices + 1;
    else
      created_prices := created_prices + 1;
      if price_action = 'closed_and_created' then closed_prices := closed_prices + 1; end if;
    end if;
  end loop;
  return jsonb_build_object(
    'catalogCreates', catalog_creates,
    'catalogUpdates', catalog_updates,
    'priceCreates', created_prices,
    'priceClosures', closed_prices,
    'priceUnchanged', unchanged_prices);
end;
$$;

create function public.save_service_with_versioned_price(
  target_service_id uuid, target_name text, target_code text,
  target_description text, target_unit_type text, target_category text,
  target_is_active boolean, target_amount numeric, target_currency text,
  target_is_from boolean, target_valid_from date, target_valid_to date
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id uuid := public.app_current_organization_id();
  price_action text;
begin
  if auth.uid() is null
    or not public.has_organization_role(org_id, array['owner', 'manager']::public.app_role[])
    or nullif(btrim(target_name), '') is null or length(target_name) > 160
    or length(coalesce(target_code, '')) > 80
    or length(coalesce(target_description, '')) > 600
    or length(coalesce(target_category, '')) > 100
    or target_unit_type not in ('piece', 'weight', 'area', 'cycle', 'service', 'day')
    or target_is_active is null then
    raise exception 'service_price_edit_invalid_or_denied' using errcode = '42501';
  end if;
  perform 1 from public.organizations o where o.id = org_id
    and o.status = 'active' and o.deleted_at is null for update;
  if not found then raise exception 'service_price_edit_denied' using errcode = '42501'; end if;
  perform 1 from public.services s where s.id = target_service_id
    and s.organization_id = org_id for update;
  if not found then raise exception 'service_price_edit_denied' using errcode = '42501'; end if;
  if target_amount is null then
    price_action := 'unchanged';
  else
    price_action := public.apply_base_price_version(
      org_id, target_service_id, target_amount, target_currency,
      target_is_from, target_valid_from, target_valid_to);
  end if;
  update public.services s set
    code = nullif(target_code, ''), name = btrim(target_name),
    description = nullif(target_description, ''),
    unit_type = target_unit_type::public.service_unit_type,
    category = nullif(target_category, ''), is_active = target_is_active,
    updated_by = auth.uid()
  where s.id = target_service_id and s.organization_id = org_id;
  return price_action;
end;
$$;

revoke all on function public.unified_catalog_snapshot_for_org(uuid) from public, anon, authenticated;
revoke all on function public.apply_base_price_version(uuid, uuid, numeric, text, boolean, date, date) from public, anon, authenticated;
revoke all on function public.get_unified_catalog_snapshot() from public, anon, authenticated;
revoke all on function public.apply_unified_catalog_import(text, date, jsonb, text) from public, anon, authenticated;
revoke all on function public.save_service_with_versioned_price(uuid, text, text, text, text, text, boolean, numeric, text, boolean, date, date) from public, anon, authenticated;
grant execute on function public.get_unified_catalog_snapshot() to authenticated;
grant execute on function public.apply_unified_catalog_import(text, date, jsonb, text) to authenticated;
grant execute on function public.save_service_with_versioned_price(uuid, text, text, text, text, text, boolean, numeric, text, boolean, date, date) to authenticated;
commit;
