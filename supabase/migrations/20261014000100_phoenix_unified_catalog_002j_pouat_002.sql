-- PHOENIX-UNIFIED-CATALOG-002J PO UAT finding 002.
-- CREATE OR REPLACE retains the existing function owner and EXECUTE ACL.
create or replace function public.apply_unified_catalog_import(
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
    -- Archived source rows without codes are non-writable in Prices only mode.
    -- Preserve the existing validation path for every other row.
    if item_code = '' and target_mode = 'prices_only'
      and coalesce((item->>'skip')::boolean, false)
      and item->>'status' = 'archived'
      and item->>'skipReason' = 'archived'
      and item->>'catalogChanged' is distinct from 'true' then
      continue;
    end if;
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
