\set ON_ERROR_STOP on
-- Run only against the disposable database, after loading the exact
-- apply_catalog_import function from its canonical 20260901 migration.
do $$ begin if current_database() <> 'phoenix_002j_test' then raise exception 'disposable_database_required'; end if; end $$;
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000101';
set app.test_org = '00000000-0000-4000-8000-000000000001';

create function public.test_unified_catalog_row(target_code text, target_name text,
  target_amount text default null, target_category text default 'ironing')
returns jsonb language sql as $$
  select jsonb_build_object(
    'serviceId','', 'serviceCode',target_code, 'canonicalName',target_name,
    'canonicalDescription','Round-trip café', 'categoryKey',target_category,
    'categoryTranslations','{}'::jsonb, 'translations','{}'::jsonb,
    'unitType','piece', 'manualSortOrder',0, 'orderMode','manual',
    'status','active', 'customerVisible',true, 'customerOrderable',true,
    'featured',false, 'catalogChanged',true, 'skip',false,
    'price',case when target_amount is null then null else
      jsonb_build_object('amount',target_amount,'currency','EUR','isFrom',false,'validTo',null) end);
$$;

-- Successful existing catalog update + new service + both price operations.
do $$
declare today date := (clock_timestamp() at time zone 'Atlantic/Canary')::date;
  snap text; result jsonb; foreign_before jsonb;
begin
  update public.services set portal_image_path='foreign/image.webp'
    where organization_id='00000000-0000-4000-8000-000000000002';
  select to_jsonb(s) into foreign_before from public.services s where code='F-1';
  snap:=public.get_unified_catalog_snapshot();
  result:=public.apply_unified_catalog_import('catalog_and_prices',today+2,
    jsonb_build_array(
      public.test_unified_catalog_row('P-001','Updated café','3.10'),
      public.test_unified_catalog_row('C-NEW','New service','4.20')),
    snap);
  if result->>'catalogCreates'<>'1' or result->>'catalogUpdates'<>'1'
    or result->>'priceCreates'<>'2' then raise exception 'catalog/price commit failed %',result; end if;
  if not exists(select 1 from public.services where code='P-001' and name='Updated café')
    or not exists(select 1 from public.services where code='C-NEW'
      and organization_id='00000000-0000-4000-8000-000000000001')
    or (select count(*) from public.service_prices p join public.services s on s.id=p.service_id
      where s.code in ('P-001','C-NEW') and p.amount in (3.10,4.20))<>2
    or (select to_jsonb(s) from public.services s where code='F-1')<>foreign_before
    or exists(select 1 from public.services where organization_id='00000000-0000-4000-8000-000000000001'
      and portal_image_path is not null) then
    raise exception 'catalog/price commit or isolation assertion failed';
  end if;
end;
$$;

-- A late price failure reverses the catalog update and earlier price change.
do $$
declare today date := (clock_timestamp() at time zone 'Atlantic/Canary')::date;
  snap text; before_price_count integer; before_name text;
begin
  select name into before_name from public.services where code='P-002';
  select count(*) into before_price_count from public.service_prices;
  snap:=public.get_unified_catalog_snapshot();
  begin
    perform public.apply_unified_catalog_import('catalog_and_prices',today+1,
      jsonb_build_array(
        public.test_unified_catalog_row('P-002','Must not persist','3.30'),
        public.test_unified_catalog_row('P-219','Also must not persist','3.40')),
      snap);
    raise exception 'expected_price_failure';
  exception when sqlstate '23P01' then null; end;
  if (select name from public.services where code='P-002')<>before_name
    or (select count(*) from public.service_prices)<>before_price_count then
    raise exception 'price failure did not roll back catalog';
  end if;
end;
$$;

-- A later invalid catalog row reverses an earlier valid catalog row; prices
-- remain unchanged. A corrected retry succeeds from the new snapshot.
do $$
declare today date := (clock_timestamp() at time zone 'Atlantic/Canary')::date;
  snap text; before_price_count integer; before_name text; result jsonb;
begin
  select name into before_name from public.services where code='P-003';
  select count(*) into before_price_count from public.service_prices;
  snap:=public.get_unified_catalog_snapshot();
  begin
    perform public.apply_unified_catalog_import('catalog_and_prices',today+2,
      jsonb_build_array(
        public.test_unified_catalog_row('P-003','Must roll back','3.50'),
        public.test_unified_catalog_row('C-BAD','Bad category','4.50','missing_category')),
      snap);
    raise exception 'expected_catalog_failure';
  exception when sqlstate '22023' then null; end;
  if (select name from public.services where code='P-003')<>before_name
    or (select count(*) from public.service_prices)<>before_price_count
    or exists(select 1 from public.services where code='C-BAD') then
    raise exception 'catalog failure did not roll back transaction';
  end if;
  snap:=public.get_unified_catalog_snapshot();
  result:=public.apply_unified_catalog_import('catalog_and_prices',today+2,
    jsonb_build_array(public.test_unified_catalog_row('P-003','Recovered','3.50')),snap);
  if result->>'catalogUpdates'<>'1' or result->>'priceCreates'<>'1' then
    raise exception 'corrected retry failed %',result;
  end if;
end;
$$;

-- More than 500 catalog rows use the unchanged canonical catalog RPC in
-- batches, yet commit as one enclosing transaction.
do $$
declare payload jsonb; result jsonb; snap text; n integer;
begin
  select jsonb_agg(public.test_unified_catalog_row('B-'||lpad(i::text,4,'0'),
    'Bulk '||i) order by i) into payload from generate_series(1,501) i;
  snap:=public.get_unified_catalog_snapshot();
  result:=public.apply_unified_catalog_import('catalog_and_prices',
    (clock_timestamp() at time zone 'Atlantic/Canary')::date,payload,snap);
  if result->>'catalogCreates'<>'501' then raise exception '501-row catalog batch failed %',result; end if;
  select count(*) into n from public.services where code like 'B-%';
  if n<>501 then raise exception '501-row catalog persist failed'; end if;
end;
$$;
