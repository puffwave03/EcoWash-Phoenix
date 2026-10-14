\set ON_ERROR_STOP on
-- Run only in the isolated disposable database, after the original 002J migration.
do $$ begin if current_database() <> 'phoenix_002j_test' then raise exception 'disposable_database_required'; end if; end $$;
set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000101';
set app.test_org = '00000000-0000-4000-8000-000000000001';

create temp table test_rpc_security_before as
select p.proowner, p.prosecdef, p.proconfig, p.proacl
from pg_catalog.pg_proc p
where p.oid = 'public.apply_unified_catalog_import(text,date,jsonb,text)'::pg_catalog.regprocedure;

insert into public.services(id,organization_id,code,name,is_active)
select ('00000000-0000-4000-8000-' || lpad((2000+i)::text,12,'0'))::uuid,
  '00000000-0000-4000-8000-000000000001',
  'P-'||lpad(i::text,3,'0'), 'Pilot '||i, true
from generate_series(1,219) i;
update public.services set portal_image_path='pilot/service/p-001.webp' where code='P-001';
create table public.catalog_segments(id integer primary key, organization_id uuid, name text);
insert into public.catalog_segments values(1,'00000000-0000-4000-8000-000000000001','Untouched segment');
create temp table test_before_services as select jsonb_agg(to_jsonb(s) order by s.id) as rows
  from public.services s;
create temp table test_before_categories as select jsonb_agg(to_jsonb(c) order by c.category_key) as rows
  from public.organization_portal_categories c;
create temp table test_before_segments as select jsonb_agg(to_jsonb(s) order by s.id) as rows
  from public.catalog_segments s;

create temp table test_002j_payload(payload jsonb);
insert into test_002j_payload
select jsonb_build_array(
    jsonb_build_object('serviceCode','001','status','archived','skip',true,
      'skipReason','archived','catalogChanged',false,'price',jsonb_build_object('amount','2.00','currency','EUR','isFrom',false)),
    jsonb_build_object('serviceCode','','status','archived','skip',true,
      'skipReason','archived','catalogChanged',false,'price',jsonb_build_object('amount','2.00','currency','EUR','isFrom',false)),
    jsonb_build_object('serviceCode','SMOKE-WASH-DRY','status','archived','skip',true,
      'skipReason','archived','catalogChanged',false,'price',jsonb_build_object('amount','2.00','currency','EUR','isFrom',false))
  ) || jsonb_agg(jsonb_build_object('serviceCode',code,'status','active',
    'unitType','piece','skip',false,'catalogChanged',false,
    'price',jsonb_build_object('amount','2.80','currency','EUR',
      'isFrom',code in ('P-218','P-219'),'validTo',null)) order by code)
from public.services where code like 'P-%';

-- Reproduce the UAT failure with the unmodified original RPC.
do $$
declare payload jsonb; snap text; today date := (clock_timestamp() at time zone 'Atlantic/Canary')::date;
begin
  select p.payload into payload from test_002j_payload p;
  snap := public.get_unified_catalog_snapshot();
  begin
    perform public.apply_unified_catalog_import('prices_only',today,payload,snap);
    raise exception 'original_rpc_unexpectedly_accepted_blank_code';
  exception when sqlstate '22023' then
    if sqlerrm <> 'unified_catalog_duplicate_or_invalid_code' then raise; end if;
  end;
  if (select count(*) from public.service_prices) <> 0 then
    raise exception 'original_rpc_partially_wrote_prices';
  end if;
end $$;
