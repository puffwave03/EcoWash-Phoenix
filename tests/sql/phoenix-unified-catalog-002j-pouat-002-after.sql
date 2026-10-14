\set ON_ERROR_STOP on
-- Run in the same disposable psql session, after the additive correction.
do $$ begin if current_database() <> 'phoenix_002j_test' then raise exception 'disposable_database_required'; end if; end $$;

do $$
declare before_record record; after_record record;
begin
  select * into before_record from test_rpc_security_before;
  select p.proowner, p.prosecdef, p.proconfig, p.proacl into after_record
    from pg_catalog.pg_proc p
    where p.oid = 'public.apply_unified_catalog_import(text,date,jsonb,text)'::pg_catalog.regprocedure;
  if before_record.proowner is distinct from after_record.proowner
    or before_record.prosecdef is distinct from after_record.prosecdef
    or before_record.proconfig is distinct from after_record.proconfig
    or before_record.proacl is distinct from after_record.proacl
    or not after_record.prosecdef then
    raise exception 'rpc_security_contract_changed';
  end if;
end $$;

do $$
declare payload jsonb; snap text; result jsonb;
  today date := (clock_timestamp() at time zone 'Atlantic/Canary')::date;
  before_count integer;
begin
  select p.payload into payload from test_002j_payload p;
  snap := public.get_unified_catalog_snapshot();

  -- Included active rows still require codes; no partial price writes.
  begin
    perform public.apply_unified_catalog_import('prices_only',today,
      payload || jsonb_build_array(jsonb_build_object('serviceCode','',
        'status','active','skip',false,'unitType','piece')),
      snap);
    raise exception 'active_blank_code_accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'unified_catalog_duplicate_or_invalid_code' then raise; end if;
  end;
  if (select count(*) from public.service_prices) <> 0 then
    raise exception 'active_blank_code_partial_write';
  end if;

  -- A forged blank-code exclusion or malformed reason stays rejected.
  begin
    perform public.apply_unified_catalog_import('prices_only',today,
      jsonb_build_array(jsonb_build_object('serviceCode','',
        'status','active','skip',true,'skipReason','archived','catalogChanged',false)),snap);
    raise exception 'forged_blank_exclusion_accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'unified_catalog_duplicate_or_invalid_code' then raise; end if;
  end;
  begin
    perform public.apply_unified_catalog_import('prices_only',today,
      jsonb_build_array(jsonb_build_object('serviceCode','EXCLUDED',
        'status','active','skip',true,'skipReason','','catalogChanged',false)),snap);
    raise exception 'invalid_exclusion_accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'unified_catalog_invalid_exclusion' then raise; end if;
  end;
  begin
    perform public.apply_unified_catalog_import('catalog_and_prices',today,
      jsonb_build_array(jsonb_build_object('serviceCode','',
        'status','archived','skip',true,'skipReason','archived','catalogChanged',false)),snap);
    raise exception 'catalog_mode_blank_code_accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'unified_catalog_duplicate_or_invalid_code' then raise; end if;
  end;

  -- A different tenant's authenticated user cannot use this snapshot.
  perform pg_catalog.set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
  begin
    perform public.apply_unified_catalog_import('prices_only',today,payload,snap);
    raise exception 'foreign_owner_accepted';
  exception when sqlstate '42501' then
    if sqlerrm <> 'unified_catalog_invalid_or_denied' then raise; end if;
  end;
  perform pg_catalog.set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
  if (select count(*) from public.service_prices) <> 0 then
    raise exception 'denied_attempt_partial_write';
  end if;

  result := public.apply_unified_catalog_import('prices_only',today,payload,snap);
  if result->>'priceCreates' <> '219' or result->>'catalogCreates' <> '0'
    or result->>'catalogUpdates' <> '0'
    or (select count(*) from public.service_prices where organization_id='00000000-0000-4000-8000-000000000001') <> 219
    or (select count(*) from public.service_prices where is_from) <> 2 then
    raise exception '219_prices_three_skips_failed: %',result;
  end if;
  if (select jsonb_agg(to_jsonb(s) order by s.id) from public.services s)
      is distinct from (select rows from test_before_services)
    or (select jsonb_agg(to_jsonb(c) order by c.category_key) from public.organization_portal_categories c)
      is distinct from (select rows from test_before_categories)
    or (select jsonb_agg(to_jsonb(s) order by s.id) from public.catalog_segments s)
      is distinct from (select rows from test_before_segments) then
    raise exception 'catalog_image_or_segment_changed';
  end if;

  -- Reconfirmation from the fresh snapshot is idempotent.
  snap := public.get_unified_catalog_snapshot();
  result := public.apply_unified_catalog_import('prices_only',today,payload,snap);
  if result->>'priceCreates' <> '0' or result->>'priceUnchanged' <> '219'
    or (select count(*) from public.service_prices) <> 219 then
    raise exception 'idempotent_repeat_failed: %',result;
  end if;
end $$;

-- A late SQL price conflict must undo earlier price versions in the call.
do $$
declare snap text; payload jsonb; before_rows jsonb;
  today date := (clock_timestamp() at time zone 'Atlantic/Canary')::date;
  sid uuid;
begin
  begin
    select id into sid from public.services where code='P-219';
    insert into public.service_prices(organization_id,service_id,amount,currency,is_from,valid_from,is_active)
      values('00000000-0000-4000-8000-000000000001',sid,9,'GBP',false,today+1,true);
    select jsonb_agg(to_jsonb(p) order by p.id) into before_rows from public.service_prices p;
    snap := public.get_unified_catalog_snapshot();
    payload := jsonb_build_array(
      jsonb_build_object('serviceCode','P-001','unitType','piece',
        'price',jsonb_build_object('amount','3.00','currency','EUR','isFrom',false,'validTo',null)),
      jsonb_build_object('serviceCode','P-219','unitType','piece',
        'price',jsonb_build_object('amount','4.00','currency','EUR','isFrom',true,'validTo',null)));
    begin
      perform public.apply_unified_catalog_import('prices_only',today+1,payload,snap);
      raise exception 'late_price_conflict_accepted';
    exception when sqlstate '23P01' then
      if sqlerrm <> 'base_price_cross_currency_conflict' then raise; end if;
    end;
    if (select jsonb_agg(to_jsonb(p) order by p.id) from public.service_prices p) is distinct from before_rows then
      raise exception 'late_price_failure_partially_wrote';
    end if;
    raise exception 'test_rollback';
  exception when raise_exception then
    if sqlerrm <> 'test_rollback' then raise; end if;
  end;
  if (select count(*) from public.service_prices) <> 219 then
    raise exception 'rollback_cleanup_failed';
  end if;
end $$;
