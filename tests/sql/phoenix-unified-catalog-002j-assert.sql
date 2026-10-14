\set ON_ERROR_STOP on
-- Disposable local database only. Never run against staging or production.
do $$ begin if current_database() <> 'phoenix_002j_test' then raise exception 'disposable_database_required'; end if; end $$;
do $$ begin
  if pg_catalog.has_function_privilege('anon','public.apply_unified_catalog_import(text,date,jsonb,text)','EXECUTE')
    or pg_catalog.has_function_privilege('authenticated','public.apply_base_price_version(uuid,uuid,numeric,text,boolean,date,date)','EXECUTE')
    or pg_catalog.has_function_privilege('anon','public.prevent_active_service_price_overlap()','EXECUTE')
    or not pg_catalog.has_function_privilege('authenticated','public.apply_unified_catalog_import(text,date,jsonb,text)','EXECUTE')
    or not pg_catalog.has_function_privilege('authenticated','public.save_service_with_versioned_price(uuid,text,text,text,text,text,boolean,numeric,text,boolean,date,date)','EXECUTE') then
    raise exception 'function grants invalid';
  end if;
end $$;
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000101';
set app.test_org = '00000000-0000-4000-8000-000000000001';
insert into public.services(id,organization_id,code,name)
select ('00000000-0000-4000-8000-' || lpad((1000+i)::text,12,'0'))::uuid,
  '00000000-0000-4000-8000-000000000001','P-'||lpad(i::text,3,'0'),'Pilot '||i
from generate_series(1,219) i;
do $$
declare payload jsonb; result jsonb; snap text; today date := (clock_timestamp() at time zone 'Atlantic/Canary')::date; n int;
begin
 select jsonb_agg(jsonb_build_object('serviceCode',code,'unitType','piece','price',jsonb_build_object('amount','2.80','currency','EUR','isFrom',code in ('P-218','P-219'),'validTo',null))) into payload from public.services where organization_id='00000000-0000-4000-8000-000000000001' and code like 'P-%';
 snap:=public.get_unified_catalog_snapshot();
 result:=public.apply_unified_catalog_import('prices_only',today,payload,snap);
 if result->>'priceCreates' <> '219' then raise exception '219 create failed %',result; end if;
 select count(*) into n from public.service_prices where organization_id='00000000-0000-4000-8000-000000000001';
 if n<>219 then raise exception 'price count %',n; end if;
 select count(*) into n from public.service_prices where organization_id='00000000-0000-4000-8000-000000000001' and is_from;
 if n<>2 then raise exception 'starting-from count %',n; end if;
 begin perform public.apply_unified_catalog_import('prices_only',today,payload,snap); raise exception 'stale accepted'; exception when sqlstate '40001' then null; end;
 snap:=public.get_unified_catalog_snapshot();
 result:=public.apply_unified_catalog_import('prices_only',today,payload,snap);
 if result->>'priceUnchanged' <> '219' then raise exception 'idempotence failed %',result; end if;
 begin
   perform public.apply_unified_catalog_import('prices_only',today,
     jsonb_build_array(jsonb_build_object('serviceCode','P-001','unitType','weight',
       'price',jsonb_build_object('amount','2.80','currency','EUR','isFrom',false))),snap);
   raise exception 'unit mismatch accepted';
 exception when sqlstate '22023' then null; end;
 result:=public.apply_unified_catalog_import('prices_only',today,
   jsonb_build_array(jsonb_build_object('serviceCode','EXCLUDED-OLD','skip',true,
     'skipReason','approved historical exclusion','catalogChanged',false,
     'price',jsonb_build_object('amount','8.00','currency','EUR','isFrom',false)),
     jsonb_build_object('serviceCode','P-001','unitType','piece','price',null)),snap);
 if result->>'priceCreates'<>'0' then raise exception 'exclusion or blank price wrote data'; end if;
 begin
   payload:=payload || jsonb_build_array(jsonb_build_object('serviceCode','F-1','unitType','piece','price',jsonb_build_object('amount','4.00','currency','EUR','isFrom',false)));
   perform public.apply_unified_catalog_import('prices_only',today,payload,snap);
   raise exception 'foreign accepted';
 exception when sqlstate '22023' then null; end;
 select count(*) into n from public.service_prices where organization_id='00000000-0000-4000-8000-000000000001';
 if n<>219 then raise exception 'rollback failed %',n; end if;
end;
$$;
-- Match the preview's inclusive cross-currency range matrix. All writes in
-- this block are rolled back; only a global, actually overlapping period
-- may prevent the proposed EUR price.
do $$
declare today date := (clock_timestamp() at time zone 'Atlantic/Canary')::date;
  org uuid := '00000000-0000-4000-8000-000000000001';
  sid uuid := '00000000-0000-4000-8000-000000000016';
  snap text; payload jsonb; result jsonb; before_count integer;
begin
  begin
    insert into public.services(id,organization_id,code,name,is_active)
      values(sid,org,'CURRENCY-RANGE','Range test',true);
    insert into public.service_prices(organization_id,service_id,amount,currency,
      is_from,valid_from,is_active)
      values(org,sid,4,'GBP',false,today+40,true);

    -- Future GBP starts after the proposed finite EUR period: allowed.
    snap := public.get_unified_catalog_snapshot();
    payload := jsonb_build_array(jsonb_build_object('serviceCode','CURRENCY-RANGE',
      'unitType','piece','price',jsonb_build_object('amount','2.80','currency','EUR',
      'isFrom',false,'validTo',(today+18)::text)));
    result := public.apply_unified_catalog_import('prices_only',today+7,payload,snap);
    if result->>'priceCreates' <> '1' or not exists (
      select 1 from public.service_prices p where p.service_id=sid
        and p.currency='EUR' and p.valid_from=today+7 and p.valid_to=today+18
    ) then raise exception 'nonoverlapping finite EUR period rejected'; end if;
    select count(*) into before_count from public.service_prices where service_id=sid;

    -- Equality at the proposed end date counts as overlap.
    snap := public.get_unified_catalog_snapshot();
    payload := jsonb_build_array(jsonb_build_object('serviceCode','CURRENCY-RANGE',
      'unitType','piece','price',jsonb_build_object('amount','3.00','currency','EUR',
      'isFrom',false,'validTo',(today+40)::text)));
    begin
      perform public.apply_unified_catalog_import('prices_only',today+30,payload,snap);
      raise exception 'inclusive foreign-currency overlap accepted';
    exception when sqlstate '23P01' then
      if sqlerrm <> 'base_price_cross_currency_conflict' then raise; end if;
    end;

    -- Open-ended EUR also overlaps the future GBP price.
    payload := jsonb_build_array(jsonb_build_object('serviceCode','CURRENCY-RANGE',
      'unitType','piece','price',jsonb_build_object('amount','3.00','currency','EUR',
      'isFrom',false,'validTo',null)));
    begin
      perform public.apply_unified_catalog_import('prices_only',today+20,payload,snap);
      raise exception 'open-ended foreign-currency overlap accepted';
    exception when sqlstate '23P01' then
      if sqlerrm <> 'base_price_cross_currency_conflict' then raise; end if;
    end;
    if (select count(*) from public.service_prices where service_id=sid) <> before_count then
      raise exception 'rejected range changed price history';
    end if;
    raise exception 'test_rollback';
  exception when raise_exception then
    if sqlerrm <> 'test_rollback' then raise; end if;
  end;
end;
$$;
-- A new effective date without a changed price must leave 209 histories intact.
-- The preview planner's create/unchanged/close-and-create cases must match
-- the transactional helper. All changes here roll back in a subtransaction.
do $$
declare today date := (clock_timestamp() at time zone 'Atlantic/Canary')::date;
  org uuid := '00000000-0000-4000-8000-000000000001';
  sid uuid := '00000000-0000-4000-8000-000000000015';
  result text; snap text; payload jsonb; before_count integer;
begin
  begin
    insert into public.services(id,organization_id,code,name,is_active)
      values(sid,org,'ARCHIVED-PRICE','Archived',false);
    snap := public.get_unified_catalog_snapshot();
    payload := jsonb_build_array(jsonb_build_object('serviceCode','ARCHIVED-PRICE',
      'unitType','piece','price',jsonb_build_object('amount','2.80','currency','EUR',
      'isFrom',false,'validTo',null)));
    begin
      perform public.apply_unified_catalog_import('prices_only',today,payload,snap);
      raise exception 'archived destination accepted';
    exception when sqlstate '22023' then
      if sqlerrm <> 'unified_catalog_inactive_service' then raise; end if;
    end;
    if exists(select 1 from public.service_prices where service_id=sid) then
      raise exception 'archived destination received a price';
    end if;
    update public.services set is_active = true where id = sid;

    -- A closed GBP history before the new date is not a conflict.
    insert into public.service_prices(organization_id,service_id,amount,currency,
      is_from,valid_from,valid_to,is_active)
      values(org,sid,3.50,'GBP',true,today-5,today-1,true);
    result := public.apply_base_price_version(org,sid,2.80,'EUR',false,today,null);
    if result <> 'created' then raise exception 'expected create after closed foreign history'; end if;
    result := public.apply_base_price_version(org,sid,2.80,'EUR',false,today+1,null);
    if result <> 'unchanged' then raise exception 'expected unchanged EUR preview match'; end if;
    result := public.apply_base_price_version(org,sid,3.00,'EUR',false,today+1,null);
    if result <> 'closed_and_created' then raise exception 'expected closure EUR preview match'; end if;

    -- Only global base-price streams conflict; location overrides remain separate.
    insert into public.service_prices(organization_id,service_id,location_id,amount,
      currency,is_from,valid_from,is_active)
      values(org,sid,'00000000-0000-4000-8000-000000000201',5,'GBP',false,today,true);
    result := public.apply_base_price_version(org,sid,3.00,'EUR',false,today+2,null);
    if result <> 'unchanged' then raise exception 'location override affected global planner'; end if;

    -- A concurrent active global foreign-currency stream is ambiguous even
    -- though the same-currency overlap trigger correctly allows it.
    insert into public.service_prices(organization_id,service_id,amount,currency,
      is_from,valid_from,is_active) values(org,sid,4,'GBP',false,today,true);
    select count(*) into before_count from public.service_prices where service_id=sid;
    begin
      perform public.apply_base_price_version(org,sid,3.00,'EUR',false,today+2,null);
      raise exception 'cross-currency ambiguity accepted';
    exception when sqlstate '23P01' then
      if sqlerrm <> 'base_price_cross_currency_conflict' then raise; end if;
    end;
    snap := public.get_unified_catalog_snapshot();
    payload := jsonb_build_array(jsonb_build_object('serviceCode','ARCHIVED-PRICE',
      'unitType','piece','price',jsonb_build_object('amount','3.00','currency','EUR',
      'isFrom',false,'validTo',null)));
    begin
      perform public.apply_unified_catalog_import('prices_only',today+2,payload,snap);
      raise exception 'CSV accepted cross-currency ambiguity';
    exception when sqlstate '23P01' then
      if sqlerrm <> 'base_price_cross_currency_conflict' then raise; end if;
    end;
    if (select count(*) from public.service_prices where service_id=sid) <> before_count then
      raise exception 'cross-currency rejection changed price history';
    end if;
    raise exception 'test_rollback';
  exception when raise_exception then
    if sqlerrm <> 'test_rollback' then raise; end if;
  end;
end;
$$;
-- Roll the sample forward only inside a caught subtransaction so later tests
-- continue against the original 219-row snapshot.
do $$
declare payload jsonb; result jsonb; snap text;
  today date := (clock_timestamp() at time zone 'Atlantic/Canary')::date;
begin
  begin
    select jsonb_agg(jsonb_build_object('serviceCode',code,'unitType','piece',
      'price',jsonb_build_object('amount',case when code between 'P-001' and 'P-010' then '3.00' else '2.80' end,
      'currency','EUR','isFrom',code in ('P-218','P-219'),'validTo',null)) order by code)
      into payload from public.services
      where organization_id='00000000-0000-4000-8000-000000000001' and code like 'P-%';
    snap:=public.get_unified_catalog_snapshot();
    result:=public.apply_unified_catalog_import('prices_only',today+1,payload,snap);
    if result->>'priceCreates'<>'10' or result->>'priceUnchanged'<>'209'
      or result->>'priceClosures'<>'10' then
      raise exception 'redundant-version test failed %',result;
    end if;
    raise exception 'test_rollback';
  exception when raise_exception then
    if sqlerrm <> 'test_rollback' then raise; end if;
  end;
end;
$$;
-- A late conflicting price must roll back earlier closures and inserts.
do $$
declare today date := (clock_timestamp() at time zone 'Atlantic/Canary')::date;
  sid uuid; payload jsonb; snap text; before_count integer; after_count integer; prior_end date;
begin
  select id into sid from public.services where code='P-219';
  update public.service_prices set valid_to=today where service_id=sid and is_active;
  insert into public.service_prices(organization_id,service_id,amount,currency,is_from,valid_from,is_active)
    values('00000000-0000-4000-8000-000000000001',sid,9,'EUR',true,today+1,true);
  select jsonb_agg(jsonb_build_object('serviceCode',code,'unitType','piece',
    'price',jsonb_build_object('amount','3.00','currency','EUR','isFrom',false,'validTo',null)) order by code)
    into payload from public.services where organization_id='00000000-0000-4000-8000-000000000001' and code like 'P-%';
  select count(*) into before_count from public.service_prices;
  snap:=public.get_unified_catalog_snapshot();
  begin
    perform public.apply_unified_catalog_import('prices_only',today+1,payload,snap);
    raise exception 'late conflict accepted';
  exception when sqlstate '23P01' then null; end;
  select count(*) into after_count from public.service_prices;
  if after_count<>before_count then raise exception 'partial price rows persisted'; end if;
  select valid_to into prior_end from public.service_prices
    where service_id=(select id from public.services where code='P-001') and is_active;
  if prior_end is not null then raise exception 'earlier closure did not roll back'; end if;
end;
$$;
do $$
declare today date := (clock_timestamp() at time zone 'Atlantic/Canary')::date; sid uuid:='00000000-0000-4000-8000-000000000011'; n int;
begin
 perform public.apply_base_price_version('00000000-0000-4000-8000-000000000001',sid,10,'EUR',true,today,null);
 perform public.apply_base_price_version('00000000-0000-4000-8000-000000000001',sid,12,'EUR',false,today+1,null);
 select count(*) into n from public.service_prices where service_id=sid and is_active and valid_to=today;
 if n<>1 then raise exception 'period not closed'; end if;
 begin
  update public.service_prices set valid_to=today+1 where service_id=sid and valid_to=today and is_active;
  raise exception 'direct overlapping UPDATE accepted';
 exception when sqlstate '23P01' then null; end;
 begin
  insert into public.service_prices(organization_id,service_id,amount,currency,valid_from,is_active) values('00000000-0000-4000-8000-000000000001',sid,20,'EUR',today+1,true);
  raise exception 'direct overlap accepted';
 exception when sqlstate '23P01' then null; end;
 insert into public.service_prices(organization_id,service_id,location_id,amount,currency,valid_from,is_active) values('00000000-0000-4000-8000-000000000001',sid,'00000000-0000-4000-8000-000000000201',20,'EUR',today,true);
 insert into public.service_prices(organization_id,service_id,location_id,amount,currency,valid_from,is_active) values('00000000-0000-4000-8000-000000000001',sid,'00000000-0000-4000-8000-000000000202',30,'EUR',today,true);
 begin
  insert into public.service_prices(organization_id,service_id,location_id,amount,currency,valid_from,is_active) values('00000000-0000-4000-8000-000000000001',sid,'00000000-0000-4000-8000-000000000201',40,'EUR',today,true);
  raise exception 'same-location overlap accepted';
 exception when sqlstate '23P01' then null; end;
 insert into public.service_prices(organization_id,service_id,amount,currency,valid_from,is_active) values('00000000-0000-4000-8000-000000000001',sid,10,'EUR',today,false);
end;
$$;
do $$
declare today date := (clock_timestamp() at time zone 'Atlantic/Canary')::date; result text; saved_name text;
begin
  result:=public.save_service_with_versioned_price(
    '00000000-0000-4000-8000-000000000011','Renamed','S-1',null,'piece',null,true,10,'EUR',true,today,today);
  if result<>'unchanged' then raise exception 'manual edit created redundant price'; end if;
  begin
    perform public.save_service_with_versioned_price(
      '00000000-0000-4000-8000-000000000011','Must roll back','S-1',null,'piece',null,true,99,'EUR',true,today,today);
    raise exception 'same-day manual price conflict accepted';
  exception when sqlstate '23P01' then null; end;
  select name into saved_name from public.services where id='00000000-0000-4000-8000-000000000011';
  if saved_name<>'Renamed' then raise exception 'manual service rollback failed'; end if;
  result:=public.save_service_with_versioned_price(
    '00000000-0000-4000-8000-000000000011','Catalog only','S-1',null,'piece',null,
    true,null,'EUR',true,today,today);
  if result<>'unchanged' or (select count(*) from public.service_prices
    where service_id='00000000-0000-4000-8000-000000000011'
      and location_id is null and is_active)<>2 then
    raise exception 'catalog-only manual edit changed price history';
  end if;
end;
$$;
-- Manual replacement closes only the preceding applicable period, and a
-- later scheduled version blocks an ambiguous future replacement.
do $$
declare today date := (clock_timestamp() at time zone 'Atlantic/Canary')::date;
  sid uuid := '00000000-0000-4000-8000-000000000014'; result text; n integer;
begin
  insert into public.services(id,organization_id,code,name)
    values(sid,'00000000-0000-4000-8000-000000000001','S-4','Prior');
  insert into public.service_prices(organization_id,service_id,amount,currency,is_from,valid_from,is_active)
    values('00000000-0000-4000-8000-000000000001',sid,5,'EUR',true,today-3,true);
  result:=public.save_service_with_versioned_price(
    sid,'Versioned','S-4',null,'piece',null,true,6,'EUR',false,today,null);
  if result<>'closed_and_created' then raise exception 'manual closure missing'; end if;
  select count(*) into n from public.service_prices
    where service_id=sid and amount=5 and is_from and valid_from=today-3 and valid_to=today-1;
  if n<>1 then raise exception 'historical price was not preserved'; end if;
  update public.service_prices set valid_to=today
    where service_id=sid and amount=6 and valid_from=today;
  insert into public.service_prices(organization_id,service_id,amount,currency,is_from,valid_from,is_active)
    values('00000000-0000-4000-8000-000000000001',sid,7,'EUR',false,today+1,true);
  begin
    perform public.apply_base_price_version(
      '00000000-0000-4000-8000-000000000001',sid,8,'EUR',false,today+2,null);
    raise exception 'future price conflict accepted';
  exception when sqlstate '23P01' then null; end;
end;
$$;
set app.test_org = '00000000-0000-4000-8000-000000000002';
do $$begin
 begin perform public.get_unified_catalog_snapshot(); raise exception 'cross-tenant snapshot accepted'; exception when sqlstate '42501' then null; end;
end$$;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000103';
set app.test_org = '00000000-0000-4000-8000-000000000001';
do $$ begin
  if public.get_unified_catalog_snapshot() is null then raise exception 'manager denied'; end if;
end $$;
reset role;
