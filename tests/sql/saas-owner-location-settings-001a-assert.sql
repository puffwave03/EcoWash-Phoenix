-- Run only after the disposable setup fixture and the proposed migration.
do $$
begin
  if pg_catalog.has_table_privilege('authenticated', 'public.locations', 'UPDATE')
    or pg_catalog.has_column_privilege('authenticated', 'public.locations', 'phone', 'UPDATE')
    or pg_catalog.has_function_privilege('anon', 'public.update_owner_location_settings(uuid,text,text,text,text,text,text,text,text)', 'EXECUTE')
    or not pg_catalog.has_function_privilege('authenticated', 'public.update_owner_location_settings(uuid,text,text,text,text,text,text,text,text)', 'EXECUTE')
    or not exists (select 1 from pg_catalog.pg_proc p
      where p.oid = 'public.update_owner_location_settings(uuid,text,text,text,text,text,text,text,text)'::pg_catalog.regprocedure
        and p.prosecdef and p.proowner = 'postgres'::pg_catalog.regrole
        and pg_catalog.array_to_string(p.proconfig, ',') = 'search_path=""') then
    raise exception 'least privilege or function ownership failed';
  end if;
end $$;

set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
do $$ begin
  if public.update_owner_location_settings(
    '20000000-0000-4000-8000-000000000001', ' Counter One ', ' 10 Main St ',
    ' Floor 2 ', ' Santa Cruz ', ' Tenerife ', ' 38600 ', 'es', ' +34 000 000 '
  ) is distinct from true then raise exception 'Owner update rejected'; end if;
end $$;
reset role;
do $$ declare row_data public.locations%rowtype; begin
  select * into row_data from public.locations where id = '20000000-0000-4000-8000-000000000001';
  if row_data.name <> 'Counter One' or row_data.address_line1 <> '10 Main St'
    or row_data.address_line2 <> 'Floor 2' or row_data.city <> 'Santa Cruz'
    or row_data.region <> 'Tenerife' or row_data.postal_code <> '38600'
    or row_data.country_code <> 'ES' or row_data.phone <> '+34 000 000'
    or row_data.organization_id <> '00000000-0000-4000-8000-000000000001'
    or not row_data.is_active or row_data.deleted_at is not null
    or not exists (select 1 from public.location_dependents
      where id = 1 and location_id = row_data.id) then
    raise exception 'Owner persistence, field scope or location relationship failed';
  end if;
end $$;

set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
do $$ begin
  update public.locations set phone = 'direct write'
  where id = '20000000-0000-4000-8000-000000000001';
  raise exception 'direct table UPDATE unexpectedly succeeded';
exception when insufficient_privilege then null;
end $$;
reset role;

set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', false);
do $$ begin
  if public.update_owner_location_settings('20000000-0000-4000-8000-000000000001',
    'Foreign Edit', null, null, null, null, null, 'ES', null) is distinct from false then
    raise exception 'foreign Owner was permitted';
  end if;
end $$;
select pg_catalog.set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false);
do $$ begin
  if public.update_owner_location_settings('20000000-0000-4000-8000-000000000001',
    'Manager Edit', null, null, null, null, null, 'ES', null) is distinct from false then
    raise exception 'Manager was permitted';
  end if;
end $$;
select pg_catalog.set_config('request.jwt.claim.sub', '', false);
do $$ begin
  if public.update_owner_location_settings('20000000-0000-4000-8000-000000000001',
    'Anonymous Edit', null, null, null, null, null, 'ES', null) is distinct from false then
    raise exception 'missing auth.uid was permitted';
  end if;
end $$;
reset role;

update public.organization_memberships set is_active = false
where organization_id = '00000000-0000-4000-8000-000000000001'
  and profile_id = '10000000-0000-4000-8000-000000000001';
set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
do $$ begin
  if public.update_owner_location_settings('20000000-0000-4000-8000-000000000001',
    'Inactive Member Edit', null, null, null, null, null, 'ES', null) is distinct from false then
    raise exception 'inactive Owner membership was permitted';
  end if;
end $$;
reset role;
update public.organization_memberships set is_active = true
where organization_id = '00000000-0000-4000-8000-000000000001'
  and profile_id = '10000000-0000-4000-8000-000000000001';

set role anon;
do $$ begin
  perform public.update_owner_location_settings('20000000-0000-4000-8000-000000000001',
    'Anon Edit', null, null, null, null, null, 'ES', null);
  raise exception 'anon EXECUTE unexpectedly succeeded';
exception when insufficient_privilege then null;
end $$;
reset role;

update public.organizations set status = 'inactive' where id = '00000000-0000-4000-8000-000000000001';
set role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
do $$ begin
  if public.update_owner_location_settings('20000000-0000-4000-8000-000000000001',
    'Inactive Org Edit', null, null, null, null, null, 'ES', null) is distinct from false then
    raise exception 'inactive organization was permitted';
  end if;
end $$;
reset role;
update public.organizations set status = 'active', platform_service_status = 'suspended'
where id = '00000000-0000-4000-8000-000000000001';
set role authenticated;
do $$ begin
  if public.update_owner_location_settings('20000000-0000-4000-8000-000000000001',
    'Suspended Org Edit', null, null, null, null, null, 'ES', null) is distinct from false then
    raise exception 'suspended organization was permitted';
  end if;
end $$;
reset role;
update public.organizations set platform_service_status = 'active'
where id = '00000000-0000-4000-8000-000000000001';

update public.locations set is_active = false where id = '20000000-0000-4000-8000-000000000001';
set role authenticated;
do $$ begin
  if public.update_owner_location_settings('20000000-0000-4000-8000-000000000001',
    'Inactive Location Edit', null, null, null, null, null, 'ES', null) is distinct from false then
    raise exception 'inactive location was permitted';
  end if;
end $$;
reset role;
update public.locations set is_active = true, deleted_at = now()
where id = '20000000-0000-4000-8000-000000000001';
set role authenticated;
do $$ begin
  if public.update_owner_location_settings('20000000-0000-4000-8000-000000000001',
    'Deleted Location Edit', null, null, null, null, null, 'ES', null) is distinct from false then
    raise exception 'deleted location was permitted';
  end if;
end $$;
reset role;
update public.locations set deleted_at = null where id = '20000000-0000-4000-8000-000000000001';

set role authenticated;
do $$ begin
  perform public.update_owner_location_settings('20000000-0000-4000-8000-000000000001',
    'Invalid Country Edit', null, null, null, null, null, 'SP', null);
  raise exception 'SP unexpectedly accepted';
exception when sqlstate '22023' then null;
end $$;
reset role;
do $$ begin
  if (select name from public.locations where id = '20000000-0000-4000-8000-000000000001') <> 'Counter One' then
    raise exception 'denied or invalid edit changed location';
  end if;
end $$;
